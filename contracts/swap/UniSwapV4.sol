// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./BaseSwap.sol";
import "../libraries/BytesLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@kyber.network/utils-sc/contracts/IERC20Ext.sol";
import "@uniswap/v3-core/contracts/libraries/BitMath.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/SwapMath.sol";
import "@uniswap/v3-core/contracts/libraries/LiquidityMath.sol";

/// @dev V4 pool state is stored in a singleton PoolManager, accessed via StateView
interface IStateView {
    /// @notice Returns slot0 data for a V4 pool identified by its PoolId (keccak256 of PoolKey)
    function getSlot0(bytes32 poolId)
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        );

    function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity);

    /// @notice Returns the tick bitmap word for the given pool and word position
    function getTickBitmap(bytes32 poolId, int16 wordPosition)
        external
        view
        returns (uint256 bitmap);

    /// @notice Returns liquidityGross and liquidityNet for a tick in a V4 pool
    function getTickLiquidity(bytes32 poolId, int24 tick)
        external
        view
        returns (uint128 liquidityGross, int128 liquidityNet);
}

/// @dev Minimal Universal Router interface for V4 swaps
interface IUniversalRouterV4 {
    /// @param commands Packed bytes of command types
    /// @param inputs ABI-encoded inputs per command
    /// @param deadline Deadline timestamp
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

/// @dev Uniswap V4 PositionManager — stores full PoolKey indexed by truncated poolId (first 25 bytes)
interface INFPM {
    function poolKeys(bytes25 poolId)
        external
        view
        returns (
            address currency0,
            address currency1,
            uint24 fee,
            int24 tickSpacing,
            address hooks
        );
}

/// @dev PoolKey uniquely identifies a V4 pool; currency0 < currency1 by address ordering
struct PoolKey {
    address currency0; // address(0) for native ETH
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks; // address(0) if no hooks
}

/// @dev PathKey describes one hop in a V4 multi-hop path
struct PathKey {
    address intermediateCurrency;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
    bytes hookData;
}

/// @dev Replicates V3 TickBitmap logic over V4 StateView
library TickBitmapV4 {
    function position(int24 tick) private pure returns (int16 wordPos, uint8 bitPos) {
        wordPos = int16(tick >> 8);
        bitPos = uint8(tick % 256);
    }

    function nextInitializedTickWithinOneWord(
        IStateView stateView,
        bytes32 poolId,
        int24 tick,
        int24 tickSpacing,
        bool lte
    ) internal view returns (int24 next, bool initialized) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;

        if (lte) {
            (int16 wordPos, uint8 bitPos) = position(compressed);
            uint256 mask = (1 << bitPos) - 1 + (1 << bitPos);
            uint256 masked = stateView.getTickBitmap(poolId, wordPos) & mask;

            initialized = masked != 0;
            next = initialized
                ? (compressed - int24(bitPos - BitMath.mostSignificantBit(masked))) * tickSpacing
                : (compressed - int24(bitPos)) * tickSpacing;
        } else {
            (int16 wordPos, uint8 bitPos) = position(compressed + 1);
            uint256 mask = ~((1 << bitPos) - 1);
            uint256 masked = stateView.getTickBitmap(poolId, wordPos) & mask;

            initialized = masked != 0;
            next = initialized
                ? (compressed + 1 + int24(BitMath.leastSignificantBit(masked) - bitPos)) *
                    tickSpacing
                : (compressed + 1 + int24(type(uint8).max - bitPos)) * tickSpacing;
        }
    }
}

