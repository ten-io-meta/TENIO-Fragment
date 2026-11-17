// Independent audit config: no deployer accounts, secrets or public write networks.
// Mirrors the original repo's Solidity 0.8.28 default settings exactly.
const path = require("node:path");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: false, runs: 200 } }
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
