const router = require("express").Router();

router.get("/", async (req, res) => {
  try {
    const { provider, addresses, contracts } = req.app.locals;
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    // Fetch platform stats from contracts
    let totalAgents = 0;
    let totalPredictions = 0;
    let totalNFTs = 0;
    let activeContests = 0;

    try {
      const [agentCount, predCount, nftCount, contestCount] = await Promise.all([
        contracts.agentRegistry.agentCount().catch(() => 0n),
        contracts.predictionModule.predictionCount().catch(() => 0n),
        contracts.wireTrustNFT.tokenCount().catch(() => 0n),
        contracts.fantasyModule.contestCount().catch(() => 0n),
      ]);
      totalAgents = Number(agentCount);
      totalPredictions = Number(predCount);
      totalNFTs = Number(nftCount);

      const cCount = Number(contestCount);
      for (let i = 1; i <= cCount; i++) {
        try {
          const c = await contracts.fantasyModule.contests(i);
          if (c.active && !c.finalized) activeContests++;
        } catch { /* skip */ }
      }
    } catch { /* stats unavailable */ }

    res.json({
      status: "ok",
      chainId: Number(network.chainId),
      blockNumber: Number(blockNumber),
      totalAgents,
      totalPredictions,
      totalNFTs,
      activeContests,
      contracts: {
        franchiseRegistry: addresses.franchiseRegistry,
        agentRegistry: addresses.agentRegistry,
        reputationStore: addresses.reputationStore,
        matchOracle: addresses.matchOracle,
        policyEngine: addresses.policyEngine,
        executionGateway: addresses.executionGateway,
        fantasyModule: addresses.fantasyModule,
        predictionModule: addresses.predictionModule,
        wireTrustNFT: addresses.wireTrustNFT,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(500).json({ error: "Health check failed", details: err.message });
  }
});

module.exports = router;
