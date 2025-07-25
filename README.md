# SimpleSwap DApp: A Full-Stack Decentralized Application

## 1. Project Overview 📜

This repository contains the complete implementation of the **SimpleSwap DApp**, a full-stack project built for Module 4 of the Ethereum KIPU Developer Pack. It features a robust smart contract backend developed with Hardhat and a reactive, user-friendly frontend built with React, Vite, and Ethers.js.

The project's primary goal was to create a functional interface for a custom Automated Market Maker (AMM) smart contract. This involved not only frontend development but also a deep refinement of the smart contract based on professional feedback, the implementation of a comprehensive testing suite achieving over 98% coverage, and a live deployment to the Sepolia testnet.

This document serves as a detailed technical summary of the project's architecture, development process, and the challenges overcome to achieve a production-quality result. The development was assisted by a generative AI model, which supported debugging, code optimization, and documentation.

---

## 2. Smart Contract Architecture 🏛️

The backend development was focused on iterating and refining the contracts to meet the highest standards of security, gas efficiency, and DeFi best practices.

### 2.1. Final Deployed Contracts on Sepolia

The on-chain infrastructure consists of three smart contracts, all successfully deployed and verified on the Sepolia testnet:

1.  **`SimpleSwap` (LP Token - "SLP")**
    *   **Address:** [`0x3A3c54b2A079774381Fe9Cc62FB092953D07f20c`](https://sepolia.etherscan.io/address/0x3A3c54b2A079774381Fe9Cc62FB092953D07f20c)
    *   **Design:** An elegant AMM for a single, immutable token pair. It inherits from OpenZeppelin's `ERC20.sol` standard, making the contract **itself** a fully composable LP token. This makes liquidity positions transferable and compatible with the broader DeFi ecosystem.

2.  **`TestToken` Contracts (Token A & Token B)**
    *   **Token A ("Token A", TKA):** [`0x763a75Db7a2A8cd6E5fdd8f03537CdB1EeA124BC`](https://sepolia.etherscan.io/address/0x763a75Db7a2A8cd6E5fdd8f03537CdB1EeA124BC)
    *   **Token B ("Token B", TKB):** [`0x3D14300bC1113EC49c9689eC3d1214636c79C91A`](https://sepolia.etherscan.io/address/0x3D14300bC1113EC49c9689eC3d1214636c79C91A)

### 2.2. Detailed Contract Breakdown

#### SimpleSwap Contract

The `SimpleSwap` contract is the core of the application, managing the liquidity pool and token swaps.

-   **Key Functions:**
    -   `addLiquidity()`: Allows users to deposit a pair of tokens and receive LP tokens in return. The logic differentiates between the first liquidity provider (who sets the price) and subsequent providers (who must match the existing price ratio).
    -   `removeLiquidity()`: Allows users to burn their LP tokens to withdraw their proportional share of the underlying tokens.
    -   `swapExactTokensForTokens()`: Executes a trade based on the constant product formula, allowing a user to swap a precise amount of one token for a calculated amount of the other.
    -   `getReserves()`, `getPrice()`, `getAmountOut()`: Public read-only functions that provide crucial on-chain data for the frontend and other smart contracts.

-   **Events:** To align with professional standards for on-chain observability, the contract emits events for every critical state change:
    -   `AddLiquidity`: Fired when liquidity is successfully deposited.
    -   `RemoveLiquidity`: Fired when liquidity is successfully withdrawn.
    -   `Swap`: Fired every time a trade is executed.
    These events are essential for frontends to track transaction outcomes and for off-chain services to index the contract's activity.

-   **Gas and State Management Optimization:**
    A core principle in the final design is the rigorous optimization of state reads to minimize gas costs.
    -   **"Read-Once" Pattern:** In every state-changing function, all mutable state variables (like `reserveA`, `reserveB`, `totalSupply`) are read into local memory variables **once** at the beginning of the function. All subsequent logic within that function operates on these cheaper memory variables, avoiding repeated and costly `SLOAD` opcodes.
    -   **Handling `immutable` vs. Mutable State:** Through investigation, it was confirmed that the Solidity compiler heavily optimizes reads from `immutable` variables (`tokenA`, `tokenB`). Therefore, the "read-once" pattern was consciously **not applied** to these variables, as it did not provide significant gas savings and would have introduced the risk of **"Stack Too Deep"** errors. This pragmatic approach avoids issues with the standard Remix compiler (without `viaIR` enabled) and keeps the code cleaner, while still optimizing the most expensive state reads.

#### TestToken Contract

The `TestToken` is a utility contract that enables the DApp to be fully functional and testable by anyone on the testnet.

-   **Key Functions:**
    -   `mint()`: An `onlyOwner` function for the contract administrator to create an initial supply or perform administrative minting.
    -   **`claimTokens()` (Public Faucet):** The most important feature. This function allows **any user** to call it and receive 100 free test tokens. To prevent abuse, it includes a **24-hour cooldown** mechanism per address, making the DApp accessible without centralized token distribution.
-   **Gas Optimizations:**
    -   The `CLAIM_AMOUNT` and `COOLDOWN_PERIOD` are defined as `immutable` constants.
    -   The `nextClaimTime` mapping uses `uint32` instead of `uint256`, significantly reducing the storage cost (`SSTORE`) for each faucet claim.

### 2.3. Test-Driven Development and Coverage

The project was developed with a strong emphasis on testing, using Hardhat and Chai to far exceed the minimum 50% coverage requirement.

-   **Process:** The test suite evolved from covering only "happy path" scenarios (**~41% Branch Coverage**) to a comprehensive suite of **15 tests**. The final suite validates edge cases, slippage protection, and every single `require` statement.
-   **Final Coverage Results:** The rigorous testing strategy culminated in outstanding coverage metrics:
    -   **Statements: 98.46%**
    -   **Branches: 79.41%**
    -   **Functions: 100%**
    -   **Lines: 98.75%**

As a final validation, the deployed `SimpleSwap` contract successfully passed all checks from the `SwapVerifier` contract from Module 3, with authorship recorded on-chain: **`authors[150] = crrabi_TP4fixedfaucetoptimized`**.

<img width="867" height="419" alt="image" src="https://github.com/user-attachments/assets/f6829b19-49dd-4232-843c-af2772c20793" />
<img width="853" height="570" alt="image" src="https://github.com/user-attachments/assets/8e8579eb-c7cf-4ef1-b108-ea529fb4f9ae" />
<img width="853" height="301" alt="image" src="https://github.com/user-attachments/assets/d1224dd9-5e18-4e5e-8270-8e4dba0ffbb0" />
<img width="832" height="617" alt="image" src="https://github.com/user-attachments/assets/713b736c-17b7-471a-bb8e-882cd21dcf9e" />



---

## 3. Frontend Development 🖥️

The frontend provides a clean, intuitive, and fully-featured user interface for the `SimpleSwap` contract.

### 3.1. Technology Stack

-   **Framework:** **React** with **TypeScript**
-   **Build Tool:** **Vite**
-   **Blockchain Interaction:** **Ethers.js v6**

### 3.2. Final Features & Components

The final DApp includes a complete set of features for a functional user experience:

-   **Wallet Connection:** Securely connects to MetaMask and gracefully handles account and network changes.
-   **Bidirectional Swapping:** The core `SwapUI.tsx` component now allows users to swap not only from **Token A to Token B**, but also from **Token B to Token A**, thanks to a "flip" button that dynamically updates the trade path and logic.
-   **Real-time Data Display:**
    -   A `PriceViewer.tsx` component that periodically calls `getPrice` to show the live exchange rate.
    -   **A new `PoolInfo.tsx` component** that displays the total liquidity of the pool by fetching the current `reserves` and the total `totalSupply` of the LP tokens. This adds a crucial layer of transparency for users.
-   **Public Faucet UI:** A `Faucet.tsx` component provides a simple "one-click" interface for any user to claim free test tokens, enabling seamless onboarding.
-   **Fully Responsive Design:** The entire application was styled with a **mobile-first approach** using CSS media queries. The layout automatically adjusts on screens smaller than 600px, stacking elements and resizing fonts to ensure a smooth and accessible experience on any device without horizontal scrolling.

### 3.3. Key Implementation Challenges & Solutions

-   **Monorepo ABI Imports:** Resolved a Vite build error by creating a `copy-abis.mjs` script to copy contract ABIs from the `backend` to a local `frontend/src/abis/` directory.
-   **Ethers.js v6 Compatibility:** Fixed a common runtime error by refactoring type imports to use the correct `ethers.Signer` namespace, ensuring compatibility with the latest version of the library.

---

## 4. Live Deployment and Access 🚀

The SimpleSwap DApp has been successfully deployed and is publicly accessible.

-   **Platform:** **Vercel** was used to host the frontend, configured to build from the `frontend` directory of this monorepo.
-   **Process:** Vercel automatically deploys new versions on every push to the `main` branch, creating a seamless CI/CD workflow.

**You can access, test, and use the live DApp at the following URL:**

### **[https://simpleswap-dapp-delta.vercel.app/](https://simpleswap-dapp-delta.vercel.app/)**
