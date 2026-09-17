// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./BaseSwap.sol";
import "../libraries/BytesLib.sol";
import "../libraries/PoolAddressProjectX.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@kyber.network/utils-sc/contracts/IERC20Ext.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IMulticall.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/libraries/BitMath.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/SwapMath.sol";
import "@uniswap/v3-core/contracts/libraries/LiquidityMath.sol";

interface ISwapRouterHyperEvmInternal is ISwapRouter, IMulticall, IPeripheryImmutableState {}

library TickBitmapHyperEvm {
    function position(int24 tick) private pure returns (int16 wordPos, uint8 bitPos) {
        wordPos = int16(tick >> 8);
        bitPos = uint8(tick % 256);
    }

    function nextInitializedTickWithinOneWord(
        IUniswapV3Pool pool,
        int24 tick,
        int24 tickSpacing,
        bool lte
    ) internal view returns (int24 next, bool initialized) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity

        if (lte) {
            (int16 wordPos, uint8 bitPos) = position(compressed);
            // all the 1s at or to the right of the current bitPos
            uint256 mask = (1 << bitPos) - 1 + (1 << bitPos);
            uint256 masked = pool.tickBitmap(wordPos) & mask;

            // if there are no initialized ticks to the right of or at the current tick, return rightmost in the word
            initialized = masked != 0;
            // overflow/underflow is possible, but prevented externally by limiting both tickSpacing and tick
            next = initialized
                ? (compressed - int24(bitPos - BitMath.mostSignificantBit(masked))) * tickSpacing
                : (compressed - int24(bitPos)) * tickSpacing;
        } else {
            // start from the word of the next tick, since the current tick state doesn't matter
            (int16 wordPos, uint8 bitPos) = position(compressed + 1);
            // all the 1s at or to the left of the bitPos
            uint256 mask = ~((1 << bitPos) - 1);
            uint256 masked = pool.tickBitmap(wordPos) & mask;

            // if there are no initialized ticks to the left of the current tick, return leftmost in the word
            initialized = masked != 0;
            // overflow/underflow is possible, but prevented externally by limiting both tickSpacing and tick
            next = initialized
                ? (compressed + 1 + int24(BitMath.leastSignificantBit(masked) - bitPos)) *
                    tickSpacing
                : (compressed + 1 + int24(type(uint8).max - bitPos)) * tickSpacing;
        }
    }
}

