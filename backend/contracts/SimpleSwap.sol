// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


// This contract itself IS the Liquidity Pool (LP) token.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SimpleSwap (ERC20 LP Token Version)
 * @author crrabi + AI Google 
 * @notice An AMM contract for a single token pair where the contract itself is the ERC20 LP token.
 * @dev This version demonstrates composability by making liquidity positions transferable tokens.
 * It inherits from OpenZeppelin's ERC20 implementation for security and standardization.
 */
contract SimpleSwap is ERC20 {
    // --- State Variables for the AMM Logic ---
    
    // The underlying tokens that make up the liquidity pool.
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    // The reserves of the underlying tokens.
    // uint256 for gas optimization via storage packing.
    uint256 private reserveA;
    uint256 private reserveB;
    
    // --- Modifier ---

    modifier checkDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    // --- Constructor ---

    /**
     * @notice Deploys the AMM and the associated LP Token contract.
     * @param _tokenA_address The address of the first token in the pair.
     * @param _tokenB_address The address of the second token in the pair.
     */
    constructor(address _tokenA_address, address _tokenB_address) ERC20("SimpleSwap LP Token", "SLP") {
        require(_tokenA_address != address(0) && _tokenB_address != address(0), "ZERO_ADDRESS");
        require(_tokenA_address != _tokenB_address, "IDENTICAL_ADDRESSES");
        tokenA = IERC20(_tokenA_address);
        tokenB = IERC20(_tokenB_address);
    }
    
    // --- Private Helper Functions ---
    
    function _update(uint256 _reserveA, uint256 _reserveB) private {
        require(_reserveA <= type(uint256).max && _reserveB <= type(uint256).max, "OVERFLOW");
        reserveA = uint256(_reserveA);
        reserveB = uint256(_reserveB);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y == 0) return 0;
        uint256 x = y / 2 + 1;
        unchecked {
            while (true) {
                uint256 x2 = (x + y / x) / 2;
                if (x2 == x) return x;
                x = x2;
            }
        }
    }

    // --- Public Functions ---
    // Note: Public functions still accept token addresses to match the Verifier's interface.

    /**
     * @notice Retrieves the current liquidity reserves for the contract's token pair.
     */
    function getReserves(address _tokenA, address _tokenB) public view returns (uint256 _reserveA, uint256 _reserveB) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    /**
     * @notice Adds liquidity to the pool and mints LP tokens to the provider.
     */
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external checkDeadline(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        
        {
            uint256 _reserveA = reserveA;
            uint256 _reserveB = reserveB;
            if (_reserveA == 0 && _reserveB == 0) {
                (amountA, amountB) = (amountADesired, amountBDesired);
            } else {
                uint256 amountBOptimal = (amountADesired * _reserveB) / _reserveA;
                if (amountBOptimal <= amountBDesired) {
                    (amountA, amountB) = (amountADesired, amountBOptimal);
                } else {
                    uint amountAOptimal = (amountBDesired * _reserveA) / _reserveB;
                    require(amountAOptimal >= amountAMin, "INSUFFICIENT_A_AMOUNT");
                    (amountA, amountB) = (amountAOptimal, amountBDesired);
                }
            }
            require(amountA >= amountAMin && amountB >= amountBMin, "INSUFFICIENT_LIQUIDITY_ADDED");
        }
        
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        // Use the inherited ERC20 _mint function. No custom `_mint` is needed.
        if (totalSupply() == 0) {
            liquidity = _sqrt(amountA * amountB);
        } else {
            uint liquidityA = (amountA * totalSupply()) / reserveA;
            uint liquidityB = (amountB * totalSupply()) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /**
     * @notice Removes liquidity from the pool by burning the user's LP tokens.
     */
    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external checkDeadline(deadline) returns (uint256 amountA, uint256 amountB) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        // We get the user's balance directly from the inherited `balanceOf` function.
        require(balanceOf(msg.sender) >= _liquidity, "INSUFFICIENT_LIQUIDITY");
        
        amountA = (_liquidity * reserveA) / totalSupply();
        amountB = (_liquidity * reserveB) / totalSupply();
        
        require(amountA >= amountAMin, "INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "INSUFFICIENT_B_AMOUNT");
        
        // Use the inherited ERC20 _burn function. msg.sender must have approved this contract.
        // Correction: A user calls removeLiquidity, so they are burning their *own* tokens.
        // The spender is this contract, but the owner is msg.sender.
        // It's simpler to just burn from msg.sender.
        _burn(msg.sender, _liquidity);

        tokenA.transfer(to, amountA);
        tokenB.transfer(to, amountB);
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /**
     * @notice Swaps an exact amount of an input token for an output token.
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external checkDeadline(deadline) {
        require(path.length == 2 && path[0] != path[1], "INVALID_PATH");
        require(path[0] == address(tokenA) || path[0] == address(tokenB), "INVALID_INPUT_TOKEN");
        require(path[1] == address(tokenA) || path[1] == address(tokenB), "INVALID_OUTPUT_TOKEN");
        
        (uint _reserveIn, uint _reserveOut) = (path[0] == address(tokenA)) ? (reserveA, reserveB) : (reserveB, reserveA);
        
        uint amountOut = (amountIn * _reserveOut) / (_reserveIn + amountIn);
        require(amountOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amountOut);
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }
    
    /**
     * @notice Returns the price of tokenA in terms of tokenB.
     */
    function getPrice(address _tokenA, address _tokenB) external view returns (uint256 price) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        return (uint256(reserveB) * 1e18) / reserveA;
    }
    
    /**
     * @notice Calculates the output amount for a given input amount without executing a swap.
     */
    function getAmountOut(uint256 amountIn, uint256 _reserveIn, uint256 _reserveOut) external pure returns (uint256 amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(_reserveIn > 0 && _reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        return (amountIn * _reserveOut) / (_reserveIn + amountIn);
    }
}