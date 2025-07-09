import { ethers } from "hardhat";
import "dotenv/config";


const TOKEN_A_ADDRESS = "0xEC993982Ad62f64Da247bf396868e66a88C69D59";
const TOKEN_B_ADDRESS = "0xb68350a0Ca15E9C6e3524c012ef0fA78f2F87d50";


async function main() {
  if (!TOKEN_A_ADDRESS || !TOKEN_B_ADDRESS) {
    throw new Error("Please set your TOKEN_A_ADDRESS and TOKEN_B_ADDRESS in the deploy script.");
  }
  if (TOKEN_A_ADDRESS.startsWith("address") || TOKEN_B_ADDRESS.startsWith("address")) {
    throw new Error("Please replace placeholder addresses with your actual token addresses.");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy SimpleSwap with the existing token addresses
  console.log("Deploying SimpleSwap contract...");
  const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwapFactory.deploy(
    TOKEN_A_ADDRESS,
    TOKEN_B_ADDRESS
  );
  await simpleSwap.waitForDeployment();
  
  const simpleSwapAddress = await simpleSwap.getAddress();
  console.log(`✅ SimpleSwap deployed to: ${simpleSwapAddress}`);

  console.log("\nDeployment complete! You can now use this address in your frontend:");
  console.log(`SimpleSwap Address: ${simpleSwapAddress}`);

  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});