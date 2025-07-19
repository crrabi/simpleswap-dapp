import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestToken, SimpleSwap } from "../typechain-types"; // TypeChain for better type safety

describe("Full DApp Ecosystem Test Suite", function () {
    async function deployEcosystemFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        const tokenA = await TestTokenFactory.deploy("Token A", "TKA");
        const tokenB = await TestTokenFactory.deploy("Token B", "TKB");
        const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
        const simpleSwap = await SimpleSwapFactory.deploy(await tokenA.getAddress(), await tokenB.getAddress());
        const initialMintAmount = ethers.parseEther("10000");
        await tokenA.mint(owner.address, initialMintAmount);
        await tokenB.mint(owner.address, initialMintAmount);
        return { simpleSwap, tokenA, tokenB, owner, user1, user2 };
    }

    describe("SimpleSwap AMM Contract", function () {
        describe("Liquidity Provision", function () {
            it("Should mint LP tokens and emit AddLiquidity on first deposit", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const amountA = ethers.parseEther("100");
                const amountB = ethers.parseEther("200");
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), amountA);
                await tokenB.approve(await simpleSwap.getAddress(), amountB);

                const expectedLiquidity = ethers.parseEther("141.42135623730950488");
                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline))
                    .to.emit(simpleSwap, "AddLiquidity")
                    .withArgs(owner.address, amountA, amountB, expectedLiquidity);

                const [reserveA, reserveB] = await simpleSwap.getReserves(await tokenA.getAddress(), await tokenB.getAddress());
                expect(reserveA).to.equal(amountA);
                expect(reserveB).to.equal(amountB);
                expect(await simpleSwap.balanceOf(owner.address)).to.equal(expectedLiquidity);
            });

            it("Should handle the alternative `addLiquidity` calculation (optimal A)", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), 0, 0, owner.address, deadline);
                
                // This call will force the 'else' block where optimal A is calculated.
                const amountADesired = ethers.parseEther("50");
                const amountBDesired = ethers.parseEther("10");
                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountADesired, amountBDesired, 0, 0, owner.address, deadline))
                    .to.not.be.reverted;
            });
        
            it("Should remove liquidity, burn LP tokens, and emit a RemoveLiquidity event", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const amountA = ethers.parseEther("100");
                const amountB = ethers.parseEther("100");
                const deadline = (await time.latest()) + 60;
                
                await tokenA.approve(await simpleSwap.getAddress(), amountA);
                await tokenB.approve(await simpleSwap.getAddress(), amountB);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amountA, amountB, 0, 0, owner.address, deadline);

                const lpBalance = await simpleSwap.balanceOf(owner.address);
                
                await expect(simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, 0, owner.address, deadline))
                    .to.emit(simpleSwap, "RemoveLiquidity")
                    .withArgs(owner.address, owner.address, amountA, amountB, lpBalance);

                expect(await simpleSwap.balanceOf(owner.address)).to.equal(0);
            });
        });

        describe("Swapping", function () {
            it("Should swap tokens from A to B and emit a Swap event", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const amount = ethers.parseEther("1000");
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), amount);
                await tokenB.approve(await simpleSwap.getAddress(), amount);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amount, amount, 0, 0, owner.address, deadline);

                const amountIn = ethers.parseEther("100");
                await tokenA.approve(await simpleSwap.getAddress(), amountIn);
                const expectedAmountOut = await simpleSwap.getAmountOut(amountIn, amount, amount);

                await expect(simpleSwap.swapExactTokensForTokens(amountIn, 0, [await tokenA.getAddress(), await tokenB.getAddress()], owner.address, deadline))
                    .to.emit(simpleSwap, "Swap")
                    .withArgs(owner.address, await tokenA.getAddress(), await tokenB.getAddress(), amountIn, expectedAmountOut, owner.address);
            });

             it("Should perform a swap from B to A correctly", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const amount = ethers.parseEther("1000");
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), amount);
                await tokenB.approve(await simpleSwap.getAddress(), amount);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), amount, amount, 0, 0, owner.address, deadline);

                const amountIn = ethers.parseEther("100");
                await tokenB.approve(await simpleSwap.getAddress(), amountIn); // Approve Token B this time
                const initialBalanceA = await tokenA.balanceOf(owner.address);
                await simpleSwap.swapExactTokensForTokens(amountIn, 0, [await tokenB.getAddress(), await tokenA.getAddress()], owner.address, deadline);

                expect(await tokenA.balanceOf(owner.address)).to.be.gt(initialBalanceA);
            });
        });

        describe("Revert Conditions", function() {
            it("Should revert if deadline has expired", async function() {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), 1, 1, 0, 0, owner.address, (await time.latest()) - 1))
                    .to.be.revertedWith("EXPIRED");
            });

            it("Should revert addLiquidity if an incorrect token address is provided", async function() {
                const { simpleSwap, tokenA, owner } = await loadFixture(deployEcosystemFixture);
                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), owner.address, 1, 1, 0, 0, owner.address, (await time.latest()) + 60))
                    .to.be.revertedWith("INVALID_TOKENS");
            });

             it("Should revert addLiquidity if returned amounts are below minimums", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("200"), 0, 0, owner.address, deadline);

                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("10"), ethers.parseEther("20"), 0, ethers.parseEther("21"), owner.address, deadline))
                    .to.be.revertedWith("ERR_INSUF_LIQ");
            });

             it("should not allow adding zero liquidity", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                await expect(simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), 0, 0, 0, 0, owner.address, (await time.latest()) + 60))
                    .to.be.revertedWith("ERR_MINT_ZERO");
            });
            
            it("Should revert swap if path is invalid (length, identical, non-pair token)", async function() {
                const { simpleSwap, tokenA, owner } = await loadFixture(deployEcosystemFixture);
                const deadline = (await time.latest()) + 60;
                await expect(simpleSwap.swapExactTokensForTokens(1, 0, [await tokenA.getAddress()], owner.address, deadline)).to.be.revertedWith("INVALID_PATH");
                await expect(simpleSwap.swapExactTokensForTokens(1, 0, [await tokenA.getAddress(), await tokenA.getAddress()], owner.address, deadline)).to.be.revertedWith("INVALID_PATH");
                await expect(simpleSwap.swapExactTokensForTokens(1, 0, [owner.address, await tokenA.getAddress()], owner.address, deadline)).to.be.revertedWith("INVALID_IN_TOKEN");
            });
            
            it("Should revert swap if the output amount is less than the minimum required", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), 0, 0, owner.address, (await time.latest()) + 60);
                
                await expect(simpleSwap.swapExactTokensForTokens(ethers.parseEther("10"), ethers.parseEther("100"), [await tokenA.getAddress(), await tokenB.getAddress()], owner.address, (await time.latest()) + 60))
                    .to.be.revertedWith("ERR_LOW_OUTPUT");
            });
        
             it("Should revert removeLiquidity if amounts are below minimums", async function () {
                const { simpleSwap, tokenA, tokenB, owner } = await loadFixture(deployEcosystemFixture);
                const deadline = (await time.latest()) + 60;
                await tokenA.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await tokenB.approve(await simpleSwap.getAddress(), ethers.MaxUint256);
                await simpleSwap.addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), 0, 0, owner.address, deadline);

                const lpBalance = await simpleSwap.balanceOf(owner.address);
                await expect(simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, ethers.parseEther("101"), 0, owner.address, deadline)).to.be.revertedWith("ERR_INSUF_A");
                await expect(simpleSwap.removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), lpBalance, 0, ethers.parseEther("101"), owner.address, deadline)).to.be.revertedWith("ERR_INSUF_B");
            });
        });

         describe("View/Pure Functions", function() {
             it("should fail getAmountOut and getPrice if reserves are zero", async function() {
                const { simpleSwap, tokenA, tokenB } = await loadFixture(deployEcosystemFixture);
                await expect(simpleSwap.getAmountOut(ethers.parseEther("1"), 0, 0)).to.be.revertedWith("NO_LIQUIDITY");
                await expect(simpleSwap.getPrice(await tokenA.getAddress(), await tokenB.getAddress())).to.be.revertedWith("NO_LIQUIDITY");
            });
         });
    });

    describe("TestToken Faucet Contract", function () {
        it("Should allow a user to claim tokens and emit a TokensClaimed event", async function () {
            const { tokenA, user1 } = await loadFixture(deployEcosystemFixture);
            await expect(tokenA.connect(user1).claimTokens()).to.emit(tokenA, "TokensClaimed").withArgs(user1.address);
            expect(await tokenA.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should enforce the faucet cooldown period", async function () {
            const { tokenA, user1 } = await loadFixture(deployEcosystemFixture);
            await tokenA.connect(user1).claimTokens();
            await expect(tokenA.connect(user1).claimTokens()).to.be.revertedWith("WAIT_24H");
            await time.increase(24 * 60 * 60);
            await expect(tokenA.connect(user1).claimTokens()).to.not.be.reverted;
        });
    });
});