/// General swap for uniswap v3 clones that use a non-standard pool init code hash (e.g. ProjectX on HyperEVM)
contract ProjectXV3 is BaseSwap {
    using SafeERC20 for IERC20Ext;
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;
    using BytesLib for bytes;
    using SafeCast for uint256;
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using TickBitmapHyperEvm for IUniswapV3Pool;

    // Arc's native gas token (USDC) has no wrap/unwrap contract: it's exposed at this address
    // as a plain ERC20 view over the same native balance (18-decimal native, 6-decimal ERC20).
    // Swaps into/out of it must convert decimals directly instead of calling deposit()/withdraw()
    // or unwrapWETH9(), none of which exist on this predeploy.
    // Arc routers still report a WETH9() of their own, pointing at a stub that reverts on every
    // call, so native is always the predeploy below, never whatever the router names.
    address internal constant ARC_NATIVE_TOKEN = 0x3600000000000000000000000000000000000000;
    uint256 internal constant ARC_NATIVE_DECIMALS_DIVISOR = 1e12;

    EnumerableSet.AddressSet private uniRouters;

    event UpdatedUniRouters(ISwapRouterHyperEvmInternal[] routers, bool isSupported);

    constructor(address _admin, ISwapRouterHyperEvmInternal[] memory routers) BaseSwap(_admin) {
        for (uint256 i = 0; i < routers.length; i++) {
            uniRouters.add(address(routers[i]));
        }
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

    function getAllUniRouters() external view returns (address[] memory addresses) {
        uint256 length = uniRouters.length();
        addresses = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            addresses[i] = uniRouters.at(i);
        }
    }

    function updateUniRouters(ISwapRouterHyperEvmInternal[] calldata routers, bool isSupported)
        external
        onlyAdmin
    {
        for (uint256 i = 0; i < routers.length; i++) {
            if (isSupported) {
                uniRouters.add(address(routers[i]));
            } else {
                uniRouters.remove(address(routers[i]));
            }
        }
        emit UpdatedUniRouters(routers, isSupported);
    }

    function getExpectedReturn(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        (ISwapRouterHyperEvmInternal router, uint24[] memory fees) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        destAmount = params.srcAmount;
        for (uint256 i = 0; i < params.tradePath.length - 1; i++) {
            destAmount = getAmountOut(
                router,
                destAmount,
                params.tradePath[i],
                params.tradePath[i + 1],
                fees[i]
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
        (ISwapRouterHyperEvmInternal router, uint24[] memory fees) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        destAmount = params.srcAmount;
        uint256 quote = params.srcAmount;
        for (uint256 i = 0; i < params.tradePath.length - 1; i++) {
            destAmount = getAmountOut(
                router,
                destAmount,
                params.tradePath[i],
                params.tradePath[i + 1],
                fees[i]
            );
            quote = getQuote(router, quote, params.tradePath[i], params.tradePath[i + 1], fees[i]);
        }
        if (quote <= destAmount) {
            priceImpact = 0;
        } else {
            priceImpact = quote.sub(destAmount).mul(BPS) / quote;
        }
    }

    function getExpectedIn(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");
        (ISwapRouterHyperEvmInternal router, uint24[] memory fees) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        srcAmount = params.destAmount;
        for (uint256 i = params.tradePath.length - 1; i > 0; i--) {
            srcAmount = getAmountIn(
                router,
                srcAmount,
                params.tradePath[i - 1],
                params.tradePath[i],
                fees[i - 1]
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
        (ISwapRouterHyperEvmInternal router, uint24[] memory fees) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        srcAmount = params.destAmount;
        for (uint256 i = params.tradePath.length - 1; i > 0; i--) {
            srcAmount = getAmountIn(
                router,
                srcAmount,
                params.tradePath[i - 1],
                params.tradePath[i],
                fees[i - 1]
            );
        }
        uint256 quote = srcAmount;
        for (uint256 i = 0; i < params.tradePath.length - 1; i++) {
            quote = getQuote(router, quote, params.tradePath[i], params.tradePath[i + 1], fees[i]);
        }
        if (quote <= params.destAmount) {
            priceImpact = 0;
        } else {
            priceImpact = quote.sub(params.destAmount).mul(BPS) / quote;
        }
    }

    function swap(SwapParams calldata params)
        external
        payable
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(params.tradePath.length >= 2, "invalid tradePath");

        (ISwapRouterHyperEvmInternal router, uint24[] memory fees) = parseExtraArgs(
            params.tradePath.length - 1,
            params.extraArgs
        );

        // native is held as an ERC20 balance at ARC_NATIVE_TOKEN (same balance, two views), so the
        // router is paid by approval + transferFrom rather than the usual msg.value.
        safeApproveAllowance(address(router), IERC20Ext(safeWrapToken(params.tradePath[0])));

        destAmount = getBalance(
            IERC20Ext(params.tradePath[params.tradePath.length - 1]),
            params.recipient
        );

        if (params.tradePath.length == 2) {
            swapExactInputSingle(
                router,
                params.srcAmount,
                params.minDestAmount,
                params.tradePath,
                fees,
                params.recipient
            );
        } else {
            swapExactInput(
                router,
                params.srcAmount,
                params.minDestAmount,
                params.tradePath,
                fees,
                params.recipient
            );
        }

        destAmount = getBalance(
            IERC20Ext(params.tradePath[params.tradePath.length - 1]),
            params.recipient
        ).sub(destAmount);
    }

    function swapExactInput(
        ISwapRouterHyperEvmInternal router,
        uint256 srcAmount,
        uint256 minDestAmount,
        address[] calldata tradePath,
        uint24[] memory fees,
        address recipient
    ) internal {
        bool srcIsNative = tradePath[0] == address(ETH_TOKEN_ADDRESS);
        bool destIsNative = tradePath[tradePath.length - 1] == address(ETH_TOKEN_ADDRESS);

        bytes memory path = abi.encodePacked(safeWrapToken(tradePath[0]));
        for (uint256 i = 0; i < fees.length; i++) {
            path = abi.encodePacked(path, fees[i], safeWrapToken(tradePath[i + 1]));
        }
        ISwapRouter.ExactInputParams memory swapData = ISwapRouter.ExactInputParams({
            path: path,
            recipient: recipient,
            deadline: MAX_AMOUNT,
            amountIn: srcIsNative ? srcAmount / ARC_NATIVE_DECIMALS_DIVISOR : srcAmount,
            amountOutMinimum: destIsNative
                ? minDestAmount / ARC_NATIVE_DECIMALS_DIVISOR
                : minDestAmount
        });

        router.exactInput(swapData);
    }

    function swapExactInputSingle(
        ISwapRouterHyperEvmInternal router,
        uint256 srcAmount,
        uint256 minDestAmount,
        address[] memory tradePath,
        uint24[] memory fees,
        address recipient
    ) internal {
        bool srcIsNative = tradePath[0] == address(ETH_TOKEN_ADDRESS);
        bool destIsNative = tradePath[tradePath.length - 1] == address(ETH_TOKEN_ADDRESS);

        ISwapRouter.ExactInputSingleParams memory swapData = ISwapRouter.ExactInputSingleParams({
            tokenIn: safeWrapToken(tradePath[0]),
            tokenOut: safeWrapToken(tradePath[1]),
            fee: fees[0],
            recipient: recipient,
            deadline: MAX_AMOUNT,
            amountIn: srcIsNative ? srcAmount / ARC_NATIVE_DECIMALS_DIVISOR : srcAmount,
            amountOutMinimum: destIsNative
                ? minDestAmount / ARC_NATIVE_DECIMALS_DIVISOR
                : minDestAmount,
            sqrtPriceLimitX96: 0
        });

        router.exactInputSingle(swapData);
    }

    /// @param extraArgs expecting <[20B] address router><[3B] uint24 poolFee1><[3B] uint24 poolFee2>...
    function parseExtraArgs(uint256 feeLength, bytes calldata extraArgs)
        internal
        view
        returns (ISwapRouterHyperEvmInternal router, uint24[] memory fees)
    {
        fees = new uint24[](feeLength);
        router = ISwapRouterHyperEvmInternal(extraArgs.toAddress(0));
        for (uint256 i = 0; i < feeLength; i++) {
            fees[i] = extraArgs.toUint24(20 + i * 3);
        }
        require(router != ISwapRouterHyperEvmInternal(0), "invalid address");
        require(uniRouters.contains(address(router)), "unsupported router");
    }

    function getAmountOut(
        ISwapRouterHyperEvmInternal router,
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) private view returns (uint256 amountOut) {
        return getAmount(router, amountIn.toInt256(), tokenIn, tokenOut, fee);
    }

    function getAmountIn(
        ISwapRouterHyperEvmInternal router,
        uint256 amountOut,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) private view returns (uint256 amountIn) {
        return getAmount(router, -amountOut.toInt256(), tokenIn, tokenOut, fee);
    }

    function getAmount(
        ISwapRouterHyperEvmInternal router,
        int256 amountSpecified,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) private view returns (uint256 amountOut) {
        IUniswapV3Pool pool = IUniswapV3Pool(
            PoolAddressProjectX.computeAddress(
                router.factory(),
                PoolAddressProjectX.getPoolKey(tokenIn, tokenOut, fee)
            )
        );

        int24 tickSpacing = pool.tickSpacing();

        bool zeroForOne = tokenIn < tokenOut;
        uint160 sqrtPriceLimitX96 = zeroForOne
            ? TickMath.MIN_SQRT_RATIO + 1
            : TickMath.MAX_SQRT_RATIO - 1;

        SwapState memory state;
        state.amountSpecifiedRemaining = amountSpecified;
        state.amountCalculated = 0;
        (state.sqrtPriceX96, state.tick, , , , , ) = pool.slot0();
        state.liquidity = pool.liquidity();
        bool exactInput = amountSpecified > 0;

        while (state.amountSpecifiedRemaining != 0 && state.sqrtPriceX96 != sqrtPriceLimitX96) {
            StepComputations memory step;

            step.sqrtPriceStartX96 = state.sqrtPriceX96;

            (step.tickNext, step.initialized) = pool.nextInitializedTickWithinOneWord(
                state.tick,
                tickSpacing,
                zeroForOne
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
                    zeroForOne
                        ? step.sqrtPriceNextX96 < sqrtPriceLimitX96
                        : step.sqrtPriceNextX96 > sqrtPriceLimitX96
                )
                    ? sqrtPriceLimitX96
                    : step.sqrtPriceNextX96,
                state.liquidity,
                state.amountSpecifiedRemaining,
                fee
            );

            if (exactInput) {
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
                    (, int128 liquidityNet, , , , , , ) = pool.ticks(step.tickNext);

                    if (zeroForOne) liquidityNet = -liquidityNet;
                    state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
                }
                state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
            } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            }
        }

        if (state.amountCalculated < 0) {
            return uint256(-state.amountCalculated);
        }
        return uint256(state.amountCalculated);
    }

    function getQuote(
        ISwapRouterHyperEvmInternal router,
        uint256 quote,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) internal view returns (uint256 quoteOut) {
        IUniswapV3Pool pool = IUniswapV3Pool(
            PoolAddressProjectX.computeAddress(
                router.factory(),
                PoolAddressProjectX.getPoolKey(tokenIn, tokenOut, fee)
            )
        );

        bool zeroForOne = tokenIn < tokenOut;
        SwapState memory state;
        (state.sqrtPriceX96, state.tick, , , , , ) = pool.slot0();
        uint160 sqrtPriceX96 = zeroForOne
            ? state.sqrtPriceX96
            : TickMath.getSqrtRatioAtTick(-state.tick);
        quoteOut = quote.mul(sqrtPriceX96) >> 96;
        quoteOut = quoteOut.mul(sqrtPriceX96) >> 96;
    }

    function safeWrapToken(address token) internal pure returns (address) {
        return token == address(ETH_TOKEN_ADDRESS) ? ARC_NATIVE_TOKEN : token;
    }
}
