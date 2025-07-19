// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleSwap (Optimized ERC20 LP Token Version)
 * @author crrabi + AI Google
 * @notice An AMM contract for a single token pair where the contract itself is the ERC20 LP token.
 * @dev This version is optimized to minimize reading and writing state variables and uses short revert strings for gas efficiency,
 * adhering to production-level best practices.
 */
contract SimpleSwap is ERC20 {
    // =================================================================================================
    //                                      STATE VARIABLES
    // =================================================================================================

    /// @notice The immutable contract address of the first token in the liquidity pair (Token A).
    IERC20 public immutable tokenA;
    /// @notice The immutable contract address of the second token in the liquidity pair (Token B).
    IERC20 public immutable tokenB;

    /// @dev The reserve balance of tokenA. Loaded into memory once per transaction for gas savings.
    uint256 private reserveA;
    /// @dev The reserve balance of tokenB. Loaded into memory once per transaction for gas savings.
    uint256 private reserveB;

    // =================================================================================================
    //                                             EVENTS
    // =================================================================================================

    /**
     * @notice Emitted when liquidity is successfully added to the pool.
     * @param sender The address that initiated the liquidity provision. Indexed for searching.
     * @param amountA The amount of tokenA that was deposited into the pool.
     * @param amountB The amount of tokenB that was deposited into the pool.
     * @param liquidity The amount of new LP tokens minted.
     */
    event AddLiquidity(address indexed sender, uint256 amountA, uint256 amountB, uint256 liquidity);
    
    /**
     * @notice Emitted when liquidity is successfully removed from the pool.
     * @param sender The address that initiated the withdrawal (the owner of the burned LP tokens). Indexed for searching.
     * @param to The address that received the withdrawn underlying tokens. Indexed for searching.
     * @param amountA The amount of tokenA that was withdrawn from the pool.
     * @param amountB The amount of tokenB that was withdrawn from the pool.
     * @param burnedLiquidity The amount of LP tokens that were burned.
     */
    event RemoveLiquidity(address indexed sender, address indexed to, uint256 amountA, uint256 amountB, uint256 burnedLiquidity);

    /**
     * @notice Emitted when a token swap is successfully executed.
     * @param sender The address that initiated the swap transaction. Indexed for searching.
     * @param tokenIn The address of the token that was sold to the pool.
     * @param tokenOut The address of the token that was bought from the pool.
     * @param amountIn The amount of the input token provided by the user.
     * @param amountOut The amount of the output token received by the user.
     * @param to The address that received the output tokens from the swap. Indexed for searching.
     */
    event Swap(address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address indexed to);


    // =================================================================================================
    //                                            MODIFIER
    // =================================================================================================

    /**
     * @dev Modifier to ensure a transaction is executed before its specified deadline.
     * @param deadline The timestamp after which the transaction will revert.
     */
    modifier checkDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    // =================================================================================================
    //                                           CONSTRUCTOR
    // =================================================================================================

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
    
    // =================================================================================================
    //                                      PRIVATE HELPER FUNCTIONS
    // =================================================================================================

    /**
     * @dev Synchronizes stored reserves with the contract's actual token balances.
     * This function is the single point of truth for updating the reserve state.
     */
    function _sync() private {
        // Reads from immutable state are highly optimized by the compiler.
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));
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

    // =================================================================================================
    //                                    PUBLIC READ-ONLY FUNCTIONS
    // =================================================================================================

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
     * @notice Returns the spot price of tokenA in terms of tokenB, scaled by 1e18 for precision.
     * @param _tokenA Address of token A. Must match the contract's `tokenA`.
     * @param _tokenB Address of token B. Must match the contract's `tokenB`.
     * @return price The amount of tokenB equivalent to one unit of tokenA.
     */
    function getPrice(address _tokenA, address _tokenB) external view returns (uint256 price) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");

        // OPTIMIZATION: Read state variables into memory ONCE at the start of the function.
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        require(_reserveA > 0 && _reserveB > 0, "NO_LIQUIDITY");

        return (_reserveB * 1e18) / _reserveA;
    }
    
    /**
     * @notice Calculates the output amount for a given input amount without executing a swap.
     * @param amountIn The amount of the input token.
     * @param _reserveIn The liquidity reserve of the input token.
     * @param _reserveOut The liquidity reserve of the output token.
     * @return amountOut The calculated amount of the output token to be received.
     */
    function getAmountOut(uint256 amountIn, uint256 _reserveIn, uint256 _reserveOut) external pure returns (uint256 amountOut) {
        require(amountIn > 0, "ERR_ZERO_INPUT");
        require(_reserveIn > 0 && _reserveOut > 0, "NO_LIQUIDITY");
        return (amountIn * _reserveOut) / (_reserveIn + amountIn);
    }

    // =================================================================================================
    //                                  PUBLIC STATE-CHANGING FUNCTIONS
    // =================================================================================================

    /**
     * @notice Adds liquidity to the pool and mints LP tokens to the provider.
     * @param _tokenA Address of token A. Must match the contract's `tokenA`.
     * @param _tokenB Address of token B. Must match the contract's `tokenB`.
     * @param amountADesired The desired amount of tokenA to add.
     * @param amountBDesired The desired amount of tokenB to add.
     * @param amountAMin The minimum acceptable amount of tokenA to add (slippage protection).
     * @param amountBMin The minimum acceptable amount of tokenB to add (slippage protection).
     * @param to The address that will receive the new LP tokens.
     * @param deadline The Unix timestamp for the transaction deadline.
     * @return amountA The actual amount of tokenA deposited.
     * @return amountB The actual amount of tokenB deposited.
     * @return liquidity The amount of LP tokens minted.
     */
    function addLiquidity(
        address _tokenA, address _tokenB, uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline
    ) external checkDeadline(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "INVALID_TOKENS");

        // OPTIMIZATION: Read state variables into memory ONCE at the start of the function.
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 _totalSupply = totalSupply();

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
        
        if (_totalSupply == 0) {
            liquidity = _sqrt(amountA * amountB);
        } else {
            uint256 liquidityA = (amountA * _totalSupply) / _reserveA;
            uint256 liquidityB = (amountB * _totalSupply) / _reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        require(liquidity > 0, "ERR_MINT_ZERO");

        _mint(to, liquidity);

        _sync();

        emit AddLiquidity(msg.sender, amountA, amountB, liquidity);
    }

    /**
     * @notice Removes liquidity from the pool by burning the user's LP tokens.
     * @param _tokenA Address of token A, must match contract's `tokenA`.
     * @param _tokenB Address of token B, must match contract's `tokenB`.
     * @param _liquidity The amount of LP tokens to burn.
     * @param amountAMin The minimum amount of tokenA to receive back.
     * @param amountBMin The minimum amount of tokenB to receive back.
     * @param to The address that will receive the withdrawn tokens.
     * @param deadline The transaction deadline.
     * @return amountA The actual amount of tokenA withdrawn.
     * @return amountB The actual amount of tokenB withdrawn.
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
        
        amountA = (_liquidity * _reserveA) / _totalSupply;
        amountB = (_liquidity * _reserveB) / _totalSupply;
        
        require(amountA >= amountAMin, "ERR_INSUF_A");
        require(amountB >= amountBMin, "ERR_INSUF_B");
        
        _burn(msg.sender, _liquidity);

        tokenA.transfer(to, amountA);
        tokenB.transfer(to, amountB);

        _sync();

        emit RemoveLiquidity(msg.sender, to, amountA, amountB, _liquidity);
    }

    /**
     * @notice Swaps an exact amount of an input token for an output token.
     * @param amountIn The exact amount of input tokens to swap.
     * @param amountOutMin The minimum acceptable amount of output tokens (slippage protection).
     * @param path An array of token addresses defining the swap route, e.g., [tokenIn, tokenOut].
     * @param to The address that will receive the output tokens.
     * @param deadline The transaction deadline.
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

        _sync();

        emit Swap(msg.sender, path[0], path[1], amountIn, amountOut, to);
    }
}