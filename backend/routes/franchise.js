const router = require("express").Router();

router.get("/", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const count = await contracts.franchiseRegistry.franchiseCount();
    const franchises = [];

    for (let i = 1; i <= Number(count); i++) {
      const f = await contracts.franchiseRegistry.getFranchise(i);
      franchises.push({
        franchiseId: f.franchiseId.toString(),
        name: f.name,
        league: f.league,
        adminWallet: f.adminWallet,
        treasuryWallet: f.treasuryWallet,
        active: f.active,
        registeredAt: f.registeredAt.toString(),
      });
    }

    res.json(franchises);
  } catch (err) {
    console.error("Get franchises failed:", err.message);
    res.status(500).json({ error: "Failed to get franchises", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid franchise id — must be a positive integer" });
    }

    const { contracts } = req.app.locals;
    const f = await contracts.franchiseRegistry.getFranchise(id);

    res.json({
      franchiseId: f.franchiseId.toString(),
      name: f.name,
      league: f.league,
      adminWallet: f.adminWallet,
      treasuryWallet: f.treasuryWallet,
      active: f.active,
      registeredAt: f.registeredAt.toString(),
    });
  } catch (err) {
    console.error("Get franchise failed:", err.message);
    res.status(500).json({ error: "Failed to get franchise", details: err.message });
  }
});

module.exports = router;
