require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Local test execution never needs Mainnet credentials. Preserve explicit
// Mainnet configuration only when a developer has supplied both values.
const networks = {};
if (process.env.ALCHEMY_KEY && process.env.MAINNET_PRIVATE_KEY) {
  networks.mainnet = {
    url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    accounts: [process.env.MAINNET_PRIVATE_KEY]
  };
}

module.exports = {
  solidity: "0.8.28",
  networks
};
