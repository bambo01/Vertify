const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting TruthChain deployment to Base...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.getBalance()).toString());

  // Deploy TruthChainCore
  console.log("\n📦 Deploying TruthChainCore...");
  const TruthChainCore = await hre.ethers.getContractFactory("TruthChainCore");
  const truthChainCore = await TruthChainCore.deploy();
  await truthChainCore.deployed();
  console.log("✅ TruthChainCore deployed to:", truthChainCore.address);

  // Deploy RoleBadgeNFT
  console.log("\n📦 Deploying RoleBadgeNFT...");
  const RoleBadgeNFT = await hre.ethers.getContractFactory("RoleBadgeNFT");
  const roleBadgeNFT = await RoleBadgeNFT.deploy();
  await roleBadgeNFT.deployed();
  console.log("✅ RoleBadgeNFT deployed to:", roleBadgeNFT.address);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    contracts: {
      TruthChainCore: {
        address: truthChainCore.address,
        blockNumber: truthChainCore.deployTransaction.blockNumber
      },
      RoleBadgeNFT: {
        address: roleBadgeNFT.address,
        blockNumber: roleBadgeNFT.deployTransaction.blockNumber
      }
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment completed successfully!");
  
  console.log("\n🔗 Add these to your .env file:");
  console.log(`NEXT_PUBLIC_TRUTHCHAIN_CORE_ADDRESS=${truthChainCore.address}`);
  console.log(`NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS=${roleBadgeNFT.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
