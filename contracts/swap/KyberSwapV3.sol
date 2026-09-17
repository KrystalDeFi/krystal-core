// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./BaseSwap.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@kyber.network/utils-sc/contracts/IERC20Ext.sol";
import "../libraries/BytesLib.sol";

contract KyberSwapV3 is BaseSwap {
    using SafeERC20 for IERC20Ext;
    using Address for address;
    using BytesLib for bytes;
    using SafeMath for uint256;

    address public router;

    // Real, liquid address for the native token, traded directly as an ERC20 (instead of
    // forwarding msg.value) when nativeIsErc20 is true - see BaseSwap.sol for the rationale
    // (e.g. Arc, where USDC is both the gas token and this address). The off-chain-built
    // extraArgs calldata is expected to already target wNative as the input token in that case.
    address public wNative;
    bool public nativeIsErc20;

    constructor(
        address _admin,
        address _router,
        address _wNative,
        bool _nativeIsErc20
    ) BaseSwap(_admin) {
        router = _router;
        wNative = _wNative;
        nativeIsErc20 = _nativeIsErc20;
    }

    event UpdatedAggregationRouter(address router);
    event UpdatedNativeIsErc20(bool nativeIsErc20);

    function updateAggregationRouter(address _router) external onlyAdmin {
        router = _router;
        emit UpdatedAggregationRouter(router);
    }

    function updateNativeIsErc20(bool _nativeIsErc20) external onlyAdmin {
        nativeIsErc20 = _nativeIsErc20;
        emit UpdatedNativeIsErc20(_nativeIsErc20);
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

    function getExpectedIn(GetExpectedInParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 srcAmount)
    {
        require(false, "getExpectedIn_notSupported");
    }

    /// @dev get expected return and conversion rate if using a Uni router
    function getExpectedReturnWithImpact(GetExpectedReturnParams calldata params)
        external
        view
        override
        onlyProxyContract
        returns (uint256 destAmount, uint256 priceImpact)
    {
        require(false, "getExpectedReturnWithImpact_notSupported");
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

    function swap(SwapParams calldata params)
        external
        payable
        override
        onlyProxyContract
        returns (uint256 destAmount)
    {
        bytes memory encodedSwapData = params.extraArgs;

        uint256 tradeLen = params.tradePath.length;
        IERC20Ext actualSrc = IERC20Ext(params.tradePath[0]);
        IERC20Ext actualDest = IERC20Ext(params.tradePath[tradeLen - 1]);

        bool inputIsNativeErc20 = nativeIsErc20 && actualSrc == ETH_TOKEN_ADDRESS;
        // the sentinel is tradeable here as the plain ERC20 wNative and needs a real allowance,
        // unlike a genuine native asset - see BaseSwap.sol for the rationale
        safeApproveAllowance(address(router), inputIsNativeErc20 ? IERC20Ext(wNative) : actualSrc);

        uint256 destBalanceBefore = getBalance(actualDest, params.recipient);

        bool etherIn = actualSrc == ETH_TOKEN_ADDRESS && !inputIsNativeErc20;
        uint256 callValue = etherIn ? params.srcAmount : 0;

        (bool success, bytes memory returnDestAmount) = payable(router).call{value: callValue}(
            encodedSwapData
        );
        require(success, "swapByKyberSwapV3: failed");

        destAmount = decodeSwapResponse(returnDestAmount);
    }

    function decodeSwapResponse(bytes memory data)
        internal
        pure
        returns (uint256 decodedResponse)
    {
        decodedResponse = abi.decode(data, (uint256));
    }
}
