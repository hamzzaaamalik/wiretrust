const router = require('express').Router();
const { requireFranchiseAdmin } = require('../middleware/auth');

// All franchise portal routes require franchise admin or super admin
router.use(requireFranchiseAdmin);

// Resolve franchise team name from on-chain registry → DB ILIKE pattern
// In franchise portal, ALWAYS scope to the franchise team (even for super admin)
async function getTeamFilter(req) {
  try {
    const { contracts } = req.app.locals;
    const f = await contracts.franchiseRegistry.getFranchise(req.franchiseId);
    if (f && f.name) return `%${f.name.replace(/^The\s+/i, '')}%`;
  } catch (err) { console.warn('[franchise-portal]', err.message); }
  return null;
}

function paginatedResponse(rows, total) {
  return { rows, total, page: 1, limit: rows.length, totalPages: 1 };
}

// ── Franchise Info ───────────────────────────────────────────
router.get('/info', async (req, res) => {
  try {
    const { contracts, provider } = req.app.locals;
    const fid = req.franchiseId;
    const f = await contracts.franchiseRegistry.getFranchise(fid);

    // Get treasury balance
    let treasuryBalance = '0';
    try {
      const bal = await provider.getBalance(f.treasuryWallet);
      const { ethers } = require('ethers');
      treasuryBalance = ethers.formatEther(bal);
    } catch (err) { console.warn('[franchise-portal]', err.message); }

    res.json({
      franchiseId: Number(f.franchiseId),
      name: f.name,
      league: f.league,
      adminWallet: f.adminWallet,
      treasuryWallet: f.treasuryWallet,
      active: f.active,
      registeredAt: Number(f.registeredAt),
      treasuryBalance,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get franchise info', details: err.message });
  }
});

// ── Dashboard Stats ──────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const fid = req.franchiseId;
    const teamPattern = await getTeamFilter(req);

    let matchCount, playerCount;
    if (teamPattern) {
      // Franchise owner: only their team's matches & players
      matchCount = await db.query(
        'SELECT count(*) as c FROM matches WHERE match_id <= 44 AND (team1 ILIKE $1 OR team2 ILIKE $1)', [teamPattern]
      ).then(r => Number(r.rows[0].c));
      playerCount = await db.query(
        'SELECT count(*) as c FROM players WHERE active = true AND team ILIKE $1', [teamPattern]
      ).then(r => Number(r.rows[0].c));
    } else {
      // Super admin: all PSL data
      matchCount = await db.query('SELECT count(*) as c FROM matches WHERE match_id <= 44').then(r => Number(r.rows[0].c));
      playerCount = await db.query('SELECT count(*) as c FROM players WHERE active = true').then(r => Number(r.rows[0].c));
    }

    const [challengeCount, contestCount] = await Promise.all([
      db.query('SELECT count(*) as c FROM challenges WHERE franchise_id = $1 AND active = true', [fid]).then(r => Number(r.rows[0].c)),
      contracts.fantasyModule.contestCount().then(c => Number(c)).catch(() => 0),
    ]);

    res.json({ matchCount, playerCount, challengeCount, contestCount, franchiseId: fid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get franchise stats', details: err.message });
  }
});

// ── Matches (scoped to franchise team) ────────────────────────
router.get('/matches', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const teamPattern = await getTeamFilter(req);

    let rows;
    if (teamPattern) {
      // Franchise owner: only matches where their team plays
      const result = await db.query(
        'SELECT * FROM matches WHERE match_id <= 44 AND (team1 ILIKE $1 OR team2 ILIKE $1) ORDER BY start_time ASC',
        [teamPattern]
      );
      rows = result.rows;
    } else {
      // Super admin: all PSL 2026 matches
      const result = await db.query('SELECT * FROM matches WHERE match_id <= 44 ORDER BY start_time ASC');
      rows = result.rows;
    }

    res.json(paginatedResponse(rows, rows.length));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

router.post('/matches', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { match_id, team1, team2, venue, start_time, status } = req.body;
    if (!match_id || !team1 || !team2) return res.status(400).json({ error: 'match_id, team1, team2 required' });

    const { rows } = await db.query(
      `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (match_id) DO UPDATE SET team1=$3, team2=$4, venue=$5, start_time=$6, status=$7
       RETURNING *`,
      [match_id, req.franchiseId, team1, team2, venue || null, start_time || null, status || 'UPCOMING']
    );
    res.json({ success: true, match: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save match' });
  }
});

router.delete('/matches/:matchId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    // Only delete matches belonging to this franchise
    await db.query('DELETE FROM match_players WHERE match_id = $1', [req.params.matchId]);
    await db.query('DELETE FROM live_match_state WHERE match_id = $1', [req.params.matchId]);
    const { rowCount } = await db.query('DELETE FROM matches WHERE match_id = $1 AND franchise_id = $2', [req.params.matchId, req.franchiseId]);
    res.json({ success: true, deleted: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

// ── Players (scoped to franchise team, or all for super admin) ──────
router.get('/players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const teamPattern = await getTeamFilter(req);

    let rows;
    if (teamPattern) {
      const result = await db.query(
        'SELECT * FROM players WHERE active = true AND team ILIKE $1 ORDER BY credits DESC, player_id',
        [teamPattern]
      );
      rows = result.rows;
    } else {
      const result = await db.query('SELECT * FROM players WHERE active = true ORDER BY team, credits DESC, player_id');
      rows = result.rows;
    }

    res.json(paginatedResponse(rows, rows.length));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get players' });
  }
});

router.post('/players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { player_id, name, team, role, credits } = req.body;
    if (!player_id || !name || !team || !role) return res.status(400).json({ error: 'player_id, name, team, role required' });

    const { rows } = await db.query(
      `INSERT INTO players (player_id, name, team, role, credits)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id) DO UPDATE SET name=$2, team=$3, role=$4, credits=$5
       RETURNING *`,
      [player_id, name, team, role, credits || 7]
    );
    res.json({ success: true, player: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save player' });
  }
});

router.delete('/players/:playerId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    await db.query('UPDATE players SET active = false WHERE player_id = $1', [req.params.playerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate player' });
  }
});

