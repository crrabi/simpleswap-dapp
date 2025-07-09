// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @author crrabi + AI Developer Assistant
 * @notice A simple ERC20 token for testing purposes with a public minting function.
 * @dev Inherits from OpenZeppelin's ERC20 and Ownable contracts.
 */
contract TestToken is ERC20, Ownable {
    /**
     * @dev The constructor initializes the token with a name and symbol.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     */
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable (msg.sender) {
        // The deployer of the contract is set as the owner automatically.
    }

    /**
     * @notice Mints a specified amount of tokens to a given address.
     * @dev Can only be called by the owner of the contract.
     * @param to The address to mint tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}