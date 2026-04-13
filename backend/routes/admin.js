const router = require('express').Router();
const { requireSuperAdmin } = require('../middleware/auth');

// All admin routes require super admin
router.use(requireSuperAdmin);

// Helper: parse pagination query params
function parsePagination(query) {
  let page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ── Dashboard stats ──────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { contracts, provider, db } = req.app.locals;

    const [
      agentCount, predCount, nftCount, contestCount,
      franchiseCount, blockNumber,
      userCount, faucetCount
    ] = await Promise.all([
      contracts.agentRegistry.agentCount().catch(() => 0n),
      contracts.predictionModule.predictionCount().catch(() => 0n),
      contracts.wireTrustNFT.tokenCount().catch(() => 0n),
      contracts.fantasyModule.contestCount().catch(() => 0n),
      contracts.franchiseRegistry.franchiseCount().catch(() => 0n),
      provider.getBlockNumber(),
      db.query('SELECT count(*) as c FROM users').then(r => r.rows[0].c),
      db.query('SELECT count(*) as c FROM faucet_history').then(r => r.rows[0].c),
    ]);

    // Treasury balance
    const treasuryAddr = await contracts.franchiseRegistry.protocolTreasury().catch(() => null);
    let treasuryBalance = '0';
    if (treasuryAddr) {
      const bal = await provider.getBalance(treasuryAddr);
      const { ethers } = require('ethers');
      treasuryBalance = ethers.formatEther(bal);
    }

    res.json({
      onChain: {
        totalAgents: Number(agentCount),
        totalPredictions: Number(predCount),
        totalNFTs: Number(nftCount),
        totalContests: Number(contestCount),
        totalFranchises: Number(franchiseCount),
        blockNumber: Number(blockNumber),
        treasuryBalance,
      },
      offChain: {
        totalUsers: Number(userCount),
        totalFaucetDrips: Number(faucetCount),
      },
    });
  } catch (err) {
    console.error('Admin stats failed:', err.message);
    res.status(500).json({ error: 'Failed to get stats', details: err.message });
  }
});

// ── Franchise Management ─────────────────────────────────────
router.get('/franchises', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const count = await contracts.franchiseRegistry.franchiseCount();
    const franchises = [];

    for (let i = 1; i <= Number(count); i++) {
      const f = await contracts.franchiseRegistry.getFranchise(i);
      franchises.push({
        franchiseId: Number(f.franchiseId),
        name: f.name,
        league: f.league,
        adminWallet: f.adminWallet,
        treasuryWallet: f.treasuryWallet,
        active: f.active,
        registeredAt: Number(f.registeredAt),
      });
    }

    res.json(franchises);
  } catch (err) {
    console.error('Get franchises failed:', err.message);
    res.status(500).json({ error: 'Failed to get franchises', details: err.message });
  }
});