// ── Match-Player Assignment ──────────────────────────────────
router.post('/match-players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { match_id, player_id } = req.body;
    if (!match_id || !player_id) return res.status(400).json({ error: 'match_id and player_id required' });

    await db.query(
      'INSERT INTO match_players (match_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [match_id, player_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign player' });
  }
});

// ── Challenges (scoped to franchise) ─────────────────────────
router.get('/challenges', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const fid = req.franchiseId;

    const result = await db.query(
      'SELECT * FROM challenges WHERE franchise_id = $1 ORDER BY category, name',
      [fid]
    );

    res.json(paginatedResponse(result.rows, result.rows.length));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get challenges' });
  }
});

router.post('/challenges', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const c = req.body;
    if (!c.id || !c.name || !c.category || !c.condition_type) return res.status(400).json({ error: 'id, name, category, condition_type required' });

    const { rows } = await db.query(
      `INSERT INTO challenges (id, franchise_id, name, description, category, condition_type, condition_target,
        reward_name, reward_description, reward_category, max_claims)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         name=$3, description=$4, category=$5, condition_type=$6, condition_target=$7,
         reward_name=$8, reward_description=$9, reward_category=$10, max_claims=$11
       RETURNING *`,
      [c.id, req.franchiseId, c.name, c.description || '', c.category, c.condition_type,
       c.condition_target || 1, c.reward_name || c.name, c.reward_description || '',
       c.reward_category || 3, c.max_claims || 0]
    );
    res.json({ success: true, challenge: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save challenge' });
  }
});

router.delete('/challenges/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    await db.query('UPDATE challenges SET active = false WHERE id = $1 AND franchise_id = $2', [req.params.id, req.franchiseId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate challenge' });
  }
});

// ── Live Match State ─────────────────────────────────────────
router.post('/live-match', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const s = req.body;
    if (!s.match_id || !s.team1 || !s.team2) return res.status(400).json({ error: 'match_id, team1, team2 required' });

    // Verify match belongs to this franchise
    const check = await db.query('SELECT 1 FROM matches WHERE match_id = $1 AND franchise_id = $2', [s.match_id, req.franchiseId]);
    if (check.rowCount === 0 && !req.isSuperAdmin) return res.status(403).json({ error: 'Match does not belong to your franchise' });

    await db.query(
      `INSERT INTO live_match_state (match_id, team1, team2, innings, overs, score, batting, bowling, current_batsman, current_bowler, run_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (match_id) DO UPDATE SET
         innings=$4, overs=$5, score=$6, batting=$7, bowling=$8,
         current_batsman=$9, current_bowler=$10, run_rate=$11, updated_at=NOW()`,
      [s.match_id, s.team1, s.team2, s.innings||1, s.overs||'0.0', s.score||'0/0',
       s.batting||s.team1, s.bowling||s.team2, s.current_batsman||'', s.current_bowler||'', s.run_rate||'0.00']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update live match' });
  }
});

