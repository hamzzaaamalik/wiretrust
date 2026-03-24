const router = require("express").Router();
const { ethers } = require("ethers");

function decodeAction(bytes32) {
  try { return ethers.decodeBytes32String(bytes32); } catch { return bytes32; }
}

// Agent leaderboard — top agents by reputation score
router.get("/leaderboard", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const agentCount = await contracts.agentRegistry.agentCount();
    const total = Number(agentCount);
    const agents = [];

    for (let i = 1; i <= total; i++) {
      try {
        const agent = await contracts.agentRegistry.getAgent(i);
        if (!agent.active) continue;
        const score = await contracts.reputationStore.getScore(i);
        const badge = await contracts.reputationStore.getRiskBadge(i);
        agents.push({
          agentId: i,
          name: agent.name,
          owner: agent.owner,
          botType: agent.botType,
          score: Number(score),
          badge: Number(badge),
        });
      } catch {
        // skip agents that fail to load
      }
    }

    agents.sort((a, b) => b.score - a.score);
    const limit = Number(req.query.limit) || 10;
    res.json(agents.slice(0, limit));
  } catch (err) {
    console.error("Get leaderboard failed:", err.message);
    res.status(500).json({ error: "Failed to get leaderboard", details: err.message });
  }
});

// Execution logs for a specific agent (from on-chain events)
router.get("/logs/:agentId", async (req, res) => {
  try {
    const { contracts, provider } = req.app.locals;
    const agentId = req.params.agentId;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);

    const executedFilter = contracts.executionGateway.filters.AgentExecuted(agentId);
    const violationFilter = contracts.executionGateway.filters.AgentViolation(agentId);

    const [executedLogs, violationLogs] = await Promise.all([
      contracts.executionGateway.queryFilter(executedFilter, fromBlock, currentBlock).catch(() => []),
      contracts.executionGateway.queryFilter(violationFilter, fromBlock, currentBlock).catch(() => []),
    ]);

    const events = [];

    // Decode target from execute() calldata: execute(uint256,address,bytes32,bytes,uint256,bytes32)
    const executeIface = new ethers.Interface([
      'function execute(uint256 agentId, address target, bytes32 action, bytes data, uint256 amount, bytes32 nonce)'
    ]);

    for (const log of executedLogs) {
      let target = null;
      try {
        const tx = await provider.getTransaction(log.transactionHash);
        if (tx?.data) {
          const decoded = executeIface.parseTransaction({ data: tx.data });
          target = decoded?.args?.target || null;
        }
      } catch {}
      events.push({
        type: 'execution',
        action: decodeAction(log.args.action),
        actionRaw: log.args.action,
        target,
        success: log.args.success,
        gasUsed: log.args.gasUsed.toString(),
        timestamp: log.args.timestamp.toString(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    for (const log of violationLogs) {
      events.push({
        type: 'violation',
        action: decodeAction(log.args.action),
        actionRaw: log.args.action,
        target: log.args.target,
        reason: log.args.reason,
        timestamp: log.args.timestamp.toString(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    events.sort((a, b) => b.blockNumber - a.blockNumber);
    res.json(events.slice(0, 50));
  } catch (err) {
    console.error("Get agent logs failed:", err.message);
    res.status(500).json({ error: "Failed to get agent logs", details: err.message });
  }
});

router.get("/owner/:address", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const ids = await contracts.agentRegistry.getAgentsByOwner(req.params.address);

    res.json(ids.map((id) => id.toString()));
  } catch (err) {
    console.error("Get agents by owner failed:", err.message);
    res.status(500).json({ error: "Failed to get agents by owner", details: err.message });
  }
});

router.get("/reputation/:agentId", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const agentId = req.params.agentId;

    const checkpoint = await contracts.reputationStore.getCheckpoint(agentId);
    const score = await contracts.reputationStore.getScore(agentId);
    const badge = await contracts.reputationStore.getRiskBadge(agentId);

    res.json({
      score: score.toString(),
      badge: Number(badge),
      checkpoint: {
        successCount: checkpoint.successCount.toString(),
        failureCount: checkpoint.failureCount.toString(),
        attemptedViolations: checkpoint.attemptedViolations.toString(),
        totalGasUsed: checkpoint.totalGasUsed.toString(),
        lastViolationTimestamp: checkpoint.lastViolationTimestamp.toString(),
        lastSuccessTimestamp: checkpoint.lastSuccessTimestamp.toString(),
        reputationScore: checkpoint.reputationScore.toString(),
        scoreLastUpdated: checkpoint.scoreLastUpdated.toString(),
      },
    });
  } catch (err) {
    console.error("Get reputation failed:", err.message);
    res.status(500).json({ error: "Failed to get reputation", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const agentId = req.params.id;

    const agent = await contracts.agentRegistry.getAgent(agentId);
    const checkpoint = await contracts.reputationStore.getCheckpoint(agentId);
    const score = await contracts.reputationStore.getScore(agentId);
    const badge = await contracts.reputationStore.getRiskBadge(agentId);

    res.json({
      agent: {
        id: agentId,
        owner: agent.owner,
        name: agent.name,
        botType: agent.botType,
        franchiseId: agent.franchiseId.toString(),
        createdAt: agent.createdAt.toString(),
        active: agent.active,
      },
      reputation: {
        checkpoint: {
          successCount: checkpoint.successCount.toString(),
          failureCount: checkpoint.failureCount.toString(),
          attemptedViolations: checkpoint.attemptedViolations.toString(),
          totalGasUsed: checkpoint.totalGasUsed.toString(),
          lastViolationTimestamp: checkpoint.lastViolationTimestamp.toString(),
          lastSuccessTimestamp: checkpoint.lastSuccessTimestamp.toString(),
          reputationScore: checkpoint.reputationScore.toString(),
          scoreLastUpdated: checkpoint.scoreLastUpdated.toString(),
        },
        score: score.toString(),
        badge: Number(badge),
      },
    });
  } catch (err) {
    console.error("Get agent failed:", err.message);
    res.status(500).json({ error: "Failed to get agent", details: err.message });
  }
});

// Simulate an agent execution (dry-run policy check)
router.post("/simulate", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { agentId, target, action, amount } = req.body;

    if (!agentId || !target || !action) {
      return res.status(400).json({ error: "agentId, target, and action are required" });
    }

    // Check agent is active
    const agent = await contracts.agentRegistry.getAgent(agentId);
    if (!agent.active) {
      return res.json({
        willSucceed: false,
        reason: "Agent is inactive",
        policyCheck: "FAIL",
      });
    }

    // Run policy validation
    const amountWei = amount || "0";
    const { ethers } = require("ethers");
    const actionBytes = ethers.encodeBytes32String(action);

    const [valid, reason] = await contracts.policyEngine.validateExecution(
      agentId,
      target,
      actionBytes,
      amountWei
    );

    // Get current reputation
    const score = await contracts.reputationStore.getScore(agentId);
    const currentScore = Number(score);

    if (!valid) {
      return res.json({
        willSucceed: false,
        reason,
        policyCheck: "FAIL",
        currentScore,
        estimatedScoreAfter: Math.max(0, currentScore - 5),
        reputationImpact: `-${Math.min(5, currentScore)} points`,
      });
    }

    // Estimate gas (approximate)
    const estimatedGas = "45,000";

    res.json({
      willSucceed: true,
      policyCheck: "PASS",
      estimatedGas,
      currentScore,
      estimatedScoreAfter: Math.min(100, currentScore + 2),
      reputationImpact: "+2 points",
    });
  } catch (err) {
    console.error("Simulate failed:", err.message);
    res.status(500).json({ error: "Simulation failed", details: err.message });
  }
});

module.exports = router;
