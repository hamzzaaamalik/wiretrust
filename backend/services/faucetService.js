const { ethers } = require("ethers");

const DEFAULT_AMOUNT = ethers.parseEther("0.1");

/**
 * Sends WIRE from the deployer/funder wallet to a new user address.
 * Uses faucet_history table for persistent tracking across restarts.
 *
 * @param {import("ethers").Wallet} signer  - funded deployer wallet
 * @param {string}                  toAddress
 * @param {bigint}                  [amount] - wei amount (defaults to 0.1 WIRE)
 * @param {object}                  [db]     - database module
 * @returns {Promise<{ success: boolean, txHash?: string, amount?: string, reason?: string }>}
 */
async function fundWallet(signer, toAddress, amount, db) {
  const normalized = toAddress.toLowerCase();

  // Check if already funded (DB-backed, persists across restarts)
  if (db) {
    const { rows } = await db.query(
      "SELECT id FROM faucet_history WHERE address = $1 LIMIT 1",
      [normalized]
    );
    if (rows.length > 0) {
      return { success: false, reason: "already funded" };
    }
  }

  const value = amount || DEFAULT_AMOUNT;

  try {
    const tx = await signer.sendTransaction({
      to: toAddress,
      value,
    });
    await tx.wait();

    // Record in DB
    if (db) {
      await db.query(
        "INSERT INTO faucet_history (address, amount, tx_hash) VALUES ($1, $2, $3)",
        [normalized, ethers.formatEther(value), tx.hash]
      );
    }

    return {
      success: true,
      txHash: tx.hash,
      amount: ethers.formatEther(value),
    };
  } catch (err) {
    console.error(`faucetService.fundWallet failed for ${toAddress}:`, err.message);
    throw err;
  }
}

module.exports = { fundWallet };