// ── Fan engagement stats ─────────────────────────────────────
router.get('/fan-stats', async (req, res) => {
  try {
    const { contracts } = req.app.locals;

    const [predCount, contestCount, nftCount] = await Promise.all([
      contracts.predictionModule.predictionCount().then(c => Number(c)).catch(() => 0),
      contracts.fantasyModule.contestCount().then(c => Number(c)).catch(() => 0),
      contracts.wireTrustNFT.tokenCount().then(c => Number(c)).catch(() => 0),
    ]);

    res.json({ predictions: predCount, contests: contestCount, nfts: nftCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get fan stats' });
  }
});

// ── Contest Management ──────────────────────────────────────
router.post('/contests/create', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { match_id, max_participants, sponsor_name, sponsor_logo, banner_url } = req.body;
    if (!match_id) return res.status(400).json({ error: 'match_id required' });

    const tx = await contracts.fantasyModule.createContest(req.franchiseId, match_id, max_participants || 0);
    const receipt = await tx.wait();

    let contestId = null;
    const iface = contracts.fantasyModule.interface;
    for (const log of receipt.logs) {
      try { const p = iface.parseLog(log); if (p?.name === 'ContestCreated') contestId = p.args.contestId?.toString(); } catch (err) { console.warn('[franchise-portal]', err.message); }
    }

    // Save sponsor branding to DB
    if (contestId && sponsor_name) {
      try {
        await db.query(
          `INSERT INTO contest_sponsors (contest_id, sponsor_name, sponsor_logo, banner_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (contest_id) DO UPDATE SET sponsor_name = $2, sponsor_logo = $3, banner_url = $4`,
          [Number(contestId), sponsor_name, sponsor_logo || null, banner_url || null]
        );
      } catch (err) { console.warn('[franchise-portal]', err.message); }
    }

    res.json({ success: true, contestId, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create contest', details: err.message });
  }
});

router.post('/contests/fund', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { contest_id, amount_wire } = req.body;
    if (!contest_id || !amount_wire) return res.status(400).json({ error: 'contest_id and amount_wire required' });

    const { ethers } = require('ethers');
    const tx = await contracts.fantasyModule.fundContest(contest_id, { value: ethers.parseEther(String(amount_wire)) });
    const receipt = await tx.wait();

    res.json({ success: true, contestId: contest_id, funded: amount_wire + ' WIRE', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fund contest', details: err.message });
  }
});

// ── Settlement (franchise-scoped) ───────────────────────────
router.post('/predictions/resolve-match', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { match_id, prediction_type, actual_outcome } = req.body;

    if (!match_id || !prediction_type || !actual_outcome) {
      return res.status(400).json({ error: 'match_id, prediction_type, and actual_outcome required' });
    }

    // Verify match belongs to franchise
    const check = await db.query('SELECT 1 FROM matches WHERE match_id = $1 AND franchise_id = $2', [match_id, req.franchiseId]);
    if (check.rowCount === 0 && !req.isSuperAdmin) return res.status(403).json({ error: 'Match does not belong to your franchise' });

    const { ethers } = require('ethers');
    const typeBytes = ethers.encodeBytes32String(prediction_type);
    const outcomeBytes = ethers.encodeBytes32String(actual_outcome);
    const tx = await contracts.predictionModule.resolveAllMatchPredictions(match_id, typeBytes, outcomeBytes);
    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve predictions', details: err.message });
  }
});

router.post('/fantasy/finalize/:contestId', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const tx = await contracts.fantasyModule.finalizeContest(req.params.contestId);
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to finalize contest', details: err.message });
  }
});

