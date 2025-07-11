// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleSwap (Optimized ERC20 LP Token Version)
 * @author crrabi + AI Google
 * @notice An AMM contract for a single token pair where the contract itself is the ERC20 LP token.
 * @dev This version is optimized to minimize state reads and uses short revert strings for gas efficiency,
 * adhering to production-level best practices.
 */
contract SimpleSwap is ERC20 {
    // --- State Variables ---
    
    /// @notice The immutable contract address of the first token in the liquidity pair (Token A).
    IERC20 public immutable tokenA;
    /// @notice The immutable contract address of the second token in the liquidity pair (Token B).
    IERC20 public immutable tokenB;

    /// @dev The reserve balance of tokenA. Loaded into memory once per transaction for gas savings.
    uint256 private reserveA;
    /// @dev The reserve balance of tokenB. Loaded into memory once per transaction for gas savings.
    uint256 private reserveB;

    // --- Modifier ---
    
    /**
     * @dev Modifier to ensure a transaction is executed before its specified deadline.
     * @param deadline The timestamp after which the transaction will revert.
     */
    modifier checkDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    // --- Constructor ---

    /**
     * @notice Deploys the AMM and initializes the LP Token with a name and symbol.
     * @param _tokenA_address The contract address of the first token in the pair.
     * @param _tokenB_address The contract address of the second token in the pair.
     */
    constructor(
        address _tokenA_address,
        address _tokenB_address
    ) ERC20("SimpleSwap LP", "SLP") { 
        require(_tokenA_address != address(0) && _tokenB_address != address(0), "ZERO_ADDRESS");
        require(_tokenA_address != _tokenB_address, "IDENTICAL_ADDR");
        tokenA = IERC20(_tokenA_address);
        tokenB = IERC20(_tokenB_address);
    }
    
    // --- Private Helper Functions ---
    
    /**
     * @dev Internal function to update the stored reserves.
     * @param _reserveA The new reserve amount for tokenA.
     * @param _reserveB The new reserve amount for tokenB.
     */
    function _update(uint256 _reserveA, uint256 _reserveB) private {
        reserveA = _reserveA;
        reserveB = _reserveB;
    }

    /**
     * @dev Calculates the square root of a number using the Babylonian method.
     * @param y The number for which to calculate the square root.
     * @return z The integer square root of y.
     */
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

    /**
     * @notice Retrieves the current liquidity reserves for the contract's token pair.
     * @param _tokenA Must match the tokenA address set at deployment.
     * @param _tokenB Must match the tokenB address set at deployment.
     * @return _reserveA The reserve amount of the contract's tokenA.
     * @return _reserveB The reserve amount of the contract's tokenB.
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
        address _tokenA, address _tokenB, uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline
    ) external checkDeadline(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        
        // OPTIMIZATION: Read state variables into memory ONCE at the start of the function.
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        
        if (_reserveA == 0 && _reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = (amountADesired * _reserveB) / _reserveA;
            if (amountBOptimal <= amountBDesired) {
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * _reserveA) / _reserveB;
                require(amountAOptimal >= amountAMin, "ERR_INSUF_A");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
        require(amountA >= amountAMin && amountB >= amountBMin, "ERR_INSUF_LIQ");
        
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        // OPTIMIZATION: Read totalSupply state ONCE.
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = _sqrt(amountA * amountB);
        } else {
            // All subsequent calculations use the memory variables _reserveA and _totalSupply.
            uint256 liquidityA = (amountA * _totalSupply) / _reserveA;
            uint256 liquidityB = (amountB * _totalSupply) / _reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        require(liquidity > 0, "ERR_MINT_ZERO");
        _mint(to, liquidity);
        
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /**
     * @notice Removes liquidity from the pool by burning the user's LP tokens.
     */
    function removeLiquidity(
        address _tokenA, address _tokenB, uint256 _liquidity, uint256 amountAMin,
        uint256 amountBMin, address to, uint256 deadline
    ) external checkDeadline(deadline) returns (uint256 amountA, uint256 amountB) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        require(balanceOf(msg.sender) >= _liquidity, "ERR_LP_BALANCE");
        
        // OPTIMIZATION: Read state variables ONCE.
        uint256 _totalSupply = totalSupply();
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        
        // Calculations use memory variables for efficiency.
        amountA = (_liquidity * _reserveA) / _totalSupply;
        amountB = (_liquidity * _reserveB) / _totalSupply;
        
        require(amountA >= amountAMin, "ERR_INSUF_A");
        require(amountB >= amountBMin, "ERR_INSUF_B");
        
        _burn(msg.sender, _liquidity);
        tokenA.transfer(to, amountA);
        tokenB.transfer(to, amountB);
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /**
     * @notice Swaps an exact amount of an input token for an output token.
     */
    function swapExactTokensForTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline
    ) external checkDeadline(deadline) {
        require(path.length == 2 && path[0] != path[1], "INVALID_PATH");
        require(path[0] == address(tokenA) || path[0] == address(tokenB), "INVALID_IN_TOKEN");
        require(path[1] == address(tokenA) || path[1] == address(tokenB), "INVALID_OUT_TOKEN");
        
        // OPTIMIZATION: Read reserves into memory based on swap path.
        (uint256 _reserveIn, uint256 _reserveOut) = (path[0] == address(tokenA)) ? (reserveA, reserveB) : (reserveB, reserveA);
        
        uint256 amountOut = (amountIn * _reserveOut) / (_reserveIn + amountIn);
        require(amountOut >= amountOutMin, "ERR_LOW_OUTPUT");
        
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amountOut);
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }
    
    /**
     * @notice Returns the price of tokenA in terms of tokenB, scaled by 1e18.
     */
    function getPrice(address _tokenA, address _tokenB) external view returns (uint256 price) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");
        // Reading state is acceptable in view functions as they don't consume user gas for execution.
        require(reserveA > 0 && reserveB > 0, "NO_LIQUIDITY");
        return (reserveB * 1e18) / reserveA;
    }
    
    /**
     * @notice Calculates the output amount for a given input amount without executing a swap.
     */
    function getAmountOut(uint256 amountIn, uint256 _reserveIn, uint256 _reserveOut) external pure returns (uint256 amountOut) {
        require(amountIn > 0, "ERR_ZERO_INPUT");
        require(_reserveIn > 0 && _reserveOut > 0, "NO_LIQUIDITY");
        return (amountIn * _reserveOut) / (_reserveIn + amountIn);
    }
}