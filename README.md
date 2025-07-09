# SimpleSwap DApp: A Full-Stack Decentralized Application

## 1. Project Overview 📜

This repository contains the complete implementation of the **SimpleSwap DApp**, a full-stack project developed for Module 4. It includes a smart contract backend powered by Hardhat and a reactive frontend built with React, Vite, and ethers.js.

The primary goal of this project was to build a functional user interface for the `SimpleSwap` smart contract, while also implementing a robust testing environment to ensure contract reliability, achieving over 90% test coverage.

The project follows a **monorepo structure**, with distinct `backend` and `frontend` directories, allowing for modular and organized development.

This document details the architecture, development process, and technical challenges overcome during the project's lifecycle.

---

## 2. Smart Contract Backend ⚙️

The backend development was managed using **Hardhat**, a professional Ethereum development environment. The focus was on refining the smart contract based on expert feedback and building a comprehensive test suite.

### 2.1. Contract Refinement

The initial `SimpleSwap` contract from Module 3 was significantly improved based on feedback from the professor, adhering to best practices in smart contract design:

1.  **Single-Pair Architecture:** The contract was refactored to manage only a single, immutable pair of tokens, which are set at deployment time. This simplified the logic, reduced gas costs, and minimized the attack surface by removing the complexity of multi-pool management (`_getPairId`, `_sortTokens`, etc.).

2.  **ERC20-Compliant LP Token:** The contract now inherits from OpenZeppelin's standard `ERC20.sol` implementation. Instead of using a simple internal mapping to track liquidity providers' shares, the `SimpleSwap` contract **is** itself a fully-fledged, composable ERC20 token ("SimpleSwap LP Token" - `SLP`). This makes liquidity positions transferable and compatible with the broader DeFi ecosystem.

