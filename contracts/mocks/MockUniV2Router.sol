// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal Uniswap V2 router stand-in for unit-testing UniSwap.sol's decimal handling. Only
/// implements the one function UniSwap.sol actually calls for a plain ERC20<->ERC20 trade
/// (matching IUniswapV2Router02's selector exactly), paying out a fixed amount so tests can
/// assert on the *input* amount the router actually received.
contract MockUniV2Router {
    uint256 public fixedAmountOut;
    uint256 public lastAmountIn;
    uint256 public lastAmountOutMin;

    constructor(uint256 _fixedAmountOut) {
        fixedAmountOut = _fixedAmountOut;
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external {
        require(fixedAmountOut >= amountOutMin, "mock: below min");
        lastAmountIn = amountIn;
        lastAmountOutMin = amountOutMin;
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).transfer(to, fixedAmountOut);
    }
}