// ── Match Management (DB) ────────────────────────────────────
router.get('/matches', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { page, limit, offset } = parsePagination(req.query);

    // Only show PSL 2026 season matches (match_id 1-44), historical data used for ELO/EWMA only
    const [countResult, dataResult] = await Promise.all([
      db.query('SELECT count(*) AS c FROM matches WHERE match_id <= 44'),
      db.query('SELECT * FROM matches WHERE match_id <= 44 ORDER BY start_time ASC LIMIT $1 OFFSET $2', [limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].c, 10);
    res.json({ rows: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get matches', details: err.message });
  }
});

router.post('/matches', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { match_id, franchise_id, team1, team2, venue, start_time, status } = req.body;

    if (!match_id || !team1 || !team2) {
      return res.status(400).json({ error: 'match_id, team1, and team2 are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (match_id) DO UPDATE SET
         team1 = $3, team2 = $4, venue = $5, start_time = $6, status = $7
       RETURNING *`,
      [match_id, franchise_id || 1, team1, team2, venue || null, start_time || null, status || 'UPCOMING']
    );

    res.json({ success: true, match: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save match', details: err.message });
  }
});

router.delete('/matches/:matchId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    await db.query('DELETE FROM match_players WHERE match_id = $1', [req.params.matchId]);
    await db.query('DELETE FROM live_match_state WHERE match_id = $1', [req.params.matchId]);
    const { rowCount } = await db.query('DELETE FROM matches WHERE match_id = $1', [req.params.matchId]);
    res.json({ success: true, deleted: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete match', details: err.message });
  }
});

// ── Player Management (DB) ───────────────────────────────────
router.get('/players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = req.query;

    const countWhere = search ? 'WHERE active = true AND name ILIKE $1' : 'WHERE active = true';
    const dataWhere = search ? 'WHERE active = true AND name ILIKE $3' : 'WHERE active = true';
    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];

    const [countResult, dataResult] = await Promise.all([
      db.query(`SELECT count(*) AS c FROM players ${countWhere}`, search ? [`%${search}%`] : []),
      db.query(`SELECT * FROM players ${dataWhere} ORDER BY player_id ASC LIMIT $1 OFFSET $2`, params),
    ]);

    const total = parseInt(countResult.rows[0].c, 10);
    res.json({ rows: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get players', details: err.message });
  }
});

router.post('/players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { player_id, name, team, role, credits } = req.body;

    if (!player_id || !name || !team || !role) {
      return res.status(400).json({ error: 'player_id, name, team, and role are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO players (player_id, name, team, role, credits)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id) DO UPDATE SET
         name = $2, team = $3, role = $4, credits = $5
       RETURNING *`,
      [player_id, name, team, role, credits || 7]
    );

    res.json({ success: true, player: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save player', details: err.message });
  }
});

router.delete('/players/:playerId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { rowCount } = await db.query(
      'UPDATE players SET active = false WHERE player_id = $1',
      [req.params.playerId]
    );
    res.json({ success: true, deactivated: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate player', details: err.message });
  }
});

// ── Match-Player Assignment ──────────────────────────────────
router.post('/match-players', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { match_id, player_ids } = req.body;

    if (!match_id || !Array.isArray(player_ids)) {
      return res.status(400).json({ error: 'match_id and player_ids[] required' });
    }

    const values = [];
    const params = [];
    let idx = 1;
    for (const pid of player_ids) {
      values.push(`($${idx++}, $${idx++})`);
      params.push(match_id, pid);
    }

    await db.query(
      `INSERT INTO match_players (match_id, player_id) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );

    res.json({ success: true, matchId: match_id, playersAssigned: player_ids.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign players', details: err.message });
  }
});

// ── Challenge Management (DB) ────────────────────────────────
router.get('/challenges', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { page, limit, offset } = parsePagination(req.query);

    const [countResult, dataResult] = await Promise.all([
      db.query('SELECT count(*) AS c FROM challenges'),
      db.query('SELECT * FROM challenges ORDER BY franchise_id, category LIMIT $1 OFFSET $2', [limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].c, 10);
    res.json({ rows: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get challenges', details: err.message });
  }
});

router.post('/challenges', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const c = req.body;

    if (!c.id || !c.name || !c.category || !c.condition_type) {
      return res.status(400).json({ error: 'id, name, category, and condition_type are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO challenges (id, franchise_id, name, description, category, condition_type, condition_target,
        reward_name, reward_description, reward_category, reward_face_price, reward_event_timestamp, max_claims)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, description = $4, category = $5, condition_type = $6, condition_target = $7,
         reward_name = $8, reward_description = $9, reward_category = $10, reward_face_price = $11,
         reward_event_timestamp = $12, max_claims = $13
       RETURNING *`,
      [
        c.id, c.franchise_id || 1, c.name, c.description || '',
        c.category, c.condition_type, c.condition_target || 1,
        c.reward_name || c.name, c.reward_description || '', c.reward_category || 3,
        c.reward_face_price || 0, c.reward_event_timestamp || 0, c.max_claims || 0,
      ]
    );

    res.json({ success: true, challenge: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save challenge', details: err.message });
  }
});

router.delete('/challenges/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { rowCount } = await db.query(
      'UPDATE challenges SET active = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true, deactivated: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate challenge', details: err.message });
  }
});

