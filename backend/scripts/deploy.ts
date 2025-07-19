import { ethers } from "hardhat";
import "dotenv/config";


const TOKEN_A_ADDRESS = "0x763a75Db7a2A8cd6E5fdd8f03537CdB1EeA124BC";
const TOKEN_B_ADDRESS = "0x3D14300bC1113EC49c9689eC3d1214636c79C91A";


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