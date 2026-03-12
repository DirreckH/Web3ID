// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockRWAAsset is ERC20, Ownable {
    address public minter;

    error InvalidMinter();
    error UnauthorizedMinter();

    constructor() ERC20("Mock RWA Asset", "MRWA") Ownable(msg.sender) {}

    function setMinter(address minter_) external onlyOwner {
        if (minter_ == address(0)) revert InvalidMinter();
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert UnauthorizedMinter();
        _mint(to, amount);
    }
}
