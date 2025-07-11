// Import necessary tools from Hardhat and Chai
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Main test suite for the entire ecosystem
describe("SimpleSwap Ecosystem Suite", function () {
    
    // A Hardhat fixture to set up the initial state for each test,
    // avoiding code repetition and speeding up test execution.
    async function deployEcosystemFixture() {
        // Get signers, which represent Ethereum accounts. 'owner' will be the deployer.
        const [owner, otherAccount] = await ethers.getSigners();

        // Deploy the TestToken contract twice to create two distinct tokens
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        const tokenA = await TestTokenFactory.deploy("Token A", "TKA");
        const tokenB = await TestTokenFactory.deploy("Token B", "TKB");
        
        await tokenA.waitForDeployment();
        await tokenB.waitForDeployment();

        // Deploy the SimpleSwap contract, passing the token addresses to its constructor
        const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
        const simpleSwap = await SimpleSwapFactory.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );
        await simpleSwap.waitForDeployment();

        // We need to mint initial to the owner so they have something to add as liquidity.
        // We'll use the owner-only mint function for this setup
        const initialMintAmount = ethers.parseEther("10000");
        await tokenA.mint(owner.address, initialMintAmount);
        await tokenB.mint(owner.address, initialMintAmount);
        // Return all deployed contracts and signers for use in tests
        return { simpleSwap, tokenA, tokenB, owner, otherAccount };
    }
    
    // --- Test Suite for the SimpleSwap AMM Logic ---
    describe("SimpleSwap AMM Logic", function () {

        // --- Happy Path Tests (when everything goes right) ---
        
        it("Should add liquidity for the first time correctly", async function () {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("200");
            const deadline = (await time.latest()) + 60;

            // The user must first approve the SimpleSwap contract to spend their tokens
            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);

            // The call to addLiquidity should not revert and should update the state
            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline
            )).to.not.be.reverted;

            const [reserveA, reserveB] = await simpleSwap.getReserves(await tokenA.getAddress(), await tokenB.getAddress());
            expect(reserveA).to.equal(amountA);
            expect(reserveB).to.equal(amountB);

            // The liquidity provider should receive LP tokens in return
            expect(await simpleSwap.balanceOf(owner.address)).to.be.gt(0);
        });
        
        it("Should perform a swap from A to B", async function () {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");
            const deadline = (await time.latest()) + 60;

            // First, provide initial liquidity to the pool
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);
            
            // Now, perform the swap
            const swapAmount = ethers.parseEther("10");
            const initialBalanceB = await tokenB.balanceOf(owner.address);
            await simpleSwap.swapExactTokensForTokens(swapAmount, 0, [await tokenA.getAddress(), await tokenB.getAddress()], owner.address, deadline);
            const finalBalanceB = await tokenB.balanceOf(owner.address);

            // The user's balance of the output token should have increased
            expect(finalBalanceB).to.be.gt(initialBalanceB);
        });

        it("Should allow a user to remove their liquidity", async function () {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");
            const deadline = (await time.latest()) + 60;

            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const lpBalance = await simpleSwap.balanceOf(owner.address);
            const initialTokenABalance = await tokenA.balanceOf(owner.address);
            
            // User removes all of their liquidity
            await simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, 0, owner.address, deadline);

            // The user's underlying token balance should increase, and their LP balance should be zero
            expect(await tokenA.balanceOf(owner.address)).to.be.gt(initialTokenABalance);
            expect(await simpleSwap.balanceOf(owner.address)).to.equal(0);
        });

        it("Should correctly handle the alternative `addLiquidity` calculation (optimal A)", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const deadline = (await time.latest()) + 60;
            
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            
            // Establish a 1:1 price ratio
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), 0, 0, owner.address, deadline);
            
            // Attempt to add liquidity with a disproportionate amount, forcing the 'else' block
            const amountADesired = ethers.parseEther("50");
            const amountBDesired = ethers.parseEther("10");

            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(), amountADesired, amountBDesired, 0, 0, owner.address, deadline
            )).to.not.be.reverted;
        });

        // --- Revert and Edge Case Tests ---
        
        it("Should revert if deadline has expired", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const expiredDeadline = (await time.latest()) - 1;
            
            await expect(
                simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), 1, 1, 0, 0, owner.address, expiredDeadline)
            ).to.be.revertedWith("EXPIRED");
        });

        it("Should revert addLiquidity if incorrect token addresses are provided", async function() {
            const { simpleSwap, tokenA } = await loadFixture(deployEcosystemFixture);
            const fakeTokenBAddress = "0x000000000000000000000000000000000000DEAD";
            
            await expect(
                simpleSwap.addLiquidity(await tokenA.getAddress(), fakeTokenBAddress, 1, 1, 0, 0, ethers.ZeroAddress, (await time.latest()) + 60)
            ).to.be.revertedWith("INVALID_TOKENS");
        });

        it("Should revert swap if path is invalid", async function() {
            const { simpleSwap, tokenA, owner } = await loadFixture(deployEcosystemFixture);
            const deadline = (await time.latest()) + 60;

            await expect(simpleSwap.swapExactTokensForTokens(1, 0, [await tokenA.getAddress()], owner.address, deadline))
                .to.be.revertedWith("INVALID_PATH");

             await expect(simpleSwap.swapExactTokensForTokens(1, 0, [owner.address, await tokenA.getAddress()], owner.address, deadline))
                .to.be.revertedWith("INVALID_IN_TOKEN");
        });
        
        it("Should revert removeLiquidity if amounts are below minimums", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            const deadline = (await time.latest()) + 60;
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), 0, 0, owner.address, deadline);

            const lpBalance = await simpleSwap.balanceOf(owner.address);
            
            await expect(simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, ethers.parseEther("101"), 0, owner.address, deadline))
                .to.be.revertedWith("ERR_INSUF_A");
            
            await expect(simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, ethers.parseEther("101"), owner.address, deadline))
                .to.be.revertedWith("ERR_INSUF_B");
        });
        it("Should revert addLiquidity if returned amounts are below minimums", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const deadline = (await time.latest()) + 60;
    
            // Provide initial liquidity to establish a ratio
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("200"), 0, 0, owner.address, deadline);

            // Try to add liquidity, but with an amountBMin that is too high, forcing a revert
            // This tests the `require` in the first branch of the calculation.
            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(),
                ethers.parseEther("10"), ethers.parseEther("20"), // Desired amounts
                0, ethers.parseEther("21") // amountBMin is higher than optimal amountB (20)
                , owner.address, deadline
            )).to.be.revertedWith("ERR_INSUF_LIQ");
        });

        it("Should perform a swap from B to A correctly", async function () {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");
            const deadline = (await time.latest()) + 60;
    
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const swapAmount = ethers.parseEther("10");
            const initialBalanceA = await tokenA.balanceOf(owner.address);

            // Now swap from B to A
            await simpleSwap.swapExactTokensForTokens(
                swapAmount, 0, [await tokenB.getAddress(), await tokenA.getAddress()], owner.address, deadline
            );

            const finalBalanceA = await tokenA.balanceOf(owner.address);
            expect(finalBalanceA).to.be.gt(initialBalanceA);
        });

        it("Should revert swap if path contains identical tokens", async function() {
            const { simpleSwap, tokenA, owner } = await loadFixture(deployEcosystemFixture);
            const deadline = (await time.latest()) + 60;
    
            await expect(simpleSwap.swapExactTokensForTokens(
                1, 0, [await tokenA.getAddress(), await tokenA.getAddress()], owner.address, deadline
            )).to.be.revertedWith("INVALID_PATH");
        });
        it("should not allow adding zero liquidity", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
            const deadline = (await time.latest()) + 60;
    
            // Attempting to add zero liquidity should fail at the final require
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
    
            await expect(
                simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), 0, 0, 0, 0, owner.address, deadline)
            ).to.be.revertedWith("ERR_MINT_ZERO");
        });

        it("should fail getAmountOut and getPrice if reserves are zero", async function() {
            const { simpleSwap, tokenA, tokenB } = await loadFixture(deployEcosystemFixture);

            // Testing getAmountOut reverts with zero reserves
            await expect(
                simpleSwap.getAmountOut(ethers.parseEther("1"), 0, 0)
            ).to.be.revertedWith("NO_LIQUIDITY");

            // Testing getPrice reverts with zero reserves (already in another test, but reinforces completeness)
            await expect(
                simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress())
            ).to.be.revertedWith("NO_LIQUIDITY");
        });
    });

    // --- NEW: Test Suite for the TestToken Faucet ---
    describe("TestToken Faucet Logic", function() {

        it("Should allow a user to claim tokens from the faucet", async function() {
            const { tokenA, otherAccount } = await loadFixture(deployEcosystemFixture);

            // The otherAccount initially has 0 tokens
            expect(await tokenA.balanceOf(otherAccount.address)).to.equal(0);

            // After claiming, they should have 100 tokens
            await expect(tokenA.connect(otherAccount).claimTokens()).to.not.be.reverted;
            expect(await tokenA.balanceOf(otherAccount.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should enforce the 24-hour cooldown on the faucet", async function() {
            const { tokenA, otherAccount } = await loadFixture(deployEcosystemFixture);

            // First claim is successful
            await tokenA.connect(otherAccount).claimTokens();

            // Immediate second claim must fail
            await expect(tokenA.connect(otherAccount).claimTokens())
                .to.be.revertedWith("WAIT_24H");
            
            // Move time forward by 23 hours and 59 minutes - should still fail
            await time.increase(23 * 60 * 60 + 59 * 60);
             await expect(tokenA.connect(otherAccount).claimTokens())
                .to.be.revertedWith("WAIT_24H");

            // Move time forward by another 2 minutes (total > 24 hours) - should succeed
            await time.increase(2 * 60);
            await expect(tokenA.connect(otherAccount).claimTokens()).to.not.be.reverted;
            
            // User should now have 200 tokens in total
            expect(await tokenA.balanceOf(otherAccount.address)).to.equal(ethers.parseEther("200"));
        });

        it("Should allow the owner to mint tokens without restriction", async function() {
            const { tokenA, owner, otherAccount } = await loadFixture(deployEcosystemFixture);
            const mintAmount = ethers.parseEther("5000");

            // The owner can mint tokens directly
            await expect(tokenA.mint(otherAccount.address, mintAmount)).to.not.be.reverted;
            expect(await tokenA.balanceOf(otherAccount.address)).to.equal(mintAmount);
        });
    });
});