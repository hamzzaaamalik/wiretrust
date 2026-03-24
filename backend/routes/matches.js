const router = require("express").Router();
const oracleService = require("../services/oracleService");

router.get("/live", async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { rows } = await db.query("SELECT * FROM live_match_state LIMIT 1");
    if (rows.length === 0) return res.json(null);
    const r = rows[0];
    res.json({
      matchId: r.match_id,
      team1: r.team1,
      team2: r.team2,
      innings: r.innings,
      overs: r.overs,
      score: r.score,
      batting: r.batting,
      bowling: r.bowling,
      currentBatsman: r.current_batsman,
      currentBowler: r.current_bowler,
      runRate: r.run_rate,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    console.error("Get live matches failed:", err.message);
    res.status(500).json({ error: "Failed to get live matches", details: err.message });
  }
});

router.get("/schedule", async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { rows } = await db.query("SELECT * FROM matches ORDER BY start_time ASC");
    res.json(rows.map(m => ({
      matchId: m.match_id,
      id: m.match_id,
      franchiseId: m.franchise_id,
      team1: m.team1,
      team2: m.team2,
      venue: m.venue,
      startTime: m.start_time,
      status: m.status,
      result: m.result,
      date: m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    })));
  } catch (err) {
    console.error("Get schedule failed:", err.message);
    res.status(500).json({ error: "Failed to get schedule", details: err.message });
  }
});

router.get("/players", async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { rows } = await db.query("SELECT * FROM players WHERE active = true ORDER BY player_id ASC");
    res.json(rows.map(p => ({
      id: p.player_id,
      playerId: p.player_id,
      name: p.name,
      team: p.team,
      role: p.role,
      credits: Number(p.credits),
      imageUrl: p.image_url,
    })));
  } catch (err) {
    console.error("Get players failed:", err.message);
    res.status(500).json({ error: "Failed to get players", details: err.message });
  }
});

router.get("/players/:matchId", async (req, res) => {
  try {
    const { db } = req.app.locals;
    const matchId = Number(req.params.matchId);

    // First try match_players join (for CricAPI-synced matches)
    const { rows } = await db.query(
      `SELECT p.* FROM players p
       JOIN match_players mp ON mp.player_id = p.player_id
       WHERE mp.match_id = $1 AND p.active = true
       ORDER BY p.player_id ASC`,
      [matchId]
    );

    if (rows.length > 0) {
      return res.json(rows.map(p => ({
        id: p.player_id,
        playerId: p.player_id,
        name: p.name,
        team: p.team,
        role: p.role,
        credits: Number(p.credits),
        imageUrl: p.image_url,
      })));
    }

    // Fallback: get match teams and filter players by team name
    const matchRes = await db.query(
      `SELECT team1, team2 FROM matches WHERE match_id = $1`,
      [matchId]
    );
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }

    const { team1, team2 } = matchRes.rows[0];
    const teamPlayers = await db.query(
      `SELECT * FROM players
       WHERE active = true AND (LOWER(team) = LOWER($1) OR LOWER(team) = LOWER($2))
       ORDER BY credits DESC, player_id ASC`,
      [team1, team2]
    );

    if (teamPlayers.rows.length === 0) {
      return res.status(404).json({ error: "No players found for match teams" });
    }

    res.json(teamPlayers.rows.map(p => ({
      id: p.player_id,
      playerId: p.player_id,
      name: p.name,
      team: p.team,
      role: p.role,
      credits: Number(p.credits),
      imageUrl: p.image_url,
    })));
  } catch (err) {
    console.error("Get match players failed:", err.message);
    res.status(500).json({ error: "Failed to get match players", details: err.message });
  }
});

router.post("/simulate", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const matchId = req.body.matchId || 4;

    // Build player stats from DB
    const { db } = req.app.locals;
    const { rows: playerRows } = await db.query(
      `SELECT p.player_id, p.name FROM players p
       JOIN match_players mp ON mp.player_id = p.player_id
       WHERE mp.match_id = $1`,
      [matchId]
    );

    const mockPlayerStats = playerRows.map(p => ({
      playerId: p.player_id,
      runs: Math.floor(Math.random() * 80),
      wickets: Math.floor(Math.random() * 3),
      economy: 600 + Math.floor(Math.random() * 300),
      strikeRate: 100 + Math.floor(Math.random() * 80),
      isMotm: false,
    }));
    if (mockPlayerStats.length > 0) mockPlayerStats[0].isMotm = true;

    const result = await oracleService.simulateMatch(contracts.matchOracle, matchId, mockPlayerStats, null, db);

    res.json({
      success: true,
      matchId: result.matchId || matchId,
      txHash: result.txHash,
      playerTxHashes: result.playerTxHashes,
    });
  } catch (err) {
    console.error("Simulate match failed:", err.message);
    res.status(500).json({ error: "Failed to simulate match", details: err.message });
  }
});

module.exports = router;