router.post('/settle-match/:matchId', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { ethers } = require('ethers');
    const matchId = Number(req.params.matchId);
    const { winner, abandoned } = req.body;

    // Verify match belongs to franchise
    const check = await db.query('SELECT 1 FROM matches WHERE match_id = $1 AND franchise_id = $2', [matchId, req.franchiseId]);
    if (check.rowCount === 0 && !req.isSuperAdmin) return res.status(403).json({ error: 'Match does not belong to your franchise' });

    const steps = [];

    // Submit result
    try {
      const tx = await contracts.matchOracle.submitResult(matchId, winner || 'NO_RESULT', abandoned || false);
      const receipt = await tx.wait();
      await db.query('UPDATE matches SET status = $1, result = $2 WHERE match_id = $3',
        [abandoned ? 'ABANDONED' : 'COMPLETED', winner || 'NO_RESULT', matchId]);
      steps.push({ step: 'submit_result', success: true, txHash: receipt.hash });
    } catch (err) {
      steps.push({ step: 'submit_result', success: false, error: err.message });
    }

    // Resolve predictions
    if (abandoned) {
      try {
        const tx = await contracts.predictionModule.cancelMatchPredictions(matchId);
        await tx.wait();
        steps.push({ step: 'cancel_predictions', success: true });
      } catch (err) {
        steps.push({ step: 'cancel_predictions', success: false, error: err.message });
      }
    } else if (winner) {
      try {
        const winnerOutcome = winner.toUpperCase().replace(/\s+/g, '_') + '_WIN';
        const typeBytes = ethers.encodeBytes32String('MATCH_WINNER');
        const outcomeBytes = ethers.encodeBytes32String(winnerOutcome);
        const tx = await contracts.predictionModule.resolveAllMatchPredictions(matchId, typeBytes, outcomeBytes);
        await tx.wait();
        steps.push({ step: 'resolve_predictions', success: true });
      } catch (err) {
        steps.push({ step: 'resolve_predictions', success: false, error: err.message });
      }
    }

    // Fantasy finalization
    try {
      const contest = await contracts.fantasyModule.contests(matchId);
      if (contest && contest.active && !contest.finalized) {
        const { rows: mpRows } = await db.query(
          'SELECT player_id, fantasy_points FROM match_players WHERE match_id = $1 AND fantasy_points IS NOT NULL', [matchId]);
        for (const mp of mpRows) {
          try { const tx = await contracts.fantasyModule.updatePlayerScore(matchId, mp.player_id, mp.fantasy_points); await tx.wait(); } catch (err) { console.warn('[franchise-portal]', err.message); }
        }
        try { const tx = await contracts.fantasyModule.lockContest(matchId); await tx.wait(); } catch (err) { console.warn('[franchise-portal]', err.message); }
        try { const tx = await contracts.fantasyModule.finalizeContest(matchId); await tx.wait(); steps.push({ step: 'finalize_contest', success: true }); } catch (err) { steps.push({ step: 'finalize_contest', success: false, error: err.message }); }
      }
    } catch (err) { console.warn('[franchise-portal]', err.message); }

    res.json({ success: steps.every(s => s.success), matchId, steps });
  } catch (err) {
    res.status(500).json({ error: 'Settlement failed', details: err.message });
  }
});

