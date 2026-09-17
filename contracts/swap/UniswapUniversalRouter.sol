// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./BaseSwap.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@kyber.network/utils-sc/contracts/IERC20Ext.sol";

contract UniswapUniversalRouter is BaseSwap {
    using SafeERC20 for IERC20Ext;
    using SafeMath for uint256;

    // Arc's native gas token (USDC) has no wrap/unwrap contract: it's exposed at this address
    // as a plain ERC20 view over the same native balance. A native-input swap here can't send
    // msg.value like on a real ETH chain — it needs the swapProxy pulling the ERC20 balance instead.
    uint256 internal constant ARC_CHAIN_ID = 5042;
    address internal constant ARC_NATIVE_TOKEN = 0x3600000000000000000000000000000000000000;

    // Constant-address proxy (same address on every chain) used to stage ERC20 inputs into the
    // Universal Router without a signed Permit2 message: it does transferFrom(caller, UR, amount)
    // then calls UR.execute(...). Native ETH inputs bypass it and call the Universal Router directly,
    // per Uniswap's own SwapProxy docs.
    address public swapProxy;
    address public universalRouter;

    event UpdatedSwapProxy(address swapProxy);
    event UpdatedUniversalRouter(address universalRouter);

    constructor(
        address _admin,
        address _swapProxy,
        address _universalRouter
    ) BaseSwap(_admin) {
        swapProxy = _swapProxy;
        universalRouter = _universalRouter;
    }

    function updateSwapProxy(address _swapProxy) external onlyAdmin {
        swapProxy = _swapProxy;
        emit UpdatedSwapProxy(swapProxy);
    }

    function updateUniversalRouter(address _universalRouter) external onlyAdmin {
        universalRouter = _universalRouter;
        emit UpdatedUniversalRouter(universalRouter);
    }

    /// @dev get expected return and conversion rate if using a Uni router
    function getExpectedReturn(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(false, "getExpectedReturn_notSupported");
    }

    function getExpectedReturnWithImpact(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount, uint256 priceImpact)
    {
        require(false, "getExpectedReturnWithImpact_notSupported");
    }

    function getExpectedIn(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount)
    {
        require(false, "getExpectedIn_notSupported");
    }

    function getExpectedInWithImpact(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount, uint256 priceImpact)
    {
        require(false, "getExpectedInWithImpact_notSupported");
    }

    /// @dev swap token
    /// @notice
    /// Uniswap's Trading API (called with x-permit2-disabled) returns the calldata to build this tx.
    /// For ERC20 inputs, that calldata targets `swapProxy`, which pulls the input token via a plain
    /// ERC20 allowance (no Permit2 signature) and forwards it into the Universal Router.
    /// For native ETH inputs, calldata targets `universalRouter` directly, sent with msg.value.
    /// The commands encoded in extraArgs MUST set the swap recipient to this contract's own address
    /// (not MSG_SENDER, which resolves to `swapProxy` inside the router's execution context, not to
    /// us) so we can measure the amount actually received and forward it to params.recipient.
    function swap(SwapParams calldata params)
        external
        payable
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        require(params.tradePath.length == 2, "uniswapUniversalRouter_invalidTradepath");

        IERC20Ext actualDest = IERC20Ext(params.tradePath[params.tradePath.length - 1]);
        uint256 destBalanceBefore = getBalance(actualDest, address(this));

        bool etherIn = IERC20Ext(params.tradePath[0]) == ETH_TOKEN_ADDRESS;
        bool isArcNative = etherIn && _chainId() == ARC_CHAIN_ID;
        if (etherIn && !isArcNative) {
            (bool success, ) = universalRouter.call{value: params.srcAmount}(params.extraArgs);
            require(success, "uniswapUniversalRouter_invalidExtraArgs");
        } else {
            safeApproveAllowance(
                swapProxy,
                IERC20Ext(isArcNative ? ARC_NATIVE_TOKEN : params.tradePath[0])
            );
            (bool success, ) = swapProxy.call(params.extraArgs);
            require(success, "uniswapUniversalRouter_invalidExtraArgs");
        }

        uint256 returnAmount = getBalance(actualDest, address(this)).sub(destBalanceBefore);
        return safeTransferTo(payable(params.recipient), actualDest, returnAmount);
    }

    /// @dev Solidity 0.7.x has no block.chainid; the CHAINID opcode has been available since
    /// Constantinople.
    function _chainId() internal pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function safeTransferTo(
        address payable to,
        IERC20Ext tokenErc,
        uint256 amount
    ) internal returns (uint256 amountTransferred) {
        if (tokenErc == ETH_TOKEN_ADDRESS) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "transfer failed");
            amountTransferred = amount;
        } else {
            uint256 balanceBefore = tokenErc.balanceOf(to);
            tokenErc.safeTransfer(to, amount);
            amountTransferred = tokenErc.balanceOf(to).sub(balanceBefore);
        }
    }
}
