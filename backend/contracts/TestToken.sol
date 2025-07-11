// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken with Public Faucet
 * @notice An ERC20 token for testing purposes that includes a public faucet function.
 * @dev Any user can call claimTokens() to receive a fixed amount of tokens,
 * subject to a 24-hour cooldown period to prevent abuse.
 */
contract TestToken is ERC20, Ownable {
    // --- State for Faucet Cooldown ---
    /// @notice Tracks the next timestamp when an address can claim tokens again.
    mapping(address => uint256) public nextClaimTime;

    // --- Events ---
    /// @notice Emitted when a user successfully claims tokens from the faucet.
    event TokensClaimed(address indexed recipient, uint256 amount);

    // --- Constructor ---
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    // --- Owner-Only Minting ---
    /**
     * @notice Allows the contract owner to mint any amount of tokens.
     * @dev This is for initial setup or administrative purposes.
     * @param to The address that will receive the new tokens.
     * @param amount The quantity of tokens to create.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    // --- Public Faucet Function ---
    /**
     * @notice Allows any user to claim a fixed amount of tokens for free.
     * @dev A 24-hour cooldown is enforced per address to prevent draining the token supply.
     */
    function claimTokens() external {
        // Cooldown check: Prevents the same user from claiming tokens too frequently.
        require(block.timestamp >= nextClaimTime[msg.sender], "WAIT_24H");
        
        // Set the next available claim time for this user to 24 hours from now.
        nextClaimTime[msg.sender] = block.timestamp + 24 hours;

        // Mint 100 new tokens to the caller.
        uint256 claimAmount = 100 * 10**18;
        _mint(msg.sender, claimAmount);

        // Emit an event to log the faucet usage.
        emit TokensClaimed(msg.sender, claimAmount);
    }
}