// ── Analytics (ELO + EWMA + Team Record) ─────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const teamPattern = await getTeamFilter(req);
    const { calculateTeamElos, getTeamRecord } = require('../services/cricketIntelligence');

    // ELO rankings for all PSL teams
    const elos = await calculateTeamElos(db);
    // Also get all 8 PSL teams even if they have no completed matches
    const { rows: allTeams } = await db.query('SELECT DISTINCT team FROM players WHERE active = true ORDER BY team');
    for (const t of allTeams) {
      if (!elos[t.team]) elos[t.team] = 1500; // base ELO for teams with 0 completed matches
    }
    const eloRankings = [];
    for (const [team, elo] of Object.entries(elos).sort((a, b) => b[1] - a[1])) {
      const rec = await getTeamRecord(db, team);
      const total = rec.wins + rec.losses;
      eloRankings.push({ team, elo: Math.round(elo), wins: rec.wins, losses: rec.losses, matchesPlayed: total, winRate: total > 0 ? Math.round((rec.wins / total) * 100) : 0 });
    }

    // Franchise team record
    let teamElo = 1500, teamRecord = { wins: 0, losses: 0, winRate: 0 };
    if (teamPattern) {
      const match = eloRankings.find(t => t.team.toLowerCase().includes(teamPattern.replace(/%/g, '').toLowerCase()));
      if (match) {
        teamElo = match.elo;
        const total = match.wins + match.losses;
        teamRecord = { wins: match.wins, losses: match.losses, winRate: total > 0 ? Math.round((match.wins / total) * 100) : 0 };
      }
    }

    // Players with form data (franchise scoped)
    let playerQuery = 'SELECT * FROM players WHERE active = true';
    let params = [];
    if (teamPattern) {
      playerQuery += ' AND team ILIKE $1';
      params = [teamPattern];
    }
    playerQuery += ' ORDER BY recent_form DESC NULLS LAST, credits DESC';
    const { rows: players } = await db.query(playerQuery, params);

    // Top form players across PSL
    const { rows: topFormPlayers } = await db.query(
      `SELECT name, role, team, recent_form, batting_avg, matches_played, credits
       FROM players WHERE active = true AND matches_played > 0
       ORDER BY recent_form DESC LIMIT 10`
    );

    // Venue breakdown for franchise team
    let venueBreakdown = [];
    if (teamPattern) {
      try {
        const teamName = teamPattern.replace(/%/g, '');
        const { rows: vm } = await db.query(
          `SELECT venue, COUNT(*) as total,
             COUNT(*) FILTER (WHERE result ILIKE $1) as wins
           FROM matches WHERE status = 'COMPLETED' AND (team1 ILIKE $1 OR team2 ILIKE $1) AND venue IS NOT NULL
           GROUP BY venue ORDER BY COUNT(*) DESC`,
          [teamPattern]
        );
        // Get avg runs per venue
        for (const v of vm) {
          let avgRuns = 0;
          try {
            const { rows: rr } = await db.query(
              `SELECT ROUND(AVG(sub.total_runs)) as avg FROM (
                 SELECT SUM(pms.runs) as total_runs FROM player_match_stats pms
                 JOIN matches m ON m.match_id = pms.match_id
                 WHERE m.venue = $1 AND m.status = 'COMPLETED'
                 GROUP BY pms.match_id
               ) sub`, [v.venue]
            );
            avgRuns = Number(rr[0]?.avg || 0);
          } catch (err) { console.warn('[franchise-portal]', err.message); }
          venueBreakdown.push({
            venue: v.venue, total: Number(v.total), wins: Number(v.wins),
            losses: Number(v.total) - Number(v.wins),
            winRate: Number(v.total) > 0 ? Math.round((Number(v.wins) / Number(v.total)) * 100) : 0,
            avgRuns,
          });
        }
      } catch (err) { console.warn('[franchise-portal]', err.message); }
    }

    // H2H records for franchise team vs each opponent
    let h2hRecords = [];
    if (teamPattern) {
      try {
        const { rows: h2h } = await db.query(
          `SELECT
             CASE WHEN team1 ILIKE $1 THEN team2 ELSE team1 END as opponent,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE result ILIKE $1) as wins
           FROM matches
           WHERE status = 'COMPLETED' AND result IS NOT NULL AND (team1 ILIKE $1 OR team2 ILIKE $1)
           GROUP BY CASE WHEN team1 ILIKE $1 THEN team2 ELSE team1 END
           ORDER BY COUNT(*) DESC`,
          [teamPattern]
        );
        h2hRecords = h2h.map(r => ({
          opponent: r.opponent, total: Number(r.total), wins: Number(r.wins),
          losses: Number(r.total) - Number(r.wins),
          winRate: Number(r.total) > 0 ? Math.round((Number(r.wins) / Number(r.total)) * 100) : 0,
        }));
      } catch (err) { console.warn('[franchise-portal]', err.message); }
    }

    // Momentum for franchise team
    let momentumData = null;
    if (teamPattern) {
      try {
        const { getMomentumScore } = require('../services/cricketIntelligence');
        // Find exact team name
        const matchedTeam = eloRankings.find(t => t.team.toLowerCase().includes(teamPattern.replace(/%/g, '').toLowerCase()));
        if (matchedTeam) {
          momentumData = await getMomentumScore(db, matchedTeam.team);
        }
      } catch (err) { console.warn('[franchise-portal]', err.message); }
    }

    res.json({ teamElo, teamRecord, players, topFormPlayers, eloRankings, venueBreakdown, h2hRecords, momentumData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get analytics', details: err.message });
  }
});

module.exports = router;
