const { ethers } = require("ethers");

/**
 * Creates a new random wallet (testnet only — private key returned for demo use).
 * @returns {{ address: string, privateKey: string }}
 */
function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Returns the native WIRE balance of an address as a human-readable string.
 * @param {import("ethers").JsonRpcProvider} provider
 * @param {string} address
 * @returns {Promise<string>} formatted balance in WIRE (e.g. "12.5")
 */
async function getBalance(provider, address) {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (err) {
    console.error(`walletService.getBalance failed for ${address}:`, err.message);
    throw err;
  }
}

module.exports = { createWallet, getBalance };