/// @title UniSwapV4 — Krystal swap adapter for Uniswap V4 and its clones
/// @notice Supports single-hop and multi-hop exact-input swaps via the V4 Universal Router.
///         Quote simulation uses V4 StateView so no on-chain Quoter call is needed.
///
/// extraArgs encoding (per trade):
///   [20B] Universal Router address — its StateView/NFPM are looked up from an admin-set
///         mapping (see routerConfigs), never taken from caller-supplied data
///   per hop: [32B] bytes32 poolId (keccak256 of PoolKey)
contract UniSwapV4 is BaseSwap {
    using SafeERC20 for IERC20Ext;
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;
    using BytesLib for bytes;
    using SafeCast for uint256;
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using TickBitmapV4 for IStateView;

    // ── Universal Router command byte for V4 swaps ──────────────────────────
    // Source: Commands.sol in Uniswap universal-router
    uint8 private constant COMMAND_V4_SWAP = 0x10;

    // ── V4Router action bytes (packed inside V4_SWAP input) ─────────────────
    // Source: Actions.sol in Uniswap v4-periphery (v1.0+)
    uint8 private constant ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 private constant ACTION_SWAP_EXACT_IN = 0x07;
    uint8 private constant ACTION_SETTLE = 0x0b;
    uint8 private constant ACTION_TAKE = 0x0e;

    // ── Sentinel amount meaning "take the full open delta" (see ActionConstants.OPEN_DELTA) ──
    uint256 private constant OPEN_DELTA = 0;

    /// @dev StateView/NFPM bound per-router by admin, so a caller can never point the quote
    ///      simulator or the pool-metadata lookup (fee/tickSpacing/hooks) at an arbitrary
    ///      contract via extraArgs — only the whitelisted router's own StateView/NFPM are used.
    struct RouterConfig {
        address stateView;
        address nfpm;
    }

    EnumerableSet.AddressSet private uniRouters;
    mapping(address => RouterConfig) public routerConfigs;

    event UpdatedUniRouters(address[] routers, bool isSupported);

    constructor(
        address _admin,
        address[] memory routers,
        address[] memory stateViews,
        address[] memory nfpms
    ) BaseSwap(_admin) {
        _updateUniRouters(routers, stateViews, nfpms, true);
    }

    struct StepComputations {
        uint160 sqrtPriceStartX96;
        int24 tickNext;
        bool initialized;
        uint160 sqrtPriceNextX96;
        uint256 amountIn;
        uint256 amountOut;
        uint256 feeAmount;
    }

    struct SwapState {
        int256 amountSpecifiedRemaining;
        int256 amountCalculated;
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
    }

    struct SwapConfig {
        int24 tickSpacing;
        uint160 sqrtPriceLimitX96;
        uint24 fee;
        bool exactInput;
        bool zeroForOne;
    }

    /// @dev Bundles swapExactInput's scalar args to avoid stack-too-deep.
    struct ExactInputArgs {
        uint256 srcAmount;
        uint256 minDestAmount;
        bool inputIsETH;
        address recipient;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function getAllUniRouters()
        external
        view
        returns (
            address[] memory routers,
            address[] memory stateViews,
            address[] memory nfpms
        )
    {
        uint256 length = uniRouters.length();
        routers = new address[](length);
        stateViews = new address[](length);
        nfpms = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            routers[i] = uniRouters.at(i);
            RouterConfig memory cfg = routerConfigs[routers[i]];
            stateViews[i] = cfg.stateView;
            nfpms[i] = cfg.nfpm;
        }
    }

    /// @param routers Universal Router addresses to add/remove.
    /// @param stateViews StateView address bound to each router; ignored when isSupported is false.
    /// @param nfpms NFPM address bound to each router; ignored when isSupported is false.
    function updateUniRouters(
        address[] calldata routers,
        address[] calldata stateViews,
        address[] calldata nfpms,
        bool isSupported
    ) external onlyAdmin {
        _updateUniRouters(routers, stateViews, nfpms, isSupported);
        emit UpdatedUniRouters(routers, isSupported);
    }

    function _updateUniRouters(
        address[] memory routers,
        address[] memory stateViews,
        address[] memory nfpms,
        bool isSupported
    ) private {
        require(
            routers.length == stateViews.length && routers.length == nfpms.length,
            "length mismatch"
        );
        for (uint256 i = 0; i < routers.length; i++) {
            if (isSupported) {
                require(
                    stateViews[i] != address(0) && nfpms[i] != address(0),
                    "invalid router config"
                );
                uniRouters.add(routers[i]);
                routerConfigs[routers[i]] = RouterConfig({
                    stateView: stateViews[i],
                    nfpm: nfpms[i]
                });
            } else {
                uniRouters.remove(routers[i]);
                delete routerConfigs[routers[i]];
            }
        }
    }

    // ── ISwap — quote functions ──────────────────────────────────────────────

    function getExpectedReturn(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        uint256 hopCount = params.tradePath.length - 1;
        (, IStateView stateView, INFPM nfpm, bytes32[] memory poolIds) = parseExtraArgs(
            hopCount,
            params.extraArgs
        );

        destAmount = params.srcAmount;
        for (uint256 i = 0; i < hopCount; i++) {
            destAmount = getAmountOut(
                stateView,
                nfpm,
                destAmount,
                params.tradePath[i],
                params.tradePath[i + 1],
                poolIds[i]
            );
        }
    }

    function getExpectedReturnWithImpact(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount, uint256 priceImpact)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        uint256 hopCount = params.tradePath.length - 1;
        (, IStateView stateView, INFPM nfpm, bytes32[] memory poolIds) = parseExtraArgs(
            hopCount,
            params.extraArgs
        );

        destAmount = params.srcAmount;
        uint256 quote = params.srcAmount;
        for (uint256 i = 0; i < hopCount; i++) {
            destAmount = getAmountOut(
                stateView,
                nfpm,
                destAmount,
                params.tradePath[i],
                params.tradePath[i + 1],
                poolIds[i]
            );
            quote = getQuote(
                stateView,
                quote,
                params.tradePath[i],
                params.tradePath[i + 1],
                poolIds[i]
            );
        }
        priceImpact = quote <= destAmount ? 0 : quote.sub(destAmount).mul(BPS) / quote;
    }

    function getExpectedIn(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        uint256 hopCount = params.tradePath.length - 1;
        (, IStateView stateView, INFPM nfpm, bytes32[] memory poolIds) = parseExtraArgs(
            hopCount,
            params.extraArgs
        );

        srcAmount = params.destAmount;
        for (uint256 i = params.tradePath.length - 1; i > 0; i--) {
            srcAmount = getAmountIn(
                stateView,
                nfpm,
                srcAmount,
                params.tradePath[i - 1],
                params.tradePath[i],
                poolIds[i - 1]
            );
        }
    }

    function getExpectedInWithImpact(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount, uint256 priceImpact)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        uint256 hopCount = params.tradePath.length - 1;
        (, IStateView stateView, INFPM nfpm, bytes32[] memory poolIds) = parseExtraArgs(
            hopCount,
            params.extraArgs
        );

        srcAmount = params.destAmount;
        for (uint256 i = params.tradePath.length - 1; i > 0; i--) {
            srcAmount = getAmountIn(
                stateView,
                nfpm,
                srcAmount,
                params.tradePath[i - 1],
                params.tradePath[i],
                poolIds[i - 1]
            );
        }
        uint256 quote = srcAmount;
        for (uint256 i = 0; i < hopCount; i++) {
            quote = getQuote(
                stateView,
                quote,
                params.tradePath[i],
                params.tradePath[i + 1],
                poolIds[i]
            );
        }
        priceImpact = quote <= params.destAmount
            ? 0
            : quote.sub(params.destAmount).mul(BPS) / quote;
    }

    // ── ISwap — swap ─────────────────────────────────────────────────────────

    /// @notice Executes a V4 swap via the Universal Router.
    ///         Output is delivered to params.recipient.
    function swap(SwapParams calldata params)
        external
        payable
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        (IUniversalRouterV4 router, , INFPM nfpm, bytes32[] memory poolIds) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        bool inputIsETH = params.tradePath[0] == address(ETH_TOKEN_ADDRESS);

        if (!inputIsETH) {
            IERC20Ext(params.tradePath[0]).safeTransfer(address(router), params.srcAmount);
        }

        destAmount = _doSwapAndMeasure(router, nfpm, params, poolIds, inputIsETH);
    }

    /// @dev Output is taken from the PoolManager straight to params.recipient (never held by this
    ///      contract), so the delta is measured on the recipient's balance — mirroring UniSwapV3.
    ///      This also avoids double-counting a pre-funded native-ETH input when the input and
    ///      output currencies are both ETH.
    function _doSwapAndMeasure(
        IUniversalRouterV4 router,
        INFPM nfpm,
        SwapParams calldata params,
        bytes32[] memory poolIds,
        bool inputIsETH
    ) private returns (uint256 delta) {
        IERC20Ext outputToken = IERC20Ext(params.tradePath[params.tradePath.length - 1]);
        uint256 balanceBefore = getBalance(outputToken, params.recipient);

        if (params.tradePath.length == 2) {
            swapExactInputSingle(
                router,
                nfpm,
                params.srcAmount,
                params.minDestAmount,
                params.tradePath,
                poolIds[0],
                inputIsETH,
                params.recipient
            );
        } else {
            swapExactInput(
                router,
                nfpm,
                params.tradePath,
                poolIds,
                ExactInputArgs({
                    srcAmount: params.srcAmount,
                    minDestAmount: params.minDestAmount,
                    inputIsETH: inputIsETH,
                    recipient: params.recipient
                })
            );
        }

        delta = getBalance(outputToken, params.recipient).sub(balanceBefore);
    }

    // ── Internal swap builders ────────────────────────────────────────────────

    /// @dev Fetches pool metadata for `poolId` from the trusted NFPM and verifies that `poolId`
    ///      really is keccak256(PoolKey) for (currencyA, currencyB) — otherwise a caller could
    ///      smuggle in the fee/tickSpacing of an unrelated real pool via a mismatched poolId.
    function _verifiedPoolMeta(
        INFPM nfpm,
        bytes32 poolId,
        address currencyA,
        address currencyB
    )
        private
        view
        returns (
            uint24 fee,
            int24 tickSpacing,
            address hooks
        )
    {
        (, , fee, tickSpacing, hooks) = nfpm.poolKeys(bytes25(poolId));
        require(hooks == address(0), "hooked pool unsupported");

        (address currency0, address currency1) = currencyA < currencyB
            ? (currencyA, currencyB)
            : (currencyB, currencyA);
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });
        require(keccak256(abi.encode(poolKey)) == poolId, "poolId mismatch");
    }

    function _buildPoolKey(
        INFPM nfpm,
        bytes32 poolId,
        address currency0,
        address currency1,
        bool zeroForOne
    ) internal view returns (PoolKey memory) {
        (uint24 fee, int24 tickSpacing, address hooks) = _verifiedPoolMeta(
            nfpm,
            poolId,
            currency0,
            currency1
        );
        return
            PoolKey({
                currency0: zeroForOne ? currency0 : currency1,
                currency1: zeroForOne ? currency1 : currency0,
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: hooks
            });
    }

    function swapExactInputSingle(
        IUniversalRouterV4 router,
        INFPM nfpm,
        uint256 srcAmount,
        uint256 minDestAmount,
        address[] calldata tradePath,
        bytes32 poolId,
        bool inputIsETH,
        address recipient
    ) internal {
        address currency0 = v4Currency(tradePath[0]);
        address currency1 = v4Currency(tradePath[1]);
        bool zeroForOne = currency0 < currency1;

        PoolKey memory poolKey = _buildPoolKey(nfpm, poolId, currency0, currency1, zeroForOne);

        // actions: SWAP_EXACT_IN_SINGLE | SETTLE | TAKE
        bytes memory actions = abi.encodePacked(
            ACTION_SWAP_EXACT_IN_SINGLE,
            ACTION_SETTLE,
            ACTION_TAKE
        );

        bytes[] memory actionParams = new bytes[](3);
        // SWAP_EXACT_IN_SINGLE params: ExactInputSingleParams
        actionParams[0] = abi.encode(
            poolKey,
            zeroForOne,
            toUint128(srcAmount),
            toUint128(minDestAmount),
            uint256(0), // minHopPriceX36 — no price limit
            bytes("") // hookData
        );
        // SETTLE params: (currency, amount, payerIsUser=false) — settle from router's own balance
        actionParams[1] = abi.encode(currency0, srcAmount, false);
        // TAKE params: (currency, recipient, amount) — full open delta sent straight to recipient
        actionParams[2] = abi.encode(currency1, recipient, OPEN_DELTA);

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, actionParams);

        router.execute{value: inputIsETH ? srcAmount : 0}(
            abi.encodePacked(COMMAND_V4_SWAP),
            inputs,
            MAX_AMOUNT
        );
    }

    function swapExactInput(
        IUniversalRouterV4 router,
        INFPM nfpm,
        address[] calldata tradePath,
        bytes32[] memory poolIds,
        ExactInputArgs memory a
    ) internal {
        address currencyIn = v4Currency(tradePath[0]);

        PathKey[] memory path = new PathKey[](poolIds.length);
        for (uint256 i = 0; i < poolIds.length; i++) {
            (uint24 fee, int24 tickSpacing, address hooks) = _verifiedPoolMeta(
                nfpm,
                poolIds[i],
                v4Currency(tradePath[i]),
                v4Currency(tradePath[i + 1])
            );
            path[i] = PathKey({
                intermediateCurrency: v4Currency(tradePath[i + 1]),
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: hooks,
                hookData: bytes("")
            });
        }

        bytes memory actions = abi.encodePacked(ACTION_SWAP_EXACT_IN, ACTION_SETTLE, ACTION_TAKE);

        uint256[] memory minHopPrices = new uint256[](poolIds.length); // all zeros — no hop price limits
        bytes[] memory actionParams = new bytes[](3);
        // SWAP_EXACT_IN params: ExactInputParams (currencyIn, PathKey[], minHopPriceX36[], amountIn, amountOutMinimum)
        actionParams[0] = abi.encode(
            currencyIn,
            path,
            minHopPrices,
            toUint128(a.srcAmount),
            toUint128(a.minDestAmount)
        );
        // SETTLE params: (currency, amount, payerIsUser=false) — settle from router's own balance
        actionParams[1] = abi.encode(currencyIn, a.srcAmount, false);
        // TAKE params: (currency, recipient, amount) — full open delta sent straight to recipient
        actionParams[2] = abi.encode(
            v4Currency(tradePath[tradePath.length - 1]),
            a.recipient,
            OPEN_DELTA
        );

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, actionParams);

        router.execute{value: a.inputIsETH ? a.srcAmount : 0}(
            abi.encodePacked(COMMAND_V4_SWAP),
            inputs,
            MAX_AMOUNT
        );
    }

    // ── Quote simulation ─────────────────────────────────────────────────────

    function getAmountOut(
        IStateView stateView,
        INFPM nfpm,
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) private view returns (uint256) {
        return getAmount(stateView, nfpm, amountIn.toInt256(), tokenIn, tokenOut, poolId);
    }

    function getAmountIn(
        IStateView stateView,
        INFPM nfpm,
        uint256 amountOut,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) private view returns (uint256) {
        return getAmount(stateView, nfpm, -amountOut.toInt256(), tokenIn, tokenOut, poolId);
    }

    /// @dev Simulates the V4 AMM swap step-by-step using StateView.
    ///      The concentrated-liquidity math is identical to V3.
    function getAmount(
        IStateView stateView,
        INFPM nfpm,
        int256 amountSpecified,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) private view returns (uint256 amount) {
        SwapConfig memory cfg;
        {
            address currency0 = v4Currency(tokenIn);
            address currency1 = v4Currency(tokenOut);
            cfg.zeroForOne = currency0 < currency1;
        }
        {
            (, int24 tickSpacing, ) = _verifiedPoolMeta(
                nfpm,
                poolId,
                v4Currency(tokenIn),
                v4Currency(tokenOut)
            );
            cfg.tickSpacing = tickSpacing;
        }
        cfg.sqrtPriceLimitX96 = cfg.zeroForOne
            ? TickMath.MIN_SQRT_RATIO + 1
            : TickMath.MAX_SQRT_RATIO - 1;

        SwapState memory state;
        state.amountSpecifiedRemaining = amountSpecified;
        state.amountCalculated = 0;
        {
            uint24 protocolFee;
            uint24 lpFee;
            (state.sqrtPriceX96, state.tick, protocolFee, lpFee) = stateView.getSlot0(poolId);
            cfg.fee = combinedSwapFee(protocolFee, cfg.zeroForOne, lpFee);
        }
        state.liquidity = stateView.getLiquidity(poolId);
        cfg.exactInput = amountSpecified > 0;

        while (
            state.amountSpecifiedRemaining != 0 && state.sqrtPriceX96 != cfg.sqrtPriceLimitX96
        ) {
            StepComputations memory step;
            step.sqrtPriceStartX96 = state.sqrtPriceX96;

            (step.tickNext, step.initialized) = stateView.nextInitializedTickWithinOneWord(
                poolId,
                state.tick,
                cfg.tickSpacing,
                cfg.zeroForOne
            );

            if (step.tickNext < TickMath.MIN_TICK) {
                step.tickNext = TickMath.MIN_TICK;
            } else if (step.tickNext > TickMath.MAX_TICK) {
                step.tickNext = TickMath.MAX_TICK;
            }

            step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

            (state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount) = SwapMath
            .computeSwapStep(
                state.sqrtPriceX96,
                (
                    cfg.zeroForOne
                        ? step.sqrtPriceNextX96 < cfg.sqrtPriceLimitX96
                        : step.sqrtPriceNextX96 > cfg.sqrtPriceLimitX96
                )
                    ? cfg.sqrtPriceLimitX96
                    : step.sqrtPriceNextX96,
                state.liquidity,
                state.amountSpecifiedRemaining,
                cfg.fee
            );

            if (cfg.exactInput) {
                state.amountSpecifiedRemaining -= (step.amountIn + step.feeAmount).toInt256();
                state.amountCalculated = state.amountCalculated.sub(step.amountOut.toInt256());
            } else {
                state.amountSpecifiedRemaining += step.amountOut.toInt256();
                state.amountCalculated = state.amountCalculated.add(
                    (step.amountIn + step.feeAmount).toInt256()
                );
            }

            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                if (step.initialized) {
                    (, int128 liquidityNet) = stateView.getTickLiquidity(poolId, step.tickNext);
                    if (cfg.zeroForOne) liquidityNet = -liquidityNet;
                    state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
                }
                state.tick = cfg.zeroForOne ? step.tickNext - 1 : step.tickNext;
            } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            }
        }

        amount = state.amountCalculated < 0
            ? uint256(-state.amountCalculated)
            : uint256(state.amountCalculated);
    }

    /// @dev Combines the direction-specific protocol fee with the LP fee, mirroring
    ///      v4-core's ProtocolFeeLibrary (getZeroForOneFee/getOneForZeroFee + calculateSwapFee).
    ///      protocolFee packs two 12-bit pips values: bits [0:12) for zeroForOne, [12:24) for oneForZero.
    ///      The combined swap fee is applied once in SwapMath.computeSwapStep, same as v4-core's
    ///      Pool.swap — the protocol/LP split only affects internal fee accounting, not the
    ///      swapper-realized amountIn/amountOut.
    function combinedSwapFee(
        uint24 protocolFee,
        bool zeroForOne,
        uint24 lpFee
    ) private pure returns (uint24) {
        uint256 directionalProtocolFee = zeroForOne ? protocolFee & 0xfff : protocolFee >> 12;
        if (directionalProtocolFee == 0) return lpFee;
        uint256 numerator = directionalProtocolFee * uint256(lpFee);
        return uint24(directionalProtocolFee + lpFee - numerator / 1_000_000);
    }

    /// @dev Spot-price quote (no slippage) used to compute price impact.
    function getQuote(
        IStateView stateView,
        uint256 quote,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) internal view returns (uint256 quoteOut) {
        address currency0 = v4Currency(tokenIn);
        address currency1 = v4Currency(tokenOut);
        bool zeroForOne = currency0 < currency1;

        (uint160 sqrtPriceX96, , , ) = stateView.getSlot0(poolId);
        if (zeroForOne) {
            quoteOut = quote.mul(sqrtPriceX96) >> 96;
            quoteOut = quoteOut.mul(sqrtPriceX96) >> 96;
        } else {
            // divide by price instead of multiplying by an approximate reciprocal sqrt price
            quoteOut = quote.mul(1 << 96) / sqrtPriceX96;
            quoteOut = quoteOut.mul(1 << 96) / sqrtPriceX96;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// @dev V4 uses address(0) for native ETH; we map ETH_TOKEN_ADDRESS accordingly.
    function v4Currency(address token) internal view returns (address) {
        return token == address(ETH_TOKEN_ADDRESS) ? address(0) : token;
    }

    /// @dev Reverts on overflow instead of silently truncating, unlike a bare uint128(x) cast.
    function toUint128(uint256 x) private pure returns (uint128 y) {
        require((y = uint128(x)) == x, "uint128 overflow");
    }

    /// @dev Parses extraArgs: <[20B] router><per hop: [32B] poolId>
    ///      stateView/nfpm are never taken from extraArgs — they're looked up from the
    ///      admin-set routerConfigs mapping keyed by the (whitelisted) router address, so a
    ///      caller can't redirect the quote simulator or pool-metadata lookup to an arbitrary
    ///      contract and steer the swap into an attacker-chosen pool.
    function parseExtraArgs(uint256 hopCount, bytes calldata extraArgs)
        internal
        view
        returns (
            IUniversalRouterV4 router,
            IStateView stateView,
            INFPM nfpm,
            bytes32[] memory poolIds
        )
    {
        router = IUniversalRouterV4(extraArgs.toAddress(0));
        require(address(router) != address(0), "invalid router");
        require(uniRouters.contains(address(router)), "unsupported router");

        RouterConfig memory cfg = routerConfigs[address(router)];
        stateView = IStateView(cfg.stateView);
        nfpm = INFPM(cfg.nfpm);

        poolIds = new bytes32[](hopCount);

        // Header is 20 bytes; each hop is 32 bytes (poolId)
        for (uint256 i = 0; i < hopCount; i++) {
            poolIds[i] = bytes32(extraArgs.toUint256(20 + i * 32));
        }
    }
}