// ── User Management ──────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = req.query;

    const countWhere = search ? 'WHERE u.address ILIKE $1' : '';
    const dataWhere = search ? 'WHERE u.address ILIKE $3' : '';
    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];

    const [countResult, dataResult] = await Promise.all([
      db.query(`SELECT count(*) AS c FROM users u ${countWhere}`, search ? [`%${search}%`] : []),
      db.query(
        `SELECT u.*, (SELECT count(*) FROM faucet_history f WHERE f.address = u.address) as faucet_count FROM users u ${dataWhere} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
        params
      ),
    ]);

    const total = parseInt(countResult.rows[0].c, 10);
    res.json({ rows: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get users', details: err.message });
  }
});

router.get('/faucet-history', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { page, limit, offset } = parsePagination(req.query);

    const [countResult, dataResult] = await Promise.all([
      db.query('SELECT count(*) AS c FROM faucet_history'),
      db.query('SELECT * FROM faucet_history ORDER BY funded_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].c, 10);
    res.json({ rows: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get faucet history', details: err.message });
  }
});

// ── Oracle Management ────────────────────────────────────────
router.post('/oracle/submit-result', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { match_id, winner, abandoned } = req.body;

    if (!match_id || !winner) {
      return res.status(400).json({ error: 'match_id and winner required' });
    }

    // Validate winner against known teams for this match
    const { rows: matchRows } = await db.query(
      'SELECT team1, team2 FROM matches WHERE match_id = $1', [match_id]
    );
    if (matchRows.length > 0) {
      const validTeams = [matchRows[0].team1.toLowerCase(), matchRows[0].team2.toLowerCase()];
      if (!validTeams.includes(winner.toLowerCase())) {
        return res.status(400).json({ error: `winner must be one of: ${matchRows[0].team1}, ${matchRows[0].team2}` });
      }
    }

    const tx = await contracts.matchOracle.submitResult(match_id, winner, abandoned || false);
    const receipt = await tx.wait();

    // Update match status in DB
    await db.query(
      'UPDATE matches SET status = $1, result = $2 WHERE match_id = $3',
      [abandoned ? 'ABANDONED' : 'COMPLETED', winner, match_id]
    );

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit result', details: err.message });
  }
});

router.post('/oracle/submit-player-stats', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { match_id, player_id, runs, wickets, economy, strike_rate, is_motm } = req.body;

    const tx = await contracts.matchOracle.submitPlayerStats(
      match_id, player_id, runs || 0, wickets || 0, economy || 0, strike_rate || 0, is_motm || false
    );
    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit player stats', details: err.message });
  }
});

// ── Live Match State ─────────────────────────────────────────
router.post('/live-match', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const s = req.body;

    if (!s.match_id || !s.team1 || !s.team2) {
      return res.status(400).json({ error: 'match_id, team1, and team2 required' });
    }

    await db.query(
      `INSERT INTO live_match_state (match_id, team1, team2, innings, overs, score, batting, bowling, current_batsman, current_bowler, run_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (match_id) DO UPDATE SET
         innings = $4, overs = $5, score = $6, batting = $7, bowling = $8,
         current_batsman = $9, current_bowler = $10, run_rate = $11, updated_at = NOW()`,
      [s.match_id, s.team1, s.team2, s.innings || 1, s.overs || '0.0', s.score || '0/0',
       s.batting || s.team1, s.bowling || s.team2, s.current_batsman || '', s.current_bowler || '', s.run_rate || '0.00']
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update live match', details: err.message });
  }
});

// ── Treasury & Revenue ──────────────────────────────────────
router.get('/treasury', async (req, res) => {
  try {
    const { contracts, provider } = req.app.locals;
    const { ethers } = require('ethers');

    // Get protocol treasury address and balance
    const treasuryAddr = await contracts.franchiseRegistry.protocolTreasury().catch(() => null);
    let treasuryBalance = '0';
    if (treasuryAddr) {
      const bal = await provider.getBalance(treasuryAddr);
      treasuryBalance = ethers.formatEther(bal);
    }

    // Get franchise treasuries
    const franchises = [];
    try {
      const franchiseCount = await contracts.franchiseRegistry.franchiseCount();
      for (let i = 1; i <= Number(franchiseCount); i++) {
        try {
          const f = await contracts.franchiseRegistry.getFranchise(i);
          let fBal = '0';
          try {
            fBal = ethers.formatEther(await provider.getBalance(f.treasuryWallet));
          } catch (err) { console.warn('[admin]', err.message); }
          franchises.push({
            franchiseId: Number(f.franchiseId),
            name: f.name,
            treasuryWallet: f.treasuryWallet,
            balance: fBal,
          });
        } catch (err) { console.warn('[admin]', err.message); }
      }
    } catch (err) { console.warn('[admin]', err.message); }

    // Get signer balance (deployer/operator)
    const signer = req.app.locals.signer;
    let signerBalance = '0';
    try {
      if (signer) {
        signerBalance = ethers.formatEther(await provider.getBalance(signer.address));
      }
    } catch (err) { console.warn('[admin]', err.message); }

    // Count on-chain activity for revenue estimation
    const [agentCount, predCount, nftCount, contestCount] = await Promise.all([
      contracts.agentRegistry.agentCount().catch(() => 0n),
      contracts.predictionModule.predictionCount().catch(() => 0n),
      contracts.wireTrustNFT.tokenCount().catch(() => 0n),
      contracts.fantasyModule.contestCount().catch(() => 0n),
    ]);

    res.json({
      protocolTreasury: {
        address: treasuryAddr,
        balance: treasuryBalance,
      },
      signerWallet: {
        address: signer?.address || null,
        balance: signerBalance,
      },
      franchises,
      revenueStreams: {
        executionFee: '1% of agent executions',
        fantasyFee: '2% of sponsor prize pools',
        nftFee: '2.5% of NFT resales',
      },
      activityCounts: {
        totalAgents: Number(agentCount),
        totalPredictions: Number(predCount),
        totalNFTs: Number(nftCount),
        totalContests: Number(contestCount),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get treasury data', details: err.message });
  }
});

// ── Contest Management (admin) ──────────────────────────────
router.post('/contests/create', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { franchise_id, match_id, max_participants } = req.body;
    if (!franchise_id || !match_id) return res.status(400).json({ error: 'franchise_id and match_id required' });

    const tx = await contracts.fantasyModule.createContest(franchise_id, match_id, max_participants || 0);
    const receipt = await tx.wait();

    let contestId = null;
    const iface = contracts.fantasyModule.interface;
    for (const log of receipt.logs) {
      try { const p = iface.parseLog(log); if (p?.name === 'ContestCreated') contestId = p.args.contestId?.toString(); } catch (err) { console.warn('[admin]', err.message); }
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

// ── Prediction Resolution ───────────────────────────────────
router.post('/predictions/resolve', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { prediction_id, actual_outcome } = req.body;

    if (!prediction_id || !actual_outcome) {
      return res.status(400).json({ error: 'prediction_id and actual_outcome required' });
    }

    const { ethers } = require('ethers');
    const outcomeBytes = ethers.encodeBytes32String(actual_outcome);
    const tx = await contracts.predictionModule.resolvePrediction(prediction_id, outcomeBytes);
    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve prediction', details: err.message });
  }
});

router.post('/predictions/resolve-match', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { match_id, prediction_type, actual_outcome } = req.body;

    if (!match_id || !prediction_type || !actual_outcome) {
      return res.status(400).json({ error: 'match_id, prediction_type, and actual_outcome required' });
    }

    const { ethers } = require('ethers');
    const typeBytes = ethers.encodeBytes32String(prediction_type);
    const outcomeBytes = ethers.encodeBytes32String(actual_outcome);
    const tx = await contracts.predictionModule.resolveAllMatchPredictions(match_id, typeBytes, outcomeBytes);
    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve match predictions', details: err.message });
  }
});

router.post('/predictions/cancel-match', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { match_id } = req.body;

    if (!match_id) {
      return res.status(400).json({ error: 'match_id required' });
    }

    const tx = await contracts.predictionModule.cancelMatchPredictions(match_id);
    const receipt = await tx.wait();

    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel match predictions', details: err.message });
  }
});

// ── Fantasy Contest Management ──────────────────────────────
router.post('/fantasy/lock/:contestId', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const tx = await contracts.fantasyModule.lockContest(req.params.contestId);
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to lock contest', details: err.message });
  }
});

router.post('/fantasy/update-scores', async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { contest_id, player_scores } = req.body;

    if (!contest_id || !Array.isArray(player_scores)) {
      return res.status(400).json({ error: 'contest_id and player_scores[] required' });
    }

    const results = [];
    for (const { player_id, points } of player_scores) {
      try {
        const tx = await contracts.fantasyModule.updatePlayerScore(contest_id, player_id, points);
        const receipt = await tx.wait();
        results.push({ player_id, points, txHash: receipt.hash, success: true });
      } catch (err) {
        results.push({ player_id, points, error: err.message, success: false });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update scores', details: err.message });
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

// ── One-Click Match Settlement ──────────────────────────────
router.post('/settle-match/:matchId', async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { ethers } = require('ethers');
    const matchId = Number(req.params.matchId);
    const { winner, abandoned } = req.body;

    if (!winner && !abandoned) {
      return res.status(400).json({ error: 'winner or abandoned flag required' });
    }

    // Validate winner against known teams for this match
    if (winner) {
      const { rows: matchRows } = await db.query(
        'SELECT team1, team2 FROM matches WHERE match_id = $1', [matchId]
      );
      if (matchRows.length > 0) {
        const validTeams = [matchRows[0].team1.toLowerCase(), matchRows[0].team2.toLowerCase()];
        if (!validTeams.includes(winner.toLowerCase())) {
          return res.status(400).json({ error: `winner must be one of: ${matchRows[0].team1}, ${matchRows[0].team2}` });
        }
      }
    }

    const steps = [];

    // Step 1: Submit result to oracle
    try {
      const tx = await contracts.matchOracle.submitResult(matchId, winner || 'NO_RESULT', abandoned || false);
      const receipt = await tx.wait();
      await db.query(
        'UPDATE matches SET status = $1, result = $2 WHERE match_id = $3',
        [abandoned ? 'ABANDONED' : 'COMPLETED', winner || 'NO_RESULT', matchId]
      );
      steps.push({ step: 'submit_result', success: true, txHash: receipt.hash });
    } catch (err) {
      steps.push({ step: 'submit_result', success: false, error: err.message });
    }

    // Step 2: Submit player stats from DB match_players
    try {
      const { rows: mpRows } = await db.query(
        'SELECT mp.player_id, mp.fantasy_points FROM match_players mp WHERE mp.match_id = $1 AND mp.fantasy_points IS NOT NULL',
        [matchId]
      );
      for (const mp of mpRows) {
        try {
          const tx = await contracts.matchOracle.submitPlayerStats(
            matchId, mp.player_id, 0, 0, 0, 0, false
          );
          await tx.wait();
        } catch (err) { console.warn('[admin]', err.message); }
      }
      steps.push({ step: 'submit_player_stats', success: true, count: mpRows.length });
    } catch (err) {
      steps.push({ step: 'submit_player_stats', success: false, error: err.message });
    }

    // Step 3: Resolve predictions — handle abandoned matches
    if (abandoned) {
      try {
        const tx = await contracts.predictionModule.cancelMatchPredictions(matchId);
        const receipt = await tx.wait();
        steps.push({ step: 'cancel_predictions', success: true, txHash: receipt.hash });
      } catch (err) {
        steps.push({ step: 'cancel_predictions', success: false, error: err.message });
      }
    } else {
      // Resolve MATCH_WINNER predictions
      try {
        const winnerOutcome = winner.toUpperCase().replace(/\s+/g, '_') + '_WIN';
        const typeBytes = ethers.encodeBytes32String('MATCH_WINNER');
        const outcomeBytes = ethers.encodeBytes32String(winnerOutcome);
        const tx = await contracts.predictionModule.resolveAllMatchPredictions(matchId, typeBytes, outcomeBytes);
        const receipt = await tx.wait();
        steps.push({ step: 'resolve_match_winner', success: true, txHash: receipt.hash, outcome: winnerOutcome });
      } catch (err) {
        steps.push({ step: 'resolve_match_winner', success: false, error: err.message });
      }
    }

    // Step 4: Update fantasy player scores from DB
    try {
      const { rows: mpRows } = await db.query(
        'SELECT mp.player_id, mp.fantasy_points FROM match_players mp WHERE mp.match_id = $1 AND mp.fantasy_points IS NOT NULL',
        [matchId]
      );

      // Find contest for this match
      let contestId = null;
      try {
        const contest = await contracts.fantasyModule.contests(matchId);
        if (contest && contest.active) contestId = matchId;
      } catch (err) { console.warn('[admin]', err.message); }

      if (contestId && mpRows.length > 0) {
        for (const mp of mpRows) {
          try {
            const tx = await contracts.fantasyModule.updatePlayerScore(contestId, mp.player_id, mp.fantasy_points);
            await tx.wait();
          } catch (err) { console.warn('[admin]', err.message); }
        }
        steps.push({ step: 'update_fantasy_scores', success: true, contestId, count: mpRows.length });

        // Step 5: Lock + Finalize contest
        try {
          const lockTx = await contracts.fantasyModule.lockContest(contestId);
          await lockTx.wait();
          steps.push({ step: 'lock_contest', success: true });
        } catch (err) {
          steps.push({ step: 'lock_contest', success: false, error: err.message });
        }

        try {
          const finTx = await contracts.fantasyModule.finalizeContest(contestId);
          const finReceipt = await finTx.wait();
          steps.push({ step: 'finalize_contest', success: true, txHash: finReceipt.hash });
        } catch (err) {
          steps.push({ step: 'finalize_contest', success: false, error: err.message });
        }
      } else {
        steps.push({ step: 'update_fantasy_scores', success: true, note: 'No contest or no scored players' });
      }
    } catch (err) {
      steps.push({ step: 'fantasy_settlement', success: false, error: err.message });
    }

    const allSuccess = steps.every((s) => s.success);
    res.json({ success: allSuccess, matchId, steps });
  } catch (err) {
    res.status(500).json({ error: 'Settlement failed', details: err.message });
  }
});

module.exports = router;
