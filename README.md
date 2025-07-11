# SimpleSwap DApp: A Full-Stack Decentralized Application

## 1. Project Overview 📜

This repository contains the complete implementation of the **SimpleSwap DApp**, a full-stack project built for Module 4 of the Ethereum Developer KIPU Program . It features a robust smart contract backend developed with Hardhat and a reactive, user-friendly frontend built with React, Vite, and Ethers.js.

The project's primary goal was to create a functional interface for a custom Automated Market Maker (AMM) smart contract. This involved not only frontend development but also a deep refinement of the smart contract based on professional feedback, the implementation of a comprehensive testing suite achieving over 95% coverage, and a live deployment to the Sepolia testnet.

This document serves as a detailed technical summary of the project's architecture, development process, and the challenges overcome to achieve a production-quality result. The development was assisted by a generative AI model, which supported debugging, code optimization, and documentation.

---

## 2. Smart Contract Architecture 🏛️

The backend development was focused on iterating and refining the `SimpleSwap` contract to meet the highest standards of security, gas efficiency, and DeFi best practices.

### 2.1. Final Deployed Contracts on Sepolia

The on-chain infrastructure consists of three smart contracts, all successfully deployed and verified on the Sepolia testnet:

1.  **`SimpleSwap` (LP Token - "SLP")**
    *   **Address:** [`0x1ccAa460Db3E7340ef0d54a361ed208423D7Fa22`](https://sepolia.etherscan.io/address/0x1ccAa460Db3E7340ef0d54a361ed208423D7Fa22)
    *   **Design:** An elegant AMM for a single, immutable token pair. Following advanced DeFi patterns, the contract inherits from OpenZeppelin's `ERC20.sol` standard, making the contract **itself** the Liquidity Pool (LP) token. This design choice makes liquidity positions fully composable and interoperable with the broader DeFi ecosystem.
    *   **Optimizations:**
        *   **Minimized State Reads:** All functions that modify state first load state variables (`reserves`, `totalSupply`) into memory once. All subsequent calculations use these memory variables, significantly reducing gas costs on `SLOAD` opcodes.
        *   **Gas-Efficient Reverts:** `require` statements use short, concise error strings to minimize the contract's bytecode size and reduce deployment costs.

2.  **`TestToken` Contracts (Token A & Token B)**
    *   **Token A ("Token A", TKA):** [`0x557F10E00e315ec431d1ECf855d1B08674a0e43B`](https://sepolia.etherscan.io/address/0x557F10E00e315ec431d1ECf855d1B08674a0e43B)
    *   **Token B ("Token B", TKB):** [`0x41461235F6C59750d841D5d59A3aD01fC95804e5`](https://sepolia.etherscan.io/address/0x41461235F6C59750d841D5d59A3aD01fC95804e5)
    *   **Key Feature - Public Faucet:** Both token contracts include a public `claimTokens()` function. This allows **any user** to receive 100 free test tokens, with a 24-hour cooldown per address to prevent abuse. This feature was implemented to ensure the DApp is fully accessible and testable by anyone, fulfilling a key project requirement.
As a final validation, the deployed `SimpleSwap` contract successfully passed all checks from the `SwapVerifier` contract of Module 3, with authorship recorded on-chain: **`authors[139] = crrabi-SimpleSwap_TP4fixedfaucet`**.

### 2.2. Test-Driven Development and Coverage

A comprehensive test suite was developed using Hardhat and Chai, going far beyond the minimum 50% coverage requirement. The process was iterative:

1.  **Initial Tests ("Happy Path"):** The first suite focused on successful execution of core functions, which revealed a low **Branch Coverage (~41%)**, indicating untested error conditions.

2.  **Expanded Tests (Edge Cases & Reverts):** The test suite (`test/SimpleSwap.test.ts`) was systematically expanded with **16 total tests** to cover reverts and edge cases. This included testing for: expired deadlines, invalid parameters, insufficient balances, slippage protection, and all logical branches within the AMM calculations.

3.  **Final Coverage Results:** The final test suite achieved outstanding coverage metrics, demonstrating the contract's robustness:
    -   **Statements: 96.67%**
    -   **Branches: 76.47%**
    -   **Functions: 100%**
    -   **Lines: 97.33%**

      <img width="852" height="363" alt="image" src="https://github.com/user-attachments/assets/bc640ab0-3149-41db-8958-a2f13e8475c5" />
      <img width="822" height="457" alt="image" src="https://github.com/user-attachments/assets/8ddedfcc-c39b-4bb7-b3b8-4c34b763d394" />
      <img width="810" height="649" alt="image" src="https://github.com/user-attachments/assets/ed1bddfa-4ccb-489e-9b3b-a9e02da7be0c" />
      <img width="805" height="673" alt="image" src="https://github.com/user-attachments/assets/ac42b02d-1cf0-4a1a-9399-c3663b059081" />

---

## 3. Frontend Development 🖥️

The frontend provides a clean, intuitive, and reactive user interface for the `SimpleSwap` contract.

### 3.1. Technology Stack

-   **Framework:** **React** with **TypeScript**
-   **Build Tool:** **Vite** for a fast and modern development workflow.
-   **Blockchain Interaction:** **Ethers.js v6** for connecting to user wallets and interacting with smart contracts.

### 3.2. Features & Components

-   **Wallet Connection:** Securely connects to MetaMask and listens for account or network changes.
-   **Live Price Viewer:** A `PriceViewer.tsx` component that periodically calls the `getPrice` function to display the real-time TKA/TKB exchange rate.
-   **Token Swap UI:** A central `SwapUI.tsx` component that allows users to input an amount, see a live quote for the output (using `getAmountOut`), and execute a swap after token approval.
-   **Public Faucet UI:** A `Faucet.tsx` component that provides a simple interface for any user to call the `claimTokens` function on the token contracts, making the DApp easy to test.

### 3.3. Key Implementation Challenges & Solutions

-   **Monorepo ABI Imports:** Resolved the "module not found" error from Vite by creating a `copy-abis.mjs` script. This script, compatible with modern ES Modules via `import.meta.url`, copies the contract ABIs from the `backend` to the `frontend` directory, making them accessible to the application.
-   **Ethers.js v6 Compatibility:** Fixed a common runtime syntax error by refactoring type imports to use the correct `ethers.Signer` namespace, ensuring compatibility with the latest version of the library.

---

## 4. Live Deployment and Access 🚀

The SimpleSwap DApp has been successfully deployed and is publicly accessible.

-   **Platform:** **Vercel** was used to host the frontend, configured to build from the `frontend` directory of this monorepo.
-   **Process:** Vercel automatically deploys new versions on every push to the `main` branch, creating a seamless CI/CD (Continuous Integration/Continuous Deployment) workflow.

**You can access, test, and use the live DApp at the following URL:**

### **[https://simpleswap-dapp-delta.vercel.app/](https://simpleswap-dapp-delta.vercel.app/)**
