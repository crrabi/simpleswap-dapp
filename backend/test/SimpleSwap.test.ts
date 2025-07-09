import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SimpleSwap", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployFixture() {
        const [owner, otherAccount] = await ethers.getSigners();

        // Deploy Test Tokens
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        const tokenA = await TestTokenFactory.deploy("Token A", "TKA");
        const tokenB = await TestTokenFactory.deploy("Token B", "TKB");
        
        await tokenA.waitForDeployment();
        await tokenB.waitForDeployment();

        // Deploy SimpleSwap
        const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
        const simpleSwap = await SimpleSwapFactory.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );
        await simpleSwap.waitForDeployment();

        // Mint some tokens to owner for testing
        const initialAmount = ethers.parseEther("1000");
        await tokenA.mint(owner.address, initialAmount);
        await tokenB.mint(owner.address, initialAmount);

        return { simpleSwap, tokenA, tokenB, owner, otherAccount, initialAmount };
    }
    
    // --- Test of the "Happy Way" ---
    describe("Happy Path", function () {
        it("Should add liquidity for the first time", async function () {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("200");

            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);

            const deadline = (await time.latest()) + 60;
            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline
            )).to.not.be.reverted;

            const [reserveA, reserveB] = await simpleSwap.getReserves(await tokenA.getAddress(), await tokenB.getAddress());
            expect(reserveA).to.equal(amountA);
            expect(reserveB).to.equal(amountB);
            expect(await simpleSwap.balanceOf(owner.address)).to.be.gt(0);
        });

        it("Should perform a swap from A to B", async function () {
            
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");
            
            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);
            const deadline = (await time.latest()) + 60;
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);
            
            const swapAmount = ethers.parseEther("10");
            await tokenA.approve(await simpleSwap.getAddress(), swapAmount);

            const initialBalanceB = await tokenB.balanceOf(owner.address);
            await simpleSwap.swapExactTokensForTokens(swapAmount, 0, [await tokenA.getAddress(), await tokenB.getAddress()], owner.address, deadline);
            const finalBalanceB = await tokenB.balanceOf(owner.address);

            expect(finalBalanceB).to.be.gt(initialBalanceB);
        });

        it("Should remove liquidity", async function () {
            
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");

            const deadline = (await time.latest()) + 60;
            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const lpBalance = await simpleSwap.balanceOf(owner.address);
            const initialTokenABalance = await tokenA.balanceOf(owner.address);
            
            await simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, 0, owner.address, deadline);

            expect(await tokenA.balanceOf(owner.address)).to.be.gt(initialTokenABalance);
            expect(await simpleSwap.balanceOf(owner.address)).to.equal(0);
        });
    });

    // --- to increment % Branch Reversal Testing and Edge Cases ---
    describe("Revert and Edge Cases", function() {
        it("Should revert if deadline is expired", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const expiredDeadline = (await time.latest()) - 1; // Un segundo en el pasado
            
            await expect(
                simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), 1, 1, 0, 0, owner.address, expiredDeadline)
            ).to.be.revertedWith("EXPIRED");
        });

        it("Should revert addLiquidity if token addresses are incorrect", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const otherTokenFactory = await ethers.getContractFactory("TestToken");
            const otherToken = await otherTokenFactory.deploy("Other", "OTH");

            const deadline = (await time.latest()) + 60;
            await expect(
                simpleSwap.addLiquidity(await tokenA.getAddress(), await otherToken.getAddress(), 1, 1, 0, 0, owner.address, deadline)
            ).to.be.revertedWith("INVALID_TOKENS");
        });

        it("Should revert swap if path is invalid", async function() {
            const { simpleSwap, tokenA, owner } = await loadFixture(deployFixture);
            const deadline = (await time.latest()) + 60;

            // Test path with incorrect length
            await expect(
                simpleSwap.swapExactTokensForTokens(1, 0, [await tokenA.getAddress()], owner.address, deadline)
            ).to.be.revertedWith("INVALID_PATH");

            // Test path with incorrect token
             await expect(
                simpleSwap.swapExactTokensForTokens(1, 0, [owner.address, await tokenA.getAddress()], owner.address, deadline)
            ).to.be.revertedWith("INVALID_INPUT_TOKEN");
        });

        it("Should revert swap if output amount is less than minAmount", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");

            const deadline = (await time.latest()) + 60;
            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const swapAmount = ethers.parseEther("10");
            const hugeAmountOutMin = ethers.parseEther("100"); // Unrealistic minimum
            await tokenA.approve(await simpleSwap.getAddress(), swapAmount);
            
            await expect(
                simpleSwap.swapExactTokensForTokens(swapAmount, hugeAmountOutMin, [await tokenA.getAddress(), await tokenB.getAddress()], owner.address, deadline)
            ).to.be.revertedWith("INSUFFICIENT_OUTPUT_AMOUNT");
        });

        it("Should revert removeLiquidity if user has insufficient LP tokens", async function() {
            const { simpleSwap, tokenA, tokenB, owner, otherAccount } = await loadFixture(deployFixture);
            const deadline = (await time.latest()) + 60;
            const someLP = ethers.parseEther("1");

            // otherAccount tiene 0 LP tokens
            await expect(
                simpleSwap.connect(otherAccount).removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), someLP, 0, 0, otherAccount.address, deadline)
            ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
        });

        it("Should get correct price and handle insufficient liquidity for getPrice", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);

            // Test before liquidity is added
            await expect(
                simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress())
            ).to.be.revertedWith("INSUFFICIENT_LIQUIDITY");

            // Add liquidity
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("200"); // Price should be 2 TKB per TKA
            await tokenA.approve(await simpleSwap.getAddress(), amountA);
            await tokenB.approve(await simpleSwap.getAddress(), amountB);
            const deadline = (await time.latest()) + 60;
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const price = await simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress());
            expect(price).to.equal(ethers.parseEther("2"));
        });

        it("Should handle the alternative case in addLiquidity calculation", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            
            // Add initial liquidity to establish a price
            const initialAmountA = ethers.parseEther("100");
            const initialAmountB = ethers.parseEther("100"); // 1:1 price
            const deadline = (await time.latest()) + 60;
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), initialAmountA, initialAmountB, 0, 0, owner.address, deadline);

            // Now, try to add liquidity where amountA is disproportionately high, forcing the 'else' block
            const amountADesired = ethers.parseEther("50");
            const amountBDesired = ethers.parseEther("10"); // We desire a lot of A for a little of B

            // This call should succeed and enter the 'else' branch, calculating amountAOptimal
            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(), amountADesired, amountBDesired, 0, 0, owner.address, deadline
            )).to.not.be.reverted;

            // Let's also test the require inside that `else` block
            const smallAmountAMin = ethers.parseEther("1000"); // An impossibly high minimum
            await expect(simpleSwap.addLiquidity(
                await tokenA.getAddress(), await tokenB.getAddress(), amountADesired, amountBDesired, smallAmountAMin, 0, owner.address, deadline
            )).to.be.revertedWith("INSUFFICIENT_A_AMOUNT");
        });
        
        it("Should revert removeLiquidity if returned amounts are below minimum", async function() {
            const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployFixture);
            
            // Add liquidity
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");
            const deadline = (await time.latest()) + 60;
            await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
            await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

            const lpBalance = await simpleSwap.balanceOf(owner.address);

            // Try to remove liquidity with an impossibly high minimum for amountA
            await expect(
                simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, ethers.parseEther("101"), 0, owner.address, deadline)
            ).to.be.revertedWith("INSUFFICIENT_A_AMOUNT");
            
            // Try to remove liquidity with an impossibly high minimum for amountB
            await expect(
                simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, ethers.parseEther("101"), owner.address, deadline)
            ).to.be.revertedWith("INSUFFICIENT_B_AMOUNT");
        });    
    });
});