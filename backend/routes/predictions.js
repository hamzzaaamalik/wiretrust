const router = require("express").Router();
const { ethers } = require("ethers");

const STATUS_MAP = ["OPEN", "RESOLVED", "CANCELLED"];

function decodeBytes32(hex) {
  try {
    return ethers.decodeBytes32String(hex);
  } catch {
    return hex;
  }
}

async function getMatchName(db, matchId) {
  const { rows } = await db.query(
    "SELECT team1, team2 FROM matches WHERE match_id = $1",
    [Number(matchId)]
  );
  if (rows.length > 0) return `${rows[0].team1} vs ${rows[0].team2}`;
  return `Match #${matchId}`;
}

function formatPrediction(p, matchName) {
  const status = STATUS_MAP[Number(p.status)] || "OPEN";
  return {
    predictionId: p.predictionId.toString(),
    franchiseId: p.franchiseId.toString(),
    predictor: p.predictor,
    matchId: p.matchId.toString(),
    matchName,
    predictionType: decodeBytes32(p.predictionType),
    predictedOutcome: decodeBytes32(p.predictedOutcome),
    status,
    correct: p.correct,
    pointsEarned: p.pointsEarned.toString(),
    createdAt: Number(p.createdAt) * 1000,
  };
}

router.get("/leaderboard", async (req, res) => {
  try {
    const { contracts, provider } = req.app.locals;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    // Gather unique predictor addresses from on-chain events
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 50000);

    const createdFilter = contracts.predictionModule.filters.PredictionCreated();
    const logs = await contracts.predictionModule.queryFilter(createdFilter, fromBlock, currentBlock).catch(() => []);

    // Collect unique addresses
    const addressSet = new Set();
    for (const log of logs) {
      const predictor = log.args?.predictor;
      if (predictor) addressSet.add(predictor.toLowerCase());
    }

    // Fetch stats for each unique predictor
    const entries = [];
    for (const addr of addressSet) {
      try {
        const stats = await contracts.predictionModule.getUserStats(addr);
        const totalPoints = Number(stats.totalPoints ?? stats[0] ?? 0);
        if (totalPoints === 0) continue;
        entries.push({
          address: addr,
          totalPoints,
          totalCorrect: Number(stats.totalCorrect ?? stats[1] ?? 0),
          totalPredictions: Number(stats.totalPredictions ?? stats[2] ?? 0),
          currentStreak: Number(stats.currentStreak ?? stats[3] ?? 0),
          accuracy: Number(stats.totalPredictions ?? stats[2]) > 0
            ? Math.round((Number(stats.totalCorrect ?? stats[1]) / Number(stats.totalPredictions ?? stats[2])) * 100)
            : 0,
        });
      } catch (err) { /* skip users that fail to load */ }
    }

    // Sort by total points descending
    entries.sort((a, b) => b.totalPoints - a.totalPoints);

    res.json({
      entries: entries.slice(0, limit),
      totalPredictors: addressSet.size,
    });
  } catch (err) {
    console.error("Get leaderboard failed:", err.message);
    res.status(500).json({ error: "Failed to get leaderboard", details: err.message });
  }
});

router.get("/match/:matchId", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const ids = await contracts.predictionModule.getMatchPredictions(req.params.matchId);

    res.json(ids.map((id) => id.toString()));
  } catch (err) {
    console.error("Get match predictions failed:", err.message);
    res.status(500).json({ error: "Failed to get match predictions", details: err.message });
  }
});

router.get("/user/:address", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const address = req.params.address;

    const predictionIds = await contracts.predictionModule.getUserPredictions(address);
    const stats = await contracts.predictionModule.getUserStats(address);

    // Fetch full details for each prediction
    const predictions = [];
    const matchNameCache = {};
    for (const id of predictionIds) {
      try {
        const p = await contracts.predictionModule.getPrediction(id);
        const mid = p.matchId.toString();
        if (!matchNameCache[mid]) {
          matchNameCache[mid] = await getMatchName(db, mid);
        }
        predictions.push(formatPrediction(p, matchNameCache[mid]));
      } catch {
        // skip invalid
      }
    }

    res.json({
      predictions,
      stats: {
        totalPoints: stats.totalPoints.toString(),
        totalCorrect: stats.totalCorrect.toString(),
        totalPredictions: stats.totalPredictions.toString(),
        currentStreak: stats.currentStreak.toString(),
      },
    });
  } catch (err) {
    console.error("Get user predictions failed:", err.message);
    res.status(500).json({ error: "Failed to get user predictions", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const p = await contracts.predictionModule.getPrediction(req.params.id);
    const matchName = await getMatchName(db, p.matchId.toString());

    res.json(formatPrediction(p, matchName));
  } catch (err) {
    console.error("Get prediction failed:", err.message);
    res.status(500).json({ error: "Failed to get prediction", details: err.message });
  }
});

module.exports = router;
