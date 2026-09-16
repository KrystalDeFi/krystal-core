// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mintable ERC20 with configurable decimals, for unit-testing swap contracts
/// against tokens whose decimals differ from the native sentinel's assumed 18 (e.g. Arc's USDC).
contract MockERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _setupDecimals(decimals_);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
