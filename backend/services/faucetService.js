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
  const value = amount || DEFAULT_AMOUNT;

  // Atomic lock: insert a placeholder row to prevent concurrent funding.
  // ON CONFLICT DO NOTHING returns 0 rows if address already exists.
  if (db) {
    const { rowCount } = await db.query(
      `INSERT INTO faucet_history (address, amount, tx_hash)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (address) DO NOTHING`,
      [normalized, ethers.formatEther(value)]
    );
    if (rowCount === 0) {
      return { success: false, reason: "already funded" };
    }
  }

  try {
    const tx = await signer.sendTransaction({
      to: toAddress,
      value,
    });
    await tx.wait();

    // Update placeholder with actual tx hash
    if (db) {
      await db.query(
        "UPDATE faucet_history SET tx_hash = $1 WHERE address = $2",
        [tx.hash, normalized]
      );
    }

    return {
      success: true,
      txHash: tx.hash,
      amount: ethers.formatEther(value),
    };
  } catch (err) {
    // Remove placeholder on failure so the user can retry
    if (db) {
      await db.query(
        "DELETE FROM faucet_history WHERE address = $1 AND tx_hash = 'pending'",
        [normalized]
      ).catch(() => {});
    }
    console.error(`faucetService.fundWallet failed for ${toAddress}:`, err.message);
    throw err;
  }
}

module.exports = { fundWallet };
