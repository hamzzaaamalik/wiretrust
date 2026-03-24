require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: require("path").resolve(__dirname, "contracts", ".env") });

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    wirefluid: {
      url: process.env.WIREFLUID_RPC || "https://evm.wirefluid.com",
      chainId: 92533,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
};