The final, refined contract was successfully deployed and verified on the **Sepolia testnet** at the following address:
-   **`SimpleSwap Contract`: [`0xDc8b7749A4Aa978ab7d133e28D7348817F0E1793`](https://sepolia.etherscan.io/address/0xDc8b7749A4Aa978ab7d133e28D7348817F0E1793)**
-   As a final confirmation of its functionality, the deployed `SimpleSwap` contract was tested against the `SwapVerifier` contract from Module 3. The test was successful, and the authorship was recorded on-chain: **`authors[129] = crrabi-SimpleSwap_TP4`**.

### 2.2. Development and Testing Environment

The Hardhat environment was configured for professional development and testing on the Sepolia network.

-   **Dependency Management:** Key dependencies such as `@openzeppelin/contracts`, `@nomicfoundation/hardhat-toolbox`, and `ethers` were installed to build upon secure and standard tools.
-   **Sepolia Configuration:** The `hardhat.config.ts` file was configured to connect to the Sepolia testnet. This involved creating a dedicated **RPC node via Infura** and managing private keys securely using a `.env` file.
-   **Deployment Script:** A streamlined deployment script (`scripts/deploy.ts`) was created. Since the ERC20 token contracts were already deployed and verified, this script was optimized to only deploy the `SimpleSwap` contract, referencing the pre-existing token addresses to save time and gas.

### 2.3. Test-Driven Development and Coverage

A primary requirement of this module was to achieve a test coverage of **at least 50%**. A comprehensive test suite was developed iteratively to exceed this goal significantly.

1.  **Initial Tests (Happy Path):** The first set of tests focused on the "happy path" scenarios, ensuring that `addLiquidity`, `swapExactTokensForTokens`, and `removeLiquidity` worked as expected under normal conditions. This initial suite resulted in a coverage of `75% Statements` but only **`41% Branch`**. This indicated that error conditions and alternative logic paths were not being tested.

2.  **Extended Tests (Edge Cases & Reverts):** To improve branch coverage, the test suite (`test/SimpleSwap.test.ts`) was expanded with new tests designed to trigger `require` statements and cover all logical branches. These included:
    -   Testing for expired deadlines.
    -   Verifying reverts when incorrect token addresses are used.
    -   Testing the alternative calculation logic (`else` block) in `addLiquidity`.
    -   Asserting that `swap` reverts with an invalid path or insufficient output amount.
    -   Ensuring `removeLiquidity` reverts when a user has insufficient LP tokens or when the returned amount is below the specified minimum.
    -   Checking that `getPrice` reverts correctly when the pool has no liquidity.

This second iteration of tests boosted the metrics dramatically, achieving:
-   **Statements: 92.45%**
-   **Branches: 67.65%**
-   **Functions: 91.67%**
-   **Lines: 94.12%**

-   ![image](https://github.com/user-attachments/assets/5f1d4843-1ecc-49dc-931a-d5524c936491)
-   ![image](https://github.com/user-attachments/assets/da508efb-69ae-4893-a6d3-e33f7ba4d547)
-   ![image](https://github.com/user-attachments/assets/caaf0fea-8b8c-43ae-8a4e-2d174a020113)
-   ![image](https://github.com/user-attachments/assets/03f0dab2-395e-4f37-ac08-20f7c44953b9)


These results far exceed the project requirements and demonstrate a robust and reliable smart contract.

---

## 3. Frontend Development 🖥️

The frontend was built as a modern, reactive single-page application to provide an intuitive user interface for the `SimpleSwap` contract.

### 3.1. Technology Stack

-   **Framework:** **React** with **TypeScript** for robust, type-safe development.
-   **Build Tool:** **Vite** was chosen for its blazing-fast development server and optimized build process.
-   **Blockchain Interaction:** **Ethers.js v6** was used as the library to connect to the Ethereum blockchain, interact with contracts, and handle transactions.

### 3.2. Project Structure & Setup

-   **Component-Based Architecture:** The UI was broken down into logical components located in `frontend/src/components/`, including `SwapUI.tsx` for the main trading interface and `PriceViewer.tsx` for displaying real-time data.
-   **Configuration File:** A central `config.ts` file was created to store contract addresses and ABIs, making the application easy to configure and maintain.

### 3.3. Key Implementation Challenges & Solutions

-   **ABI Imports in a Monorepo:** A common issue when working with a `backend`/`frontend` monorepo is that the frontend build tool (Vite) cannot access files outside its root directory.
    -   **Solution:** A Node.js script, `copy-abis.mjs`, was created in the project root. This script copies the necessary contract ABI JSON files from `backend/artifacts/` into a new `frontend/src/abis/` directory.
    -   The script was integrated into the `package.json` `dev` command to run automatically, ensuring the frontend always has the latest ABIs.
    -   To make the script compatible with modern Node.js ES Modules, we used `import.meta.url`, `fileURLToPath`, and `path.dirname` to correctly resolve the project's directory path, fixing an initial `__dirname is not defined` error.

-   **Ethers.js v6 Compatibility:** During development, a runtime error `"Uncaught SyntaxError: The requested module ... does not provide an export named 'Signer'"` occurred.
    -   **Solution:** This was identified as an incompatibility with how types are imported in Ethers.js v6 versus v5. The code was refactored to use the correct v6 pattern, e.g., `ethers.Signer` instead of importing `Signer` directly. This was applied to `App.tsx` and all child components to ensure a stable connection with MetaMask and the blockchain.

-   **Seeding Initial Liquidity:** After a successful local launch, it was noted that the DApp was not fully functional because the deployed `SimpleSwap` pool on Sepolia had no liquidity.
    -   **Solution:** To test the full functionality, initial liquidity was provided directly on the Sepolia network. This was done by connecting MetaMask to **Etherscan's** "Write Contract" interface for the `TokenA`, `TokenB`, and `SimpleSwap` contracts to first `approve` token spending and then call `addLiquidity`. This prepared the on-chain state for the frontend to consume.

This methodical approach to development and debugging resulted in a fully functional DApp that correctly interacts with live smart contracts on the Sepolia testnet.

---

## 4. Frontend Deployment 🚀

To make the SimpleSwap DApp publicly accessible, the frontend was deployed using **Vercel**, a platform renowned for its seamless integration with modern web development workflows and GitHub.

### 4.1. Deployment Strategy

The deployment process was tailored for a monorepo structure, ensuring that only the frontend application was built and deployed.

1.  **Repository Preparation:** The project was pushed to a GitHub repository. A comprehensive `.gitignore` file was configured to exclude unnecessary files like `node_modules`, `.env` files, and backend build artifacts, keeping the repository clean and secure.

2.  **Handling ABIs for Deployment:** Since Vercel's build environment cannot access the `backend` directory, a crucial step was taken to make the contract ABIs available to the frontend.
    -   The local `copy:abis` script was run one final time to populate the `frontend/src/abis/` directory.
    -   This `abis` directory, containing the `SimpleSwap.json` and `TestToken.json` files, was then committed and pushed to the GitHub repository. This ensures that the frontend has all the necessary information to interact with the smart contracts without needing access to the backend folder during the live deployment.

3.  **Vercel Configuration:**
    -   The GitHub repository was imported into a new Vercel project.
    -   The **Root Directory** setting was configured to point specifically to the `frontend` folder, instructing Vercel to treat our React application as the source of the project.
    -   Vercel's build system automatically detected the project as a **Vite** application and applied the correct build settings (`npm run build`) and output directory (`dist`) without needing further configuration.

### 4.2. Live Application

After a successful build and deployment process, the DApp is now live and fully functional on Vercel. It correctly connects to the Sepolia testnet via a user's browser wallet (like MetaMask) and interacts with the deployed smart contracts.

**You can access the live DApp here: https://simpleswap-dapp-delta.vercel.app/**
