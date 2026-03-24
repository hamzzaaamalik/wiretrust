const router = require("express").Router();
const { ethers } = require("ethers");
const walletService = require("../services/walletService");
const faucetService = require("../services/faucetService");

router.post("/create-wallet", async (req, res) => {
  try {
    const { address, privateKey } = walletService.createWallet();
    const { signer, db } = req.app.locals;
    const walletType = req.body.walletType || "metamask";

    let funded = false;
    if (signer) {
      try {
        const result = await faucetService.fundWallet(signer, address, undefined, db);
        funded = result.success;
      } catch (err) {
        console.warn("Faucet funding failed:", err.message);
      }
    }

    // Record user in DB
    await db.query(
      `INSERT INTO users (address, wallet_type, funded)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET funded = $3`,
      [address.toLowerCase(), walletType, funded]
    );

    res.json({
      address,
      privateKey,
      funded,
      balance: funded ? "0.1" : "0.0",
    });
  } catch (err) {
    console.error("Create wallet failed:", err.message);
    res.status(500).json({ error: "Failed to create wallet", details: err.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { address, walletType } = req.body;

    if (!address) {
      return res.status(400).json({ error: "address required" });
    }

    await db.query(
      `INSERT INTO users (address, wallet_type)
       VALUES ($1, $2)
       ON CONFLICT (address) DO NOTHING`,
      [address.toLowerCase(), walletType || "metamask"]
    );

    res.json({ success: true, address: address.toLowerCase() });
  } catch (err) {
    console.error("Register failed:", err.message);
    res.status(500).json({ error: "Failed to register", details: err.message });
  }
});

router.get("/balance/:address", async (req, res) => {
  try {
    const { provider } = req.app.locals;
    const address = req.params.address;
    const balance = await provider.getBalance(address);

    res.json({
      address,
      balance: ethers.formatEther(balance),
    });
  } catch (err) {
    console.error("Balance check failed:", err.message);
    res.status(500).json({ error: "Failed to get balance", details: err.message });
  }
});

module.exports = router;
