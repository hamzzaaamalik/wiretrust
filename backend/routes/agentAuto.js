/**
 * Agent Automation API Routes
 *
 * POST /api/agents/auto/:id/start    — Start autonomous mode
 * POST /api/agents/auto/:id/stop     — Stop autonomous mode
 * GET  /api/agents/auto/:id/status   — Get status + logs
 * GET  /api/agents/auto/running      — List all running agents
 */

const router = require("express").Router();
const agentRunner = require("../services/agentRunner");

// Start autonomous mode for an agent
router.post("/:id/start", async (req, res) => {
  try {
    const { contracts, addresses, signer } = req.app.locals;
    const agentId = req.params.id;

    if (!signer) {
      return res.status(400).json({ error: "Server has no signer — cannot execute transactions" });
    }

    // Verify agent exists and caller owns it
    const agent = await contracts.agentRegistry.getAgent(agentId);
    if (!agent.active) {
      return res.status(400).json({ error: "Agent is inactive" });
    }

    // Config from request body
    const config = {
      botType: req.body.botType || agent.botType || "PREDICTION",
      intervalSeconds: Math.max(30, Math.min(300, Number(req.body.intervalSeconds) || 60)),
      maxActionsPerCycle: Math.min(3, Number(req.body.maxActionsPerCycle) || 1),
      predictionTypes: req.body.predictionTypes || ["MATCH_WINNER", "TOP_SCORER"],
    };

    const db = req.app.locals.db;
    const result = agentRunner.startAgent(contracts, addresses, agentId, config, db);
    res.json(result);
  } catch (err) {
    console.error("Start agent auto failed:", err.message);
    res.status(500).json({ error: "Failed to start agent", details: err.message });
  }
});

// Stop autonomous mode
router.post("/:id/stop", (req, res) => {
  const result = agentRunner.stopAgent(req.params.id);
  res.json(result);
});

// Get agent automation status + logs + insights
router.get("/:id/status", async (req, res) => {
  const db = req.app.locals.db;
  const status = await agentRunner.getAgentStatus(req.params.id, db);
  res.json(status);
});

// List all running agents
router.get("/running", (req, res) => {
  res.json(agentRunner.listRunning());
});

module.exports = router;
