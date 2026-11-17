// Independent audit config: no deployer accounts, secrets or public write networks.
// Mirrors the original repo's Solidity 0.8.28 default settings exactly.
const path = require("node:path");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: process.env.AUDIT_OPTIMIZER === "true",
        runs: Number(process.env.AUDIT_RUNS || 200)
      },
      ...(process.env.AUDIT_EVM_VERSION ? { evmVersion: process.env.AUDIT_EVM_VERSION } : {})
    }
  },
  paths: {
    root: path.resolve(__dirname, ".."),
    sources: path.resolve(__dirname, "../contracts"),
    tests: path.resolve(__dirname, "../audit/test"),
    artifacts: path.resolve(__dirname, "../audit/artifacts"),
    cache: path.resolve(__dirname, "../audit/cache")
  },
  networks: {
    hardhat: { chainId: 31337 }
  }
};
