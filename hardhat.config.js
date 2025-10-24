require("@nomicfoundation/hardhat-ethers");     // ethers v6
require("hardhat-deploy");
require("dotenv").config();

const RAW_PK = (process.env.PRIVATE_KEY || "").trim();
const PRIVATE_KEY = RAW_PK ? (RAW_PK.startsWith("0x") ? RAW_PK : `0x${RAW_PK}`) : "";

// Public RPCs (override via env if you use Alchemy/Infura/Ankr)
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const BASE_MAINNET_RPC = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";

// Only pass accounts when a real key is provided
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    hardhat: { chainId: 31337 },

    baseSepolia: {
      url: BASE_SEPOLIA_RPC,
      chainId: 84532,
      accounts,
      // gasPrice optional; leave unset to let provider suggest
      // gasPrice: 200000000,
    },

    base: {
      url: BASE_MAINNET_RPC,
      chainId: 8453,
      accounts,
      // gasPrice: 1000000000,
    },
  },

  namedAccounts: {
    deployer: { default: 0 },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Optional: handy if you ever add verification
  // etherscan: {
  //   apiKey: { base: process.env.BASESCAN_API_KEY, baseSepolia: process.env.BASESCAN_API_KEY },
  // },
};
