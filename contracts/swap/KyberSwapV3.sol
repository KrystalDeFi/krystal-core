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

    // Arc's native gas token (USDC) has no wrap/unwrap contract: it's exposed at this address
    // as a plain ERC20 view over the same native balance. A native-input swap here can't send
    // msg.value like on a real ETH chain — it needs the router pulling the ERC20 balance instead.
    uint256 internal constant ARC_CHAIN_ID = 5042;
    address internal constant ARC_NATIVE_TOKEN = 0x3600000000000000000000000000000000000000;

    address public router;

    constructor(address _admin, address _router) BaseSwap(_admin) {
        router = _router;
    }

    event UpdatedAggregationRouter(address router);

    function updateAggregationRouter(address _router) external onlyAdmin {
        router = _router;
        emit UpdatedAggregationRouter(router);
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
        bool etherIn = IERC20Ext(params.tradePath[0]) == ETH_TOKEN_ADDRESS;
        bool isArcNative = etherIn && _chainId() == ARC_CHAIN_ID;

        safeApproveAllowance(
            address(router),
            IERC20Ext(isArcNative ? ARC_NATIVE_TOKEN : params.tradePath[0])
        );

        bytes memory encodedSwapData = params.extraArgs;

        uint256 tradeLen = params.tradePath.length;
        IERC20Ext actualDest = IERC20Ext(params.tradePath[tradeLen - 1]);

        uint256 destBalanceBefore = getBalance(actualDest, params.recipient);

        uint256 callValue = (etherIn && !isArcNative) ? params.srcAmount : 0;

        (bool success, bytes memory returnDestAmount) = payable(router).call{value: callValue}(
            encodedSwapData
        );
        require(success, "swapByKyberSwapV3: failed");

        destAmount = decodeSwapResponse(returnDestAmount);
    }

    /// @dev Solidity 0.7.x has no block.chainid; the CHAINID opcode has been available since
    /// Constantinople.
    function _chainId() internal pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function decodeSwapResponse(bytes memory data)
        internal
        pure
        returns (uint256 decodedResponse)
    {
        decodedResponse = abi.decode(data, (uint256));
    }
}
