// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken with Public Faucet
 * @notice An ERC20 token for testing purposes that includes a public faucet function.
 * @dev Any user can call claimTokens() to receive a fixed amount of tokens,
 * subject to a 24-hour cooldown period to prevent abuse.
 */
contract TestToken is ERC20, Ownable {
    // =================================================================================================
    //                                      CONSTANTS
    // =================================================================================================

    /// @notice Fixed amount of tokens minted per claim (100 tokens with 18 decimals).
    uint256 public immutable CLAIM_AMOUNT = 100 * 10**18;
    /// @notice Cooldown period between claims (24 hours in seconds).
    uint256 public immutable COOLDOWN_PERIOD = 24 hours;

    // =================================================================================================
    //                                      STATE VARIABLE
    // =================================================================================================
    /// @notice Tracks the next timestamp when an address can claim tokens again (uint32 for gas savings).
    mapping(address => uint32) public nextClaimTime;

    // =================================================================================================
    //                                             EVENT
    // =================================================================================================

    /// @notice Emitted when a user successfully claims tokens from the faucet.
    event TokensClaimed(address indexed recipient);

    // =================================================================================================
    //                                           CONSTRUCTOR
    // =================================================================================================

    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    // =================================================================================================
    //                                  PUBLIC STATE-CHANGING FUNCTIONS
    // =================================================================================================

    /**
     * @notice Allows the contract owner to mint any amount of tokens.
     * @param to The address that will receive the new tokens.
     * @param amount The quantity of tokens to create.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Allows any user to claim a fixed amount of tokens for free.
     * @dev A 24-hour cooldown is enforced per address to prevent draining the token supply.
     */
    function claimTokens() external {
        // Cache msg.sender for gas savings
        address sender = msg.sender;
        
        // Cooldown check using uint32
        require(block.timestamp >= uint256(nextClaimTime[sender]), "WAIT_24H");
        
        // Set next claim time (uint32 to reduce storage cost)
        nextClaimTime[sender] = uint32(block.timestamp + COOLDOWN_PERIOD);

        // Mint fixed amount
        _mint(sender, CLAIM_AMOUNT);

        // Emit simplified event
        emit TokensClaimed(sender);
    }
}