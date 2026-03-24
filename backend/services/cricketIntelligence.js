/**
 * Cricket Intelligence Engine — ELO ratings + EWMA player form.
 *
 * Uses proven sports analytics algorithms:
 *   1. ELO Rating System (used by ICC, FIFA) for team strength
 *   2. Exponential Weighted Moving Average for player form
 *   3. Logistic win probability from ELO difference
 *   4. Player Impact Score combining form + consistency + matchup
 *
 * Self-learning: recalculates from all historical match data.
 * No external ML libs — pure math.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_ELO = 1500;       // Starting ELO for new teams
const K_FACTOR = 32;          // ELO sensitivity (ICC uses ~40 for ODIs)
const FORM_DECAY = 0.3;       // EWMA decay factor (higher = more weight on recent)
const HOME_ADVANTAGE = 30;    // ELO points added for home team

// ─── ELO System ──────────────────────────────────────────────────────────────

/**
 * Calculate expected win probability from ELO difference.
 * Returns 0-1 probability for team A winning.
 */
function expectedWinProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Update ELO ratings after a match result.
 * @returns {{ newEloA, newEloB, change }}
 */
function updateElo(eloA, eloB, aWon) {
  const expected = expectedWinProb(eloA, eloB);
  const actual = aWon ? 1 : 0;
  const change = Math.round(K_FACTOR * (actual - expected));
  return {
    newEloA: eloA + change,
    newEloB: eloB - change,
    change: Math.abs(change),
  };
}

/**
 * Calculate team ELO ratings from all completed matches.
 * Processes matches chronologically to build up ratings.
 */
async function calculateTeamElos(db) {
  const elos = {};

  const { rows: matches } = await db.query(
    `SELECT match_id, team1, team2, result, start_time
     FROM matches WHERE status = 'COMPLETED' AND result IS NOT NULL
     ORDER BY COALESCE(start_time, created_at) ASC`
  );

  for (const m of matches) {
    if (!elos[m.team1]) elos[m.team1] = BASE_ELO;
    if (!elos[m.team2]) elos[m.team2] = BASE_ELO;

    const team1Won = m.result.toLowerCase() === m.team1.toLowerCase();
    const { newEloA, newEloB } = updateElo(elos[m.team1], elos[m.team2], team1Won);
    elos[m.team1] = newEloA;
    elos[m.team2] = newEloB;
  }

  return elos;
}

// ─── Player Form (EWMA) ─────────────────────────────────────────────────────

/**
 * Calculate Exponential Weighted Moving Average for a player's fantasy points.
 * More recent matches get exponentially higher weight.
 *
 * @param {number[]} points - fantasy points array, newest first
 * @returns {{ ewma, trend, consistency, peakForm, recentAvg }}
 */
function calculateEWMA(points) {
  if (!points.length) return { ewma: 0, trend: 'unknown', consistency: 0, peakForm: 0, recentAvg: 0 };

  // EWMA calculation: weight_i = (1-α)^i, newest = highest weight
  let ewma = points[0];
  for (let i = 1; i < points.length; i++) {
    ewma = FORM_DECAY * points[i] + (1 - FORM_DECAY) * ewma;
  }
  // Reverse: we want recent weighted more, so recalculate properly
  ewma = 0;
  let weightSum = 0;
  for (let i = 0; i < points.length; i++) {
    const weight = Math.pow(1 - FORM_DECAY, i); // i=0 (newest) gets weight 1.0
    ewma += points[i] * weight;
    weightSum += weight;
  }
  ewma = weightSum > 0 ? ewma / weightSum : 0;

  // Trend: compare first half vs second half
  const mid = Math.floor(points.length / 2) || 1;
  const recentHalf = points.slice(0, mid);
  const olderHalf = points.slice(mid);
  const recentAvg = recentHalf.reduce((s, v) => s + v, 0) / recentHalf.length;
  const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, v) => s + v, 0) / olderHalf.length : recentAvg;

  let trend = 'steady';
  if (recentAvg > olderAvg * 1.15) trend = 'rising';
  else if (recentAvg < olderAvg * 0.85) trend = 'declining';

  // Consistency: lower std dev = more reliable
  const mean = points.reduce((s, v) => s + v, 0) / points.length;
  const variance = points.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / points.length;
  const stdDev = Math.sqrt(variance);
  const consistency = mean > 0 ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / mean) * 100))) : 0;

  const peakForm = Math.max(...points);

  return {
    ewma: Math.round(ewma * 10) / 10,
    trend,
    consistency,
    peakForm,
    recentAvg: Math.round(recentAvg * 10) / 10,
  };
}

/**
 * Get EWMA form data for all players in specified teams.
 */
async function getPlayerForms(db, team1, team2) {
  const { rows: players } = await db.query(
    `SELECT p.player_id, p.name, p.team, p.role, p.credits
     FROM players p WHERE p.active = true AND (p.team = $1 OR p.team = $2)
     ORDER BY p.credits DESC`,
    [team1, team2]
  );

  const forms = {};
  for (const p of players) {
    const { rows: stats } = await db.query(
      `SELECT fantasy_points, runs, wickets FROM player_match_stats
       WHERE player_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [p.player_id]
    );

    const points = stats.map(s => s.fantasy_points);
    const ewmaData = calculateEWMA(points);

    forms[p.player_id] = {
      ...p,
      ...ewmaData,
      matchesPlayed: points.length,
      totalRuns: stats.reduce((s, r) => s + r.runs, 0),
      totalWickets: stats.reduce((s, r) => s + r.wickets, 0),
    };
  }

  return forms;
}

// ─── Match Intelligence ──────────────────────────────────────────────────────

/**
 * Generate full match intelligence report using 6-factor composite model.
 *
 * Factors: ELO (25%) + EWMA Form (20%) + H2H (15%) + Momentum (15%) + Venue (15%) + Role-Weighted (10%)
 * When a factor has insufficient data, its weight redistributes to ELO + Form.
 *
 * @returns Full intelligence object with all factor scores, predictions, and reasoning.
 */
async function analyzeMatch(db, team1, team2, venue = null) {
  // ── Factor 1: ELO-based win probability ──
  const elos = await calculateTeamElos(db);
  const elo1 = elos[team1] || BASE_ELO;
  const elo2 = elos[team2] || BASE_ELO;
  const winProb1 = expectedWinProb(elo1, elo2);

  // ── Factor 2: EWMA Player form ──
  const forms = await getPlayerForms(db, team1, team2);
  const team1Players = Object.values(forms).filter(p => p.team === team1);
  const team2Players = Object.values(forms).filter(p => p.team === team2);
  const team1TopForm = team1Players.sort((a, b) => b.ewma - a.ewma).slice(0, 6);
  const team2TopForm = team2Players.sort((a, b) => b.ewma - a.ewma).slice(0, 6);
  const team1FormAvg = team1TopForm.length > 0 ? team1TopForm.reduce((s, p) => s + p.ewma, 0) / team1TopForm.length : 0;
  const team2FormAvg = team2TopForm.length > 0 ? team2TopForm.reduce((s, p) => s + p.ewma, 0) / team2TopForm.length : 0;
  const formFactor1 = (team1FormAvg + team2FormAvg) > 0 ? team1FormAvg / (team1FormAvg + team2FormAvg) : 0.5;

  // ── Factor 3: Head-to-Head ──
  const h2h = await getHeadToHead(db, team1, team2);

  // ── Factor 4: Momentum ──
  const mom1 = await getMomentumScore(db, team1);
  const mom2 = await getMomentumScore(db, team2);
  const momFactor1 = (mom1.momentum + mom2.momentum) > 0 ? mom1.momentum / (mom1.momentum + mom2.momentum) : 0.5;

  // ── Factor 5: Venue Analysis ──
  const venueData = await analyzeVenue(db, venue, team1, team2);
  const tossData = await getTossImpact(db, venue);

  // ── Factor 6: Role-Weighted Form ──
  const roleData = await getRoleWeightedForm(db, team1, team2);
  const rwFactor1 = (roleData.team1Weighted + roleData.team2Weighted) > 0
    ? roleData.team1Weighted / (roleData.team1Weighted + roleData.team2Weighted) : 0.5;

  // ── Player vs Team Matchups (for top scorer + squad) ──
  const allPlayerIds = Object.values(forms).map(p => p.player_id);
  const matchupsVsT2 = await getPlayerVsTeamBatch(db, allPlayerIds, team2);
  const matchupsVsT1 = await getPlayerVsTeamBatch(db, allPlayerIds, team1);
  // Merge: for team1 players, matchup is vs team2; for team2 players, matchup is vs team1
  const playerMatchups = new Map();
  for (const p of team1Players) { const m = matchupsVsT2.get(p.player_id); if (m) playerMatchups.set(p.player_id, m); }
  for (const p of team2Players) { const m = matchupsVsT1.get(p.player_id); if (m) playerMatchups.set(p.player_id, m); }

  // ── 6-Factor Composite Model ──
  const baseWeights = { elo: 0.25, form: 0.20, h2h: 0.15, momentum: 0.15, venue: 0.15, roleWeighted: 0.10 };

  // Redistribute weight if factor has insufficient data
  let redistribution = 0;
  if (h2h.totalMatches < 3) { redistribution += baseWeights.h2h; baseWeights.h2h = 0; }
  if (venueData.venueMatches < 3) { redistribution += baseWeights.venue; baseWeights.venue = 0; }
  if (roleData.team1Weighted === 0 && roleData.team2Weighted === 0) { redistribution += baseWeights.roleWeighted; baseWeights.roleWeighted = 0; }
  // Redistribute to ELO + Form
  baseWeights.elo += redistribution * 0.6;
  baseWeights.form += redistribution * 0.4;

  const factors = {
    elo: winProb1,
    form: formFactor1,
    h2h: h2h.team1H2HRate,
    momentum: momFactor1,
    venue: venueData.team1VenueWinRate / 100,
    roleWeighted: rwFactor1,
  };

  const composite1 = Object.entries(baseWeights).reduce(
    (sum, [key, w]) => sum + (factors[key] ?? 0.5) * w, 0
  );
  const composite2 = 1 - composite1;

  const predictedWinner = composite1 >= composite2 ? team1 : team2;
  const confidence = Math.round(Math.max(composite1, composite2) * 100);

  // ── Top scorer prediction (EWMA + matchup boost) ──
  const allBatters = Object.values(forms)
    .filter(p => (p.role === 'BAT' || p.role === 'ALL' || p.role === 'WK') && p.matchesPlayed > 0)
    .map(p => {
      const matchup = playerMatchups.get(p.player_id);
      const matchupBoost = (matchup && matchup.matches >= 2 && matchup.avgFP > p.ewma) ? matchup.avgFP * 0.2 : 0;
      return { ...p, adjustedScore: p.ewma + matchupBoost, matchup };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore);
  const topScorer = allBatters[0] || null;

  // ── Value picks ──
  const valuePicks = Object.values(forms)
    .filter(p => p.matchesPlayed > 0 && p.ewma > 0)
    .map(p => ({ ...p, valueRatio: p.ewma / Number(p.credits) }))
    .sort((a, b) => b.valueRatio - a.valueRatio)
    .slice(0, 5);

  // ── Build rich reasoning ──
  const winnerWR = await getTeamRecord(db, predictedWinner);
  const loserName = predictedWinner === team1 ? team2 : team1;

  const reasoning = [
    `6-Factor Analysis: ${team1} (${elo1} ELO) vs ${team2} (${elo2} ELO).`,
    `ELO: ${team1} ${(winProb1 * 100).toFixed(1)}% win probability.`,
    `Form: ${team1} EWMA ${team1FormAvg.toFixed(1)} | ${team2} EWMA ${team2FormAvg.toFixed(1)}.`,
    h2h.totalMatches > 0 ? h2h.reasoning : '',
    mom1.lastResults.length > 0 ? `Momentum: ${team1} ${mom1.momentum}/100 (${mom1.trajectory}) | ${team2} ${mom2.momentum}/100 (${mom2.trajectory}).` : '',
    venueData.venueMatches > 0 ? venueData.reasoning : '',
    tossData.venueType !== 'balanced' ? tossData.reasoning : '',
    roleData.reasoning,
    `${predictedWinner} record: ${winnerWR.wins}W-${winnerWR.losses}L.`,
    topScorer ? `Top scorer: ${topScorer.name} (EWMA ${topScorer.ewma}, ${topScorer.trend}${topScorer.matchup ? `, vs ${loserName}: ${topScorer.matchup.avgFP} avg FP` : ''}).` : '',
    `Composite (6-factor): ${confidence}% confidence for ${predictedWinner}.`,
  ].filter(Boolean).join(' ');

  return {
    // Core predictions
    elo: { [team1]: elo1, [team2]: elo2 },
    winProbability: { [team1]: Math.round(winProb1 * 1000) / 10, [team2]: Math.round((1 - winProb1) * 1000) / 10 },
    compositeScore: { [team1]: Math.round(composite1 * 1000) / 10, [team2]: Math.round(composite2 * 1000) / 10 },
    predictedWinner,
    confidence,
    // Factor data
    teamForm: { [team1]: Math.round(team1FormAvg * 10) / 10, [team2]: Math.round(team2FormAvg * 10) / 10 },
    headToHead: h2h,
    momentum: { [team1]: mom1, [team2]: mom2 },
    venue: venueData,
    tossImpact: tossData,
    roleWeighted: roleData,
    playerMatchups, // Map<playerId, {matches, avgRuns, avgWickets, avgFP, bestScore}>
    factorWeights: baseWeights,
    factorScores: factors,
    // Player analysis
    topScorer: topScorer ? {
      name: topScorer.name, team: topScorer.team, role: topScorer.role,
      ewma: topScorer.ewma, trend: topScorer.trend, consistency: topScorer.consistency,
      recentAvg: topScorer.recentAvg, peakForm: topScorer.peakForm,
      matchup: topScorer.matchup || null,
    } : null,
    valuePicks: valuePicks.map(p => ({
      name: p.name, team: p.team, role: p.role, credits: Number(p.credits),
      ewma: p.ewma, valueRatio: Math.round(p.valueRatio * 10) / 10, trend: p.trend,
    })),
    forms,
    reasoning,
  };
}

async function getTeamRecord(db, teamName) {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE result = $1) AS wins,
         COUNT(*) - COUNT(*) FILTER (WHERE result = $1) AS losses
       FROM matches
       WHERE status = 'COMPLETED' AND (team1 = $1 OR team2 = $1)`,
      [teamName]
    );
    return { wins: Number(rows[0].wins), losses: Number(rows[0].losses) };
  } catch { return { wins: 0, losses: 0 }; }
}

// ─── Head-to-Head Records ───────────────────────────────────────────────────

/**
 * Get historical head-to-head record between two teams.
 */
async function getHeadToHead(db, team1, team2) {
  try {
    const { rows } = await db.query(
      `SELECT result, start_time FROM matches
       WHERE status = 'COMPLETED' AND result IS NOT NULL
         AND ((team1 = $1 AND team2 = $2) OR (team1 = $2 AND team2 = $1))
       ORDER BY COALESCE(start_time, created_at) DESC`,
      [team1, team2]
    );

    if (rows.length === 0) {
      return { team1Wins: 0, team2Wins: 0, totalMatches: 0, team1H2HRate: 0.5, dominantTeam: null, recentResults: [], reasoning: `No head-to-head history between ${team1} and ${team2}.` };
    }

    let t1W = 0, t2W = 0;
    const recentResults = [];
    for (const r of rows) {
      const won1 = r.result.toLowerCase() === team1.toLowerCase();
      if (won1) t1W++; else t2W++;
      if (recentResults.length < 5) recentResults.push(won1 ? team1 : team2);
    }

    const total = t1W + t2W;
    const t1Rate = total > 0 ? t1W / total : 0.5;
    const dominant = t1W > t2W ? team1 : t2W > t1W ? team2 : null;
    const recentT1 = recentResults.filter(t => t === team1).length;

    return {
      team1Wins: t1W, team2Wins: t2W, totalMatches: total,
      team1H2HRate: t1Rate,
      dominantTeam: dominant,
      recentResults,
      reasoning: `H2H: ${team1} ${t1W}W vs ${team2} ${t2W}W from ${total} meetings. Recent 5: ${team1} won ${recentT1}.`,
    };
  } catch { return { team1Wins: 0, team2Wins: 0, totalMatches: 0, team1H2HRate: 0.5, dominantTeam: null, recentResults: [], reasoning: '' }; }
}

// ─── Momentum Scoring ───────────────────────────────────────────────────────

/**
 * Calculate team momentum from last 8 matches.
 * Weighted scoring — recent matches count more. Streak detection.
 */
async function getMomentumScore(db, teamName) {
  try {
    const { rows } = await db.query(
      `SELECT result, team1, team2 FROM matches
       WHERE status = 'COMPLETED' AND result IS NOT NULL AND (team1 = $1 OR team2 = $1)
       ORDER BY COALESCE(start_time, created_at) DESC LIMIT 8`,
      [teamName]
    );

    if (rows.length === 0) {
      return { momentum: 50, streak: 0, streakType: 'none', lastResults: [], trajectory: 'steady', reasoning: `No recent match data for ${teamName}.` };
    }

    const results = rows.map(r => r.result.toLowerCase() === teamName.toLowerCase() ? 'W' : 'L');

    // Weighted momentum: most recent = weight N, decreasing
    let weighted = 0, maxWeighted = 0;
    for (let i = 0; i < results.length; i++) {
      const w = results.length - i; // newest gets highest weight
      maxWeighted += w;
      if (results[i] === 'W') weighted += w;
    }
    let momentum = Math.round((weighted / maxWeighted) * 100);

    // Streak detection
    let streak = 1;
    const streakType = results[0];
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++; else break;
    }
    if (streak >= 3 && streakType === 'W') momentum = Math.min(100, momentum + 10);
    if (streak >= 3 && streakType === 'L') momentum = Math.max(0, momentum - 10);

    // Trajectory: first half vs second half
    const mid = Math.floor(results.length / 2) || 1;
    const recentWins = results.slice(0, mid).filter(r => r === 'W').length / mid;
    const olderWins = results.slice(mid).filter(r => r === 'W').length / (results.length - mid);
    const trajectory = recentWins > olderWins + 0.15 ? 'rising' : recentWins < olderWins - 0.15 ? 'falling' : 'steady';

    return {
      momentum, streak, streakType: streakType === 'W' ? 'winning' : 'losing',
      lastResults: results,
      trajectory,
      reasoning: `Momentum ${momentum}/100. ${streak >= 2 ? `On a ${streak}${streakType} streak.` : ''} Form: ${results.join('')}. ${trajectory === 'rising' ? 'Trending up.' : trajectory === 'falling' ? 'Trending down.' : 'Steady form.'}`,
    };
  } catch { return { momentum: 50, streak: 0, streakType: 'none', lastResults: [], trajectory: 'steady', reasoning: '' }; }
}

// ─── Venue Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze team performance at a specific venue.
 */
async function analyzeVenue(db, venue, team1, team2) {
  const defaultResult = { venueAvgRuns: 160, team1VenueWins: 0, team1VenueTotal: 0, team2VenueWins: 0, team2VenueTotal: 0, team1VenueWinRate: 50, team2VenueWinRate: 50, highScoringVenue: false, venueMatches: 0, reasoning: '' };
  if (!venue) return defaultResult;

  try {
    // Extract venue keyword (first significant word)
    const venueKey = venue.split(',')[0].split(' ').filter(w => w.length > 3)[0] || venue.split(',')[0];
    const venuePattern = `%${venueKey}%`;

    // Get all completed matches at this venue
    const { rows: venueMatches } = await db.query(
      `SELECT match_id, team1, team2, result FROM matches
       WHERE status = 'COMPLETED' AND result IS NOT NULL AND venue ILIKE $1`,
      [venuePattern]
    );

    if (venueMatches.length === 0) return { ...defaultResult, reasoning: `No historical data for ${venue}.` };

    // Team-specific records at venue
    let t1W = 0, t1T = 0, t2W = 0, t2T = 0;
    for (const m of venueMatches) {
      if (m.team1 === team1 || m.team2 === team1) {
        t1T++;
        if (m.result.toLowerCase() === team1.toLowerCase()) t1W++;
      }
      if (m.team1 === team2 || m.team2 === team2) {
        t2T++;
        if (m.result.toLowerCase() === team2.toLowerCase()) t2W++;
      }
    }

    // Average runs at venue
    const matchIds = venueMatches.map(m => m.match_id);
    let venueAvgRuns = 160;
    if (matchIds.length > 0) {
      const { rows: runData } = await db.query(
        `SELECT match_id, SUM(runs) as total_runs FROM player_match_stats
         WHERE match_id = ANY($1) GROUP BY match_id`,
        [matchIds]
      );
      if (runData.length > 0) {
        venueAvgRuns = Math.round(runData.reduce((s, r) => s + Number(r.total_runs), 0) / runData.length);
      }
    }

    const highScoring = venueAvgRuns > 165;
    const t1WR = t1T > 0 ? Math.round((t1W / t1T) * 100) : 50;
    const t2WR = t2T > 0 ? Math.round((t2W / t2T) * 100) : 50;
    const venueName = venue.split(',')[0];

    return {
      venueAvgRuns, team1VenueWins: t1W, team1VenueTotal: t1T,
      team2VenueWins: t2W, team2VenueTotal: t2T,
      team1VenueWinRate: t1WR, team2VenueWinRate: t2WR,
      highScoringVenue: highScoring, venueMatches: venueMatches.length,
      reasoning: `${venueName}: ${venueMatches.length} matches, avg ${venueAvgRuns} runs. ${highScoring ? 'High-scoring ground.' : venueAvgRuns < 145 ? 'Bowling-friendly.' : 'Balanced.'} ${team1} ${t1W}W/${t1T} (${t1WR}%), ${team2} ${t2W}W/${t2T} (${t2WR}%).`,
    };
  } catch { return defaultResult; }
}

// ─── Toss / Innings Impact ──────────────────────────────────────────────────

/**
 * Simulate toss impact by analyzing batting-first vs chasing patterns at a venue.
 * Uses team2 as "chasing" proxy since in most data team1 bats first.
 */
async function getTossImpact(db, venue) {
  const defaultResult = { venueAvgRuns: 160, chasingAdvantage: false, chasingWinRate: 50, defendingWinRate: 50, venueType: 'balanced', reasoning: '' };
  if (!venue) return defaultResult;

  try {
    const venueKey = venue.split(',')[0].split(' ').filter(w => w.length > 3)[0] || venue.split(',')[0];

    const { rows } = await db.query(
      `SELECT team1, team2, result FROM matches
       WHERE status = 'COMPLETED' AND result IS NOT NULL AND venue ILIKE $1`,
      [`%${venueKey}%`]
    );

    if (rows.length < 3) return { ...defaultResult, reasoning: `Insufficient venue data (<3 matches) to determine toss impact.` };

    // team2 wins = "chasing" wins (approximation)
    const chasingWins = rows.filter(r => r.result.toLowerCase() === r.team2.toLowerCase()).length;
    const chasingWR = Math.round((chasingWins / rows.length) * 100);
    const defendingWR = 100 - chasingWR;
    const chasingAdv = chasingWR > 55;
    const venueType = chasingWR > 55 ? 'batting-friendly' : chasingWR < 45 ? 'bowling-friendly' : 'balanced';
    const venueName = venue.split(',')[0];

    return {
      venueAvgRuns: 160, chasingAdvantage: chasingAdv,
      chasingWinRate: chasingWR, defendingWinRate: defendingWR,
      venueType,
      reasoning: `${venueName}: ${venueType}. Chasing teams win ${chasingWR}% (${chasingWins}/${rows.length}).`,
    };
  } catch { return defaultResult; }
}

// ─── Role-Weighted Form ─────────────────────────────────────────────────────

/**
 * Separate batting and bowling form per team using role-specific metrics.
 */
async function getRoleWeightedForm(db, team1, team2) {
  try {
    const teamForm = {};
    for (const team of [team1, team2]) {
      const { rows: players } = await db.query(
        'SELECT player_id, role FROM players WHERE active = true AND team = $1', [team]
      );

      let batScores = [], bowlScores = [];
      for (const p of players) {
        const { rows: stats } = await db.query(
          `SELECT runs, balls_faced, wickets, economy, fantasy_points FROM player_match_stats
           WHERE player_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [p.player_id]
        );
        if (stats.length === 0) continue;

        if (p.role === 'BAT' || p.role === 'WK' || p.role === 'ALL') {
          const batPoints = stats.map(s => {
            const sr = s.balls_faced > 0 ? (s.runs / s.balls_faced) * 100 : 0;
            return s.runs + (sr > 140 ? 5 : 0);
          });
          const ewma = calculateEWMA(batPoints);
          batScores.push(ewma.ewma);
        }
        if (p.role === 'BOWL' || p.role === 'ALL') {
          const bowlPoints = stats.map(s => {
            const eco = Number(s.economy) || 10;
            return (s.wickets * 15) + Math.max(0, (8 - eco) * 5);
          });
          const ewma = calculateEWMA(bowlPoints);
          bowlScores.push(ewma.ewma);
        }
      }

      const avgBat = batScores.length > 0 ? batScores.reduce((s, v) => s + v, 0) / batScores.length : 0;
      const avgBowl = bowlScores.length > 0 ? bowlScores.reduce((s, v) => s + v, 0) / bowlScores.length : 0;
      teamForm[team] = { batForm: Math.round(avgBat * 10) / 10, bowlForm: Math.round(avgBowl * 10) / 10, weighted: Math.round((avgBat * 0.5 + avgBowl * 0.5) * 10) / 10 };
    }

    const tf1 = teamForm[team1] || { batForm: 0, bowlForm: 0, weighted: 0 };
    const tf2 = teamForm[team2] || { batForm: 0, bowlForm: 0, weighted: 0 };

    return {
      team1BatForm: tf1.batForm, team1BowlForm: tf1.bowlForm, team1Weighted: tf1.weighted,
      team2BatForm: tf2.batForm, team2BowlForm: tf2.bowlForm, team2Weighted: tf2.weighted,
      reasoning: `Role-weighted: ${team1} bat ${tf1.batForm} bowl ${tf1.bowlForm} | ${team2} bat ${tf2.batForm} bowl ${tf2.bowlForm}.`,
    };
  } catch { return { team1BatForm: 0, team1BowlForm: 0, team1Weighted: 0, team2BatForm: 0, team2BowlForm: 0, team2Weighted: 0, reasoning: '' }; }
}

// ─── Player vs Team Matchups ────────────────────────────────────────────────

/**
 * Get how players perform specifically against an opponent team.
 */
async function getPlayerVsTeamBatch(db, playerIds, opponentTeam) {
  const result = new Map();
  if (!playerIds || playerIds.length === 0) return result;

  try {
    const { rows } = await db.query(
      `SELECT pms.player_id, pms.runs, pms.wickets, pms.fantasy_points
       FROM player_match_stats pms
       JOIN matches m ON m.match_id = pms.match_id
       WHERE pms.player_id = ANY($1)
         AND m.status = 'COMPLETED'
         AND (m.team1 = $2 OR m.team2 = $2)`,
      [playerIds, opponentTeam]
    );

    // Group by player
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.player_id]) grouped[r.player_id] = [];
      grouped[r.player_id].push(r);
    }

    for (const [pid, stats] of Object.entries(grouped)) {
      const n = stats.length;
      result.set(Number(pid), {
        matches: n,
        avgRuns: Math.round(stats.reduce((s, r) => s + r.runs, 0) / n * 10) / 10,
        avgWickets: Math.round(stats.reduce((s, r) => s + r.wickets, 0) / n * 10) / 10,
        avgFP: Math.round(stats.reduce((s, r) => s + r.fantasy_points, 0) / n * 10) / 10,
        bestScore: Math.max(...stats.map(r => r.fantasy_points)),
      });
    }
  } catch {}

  return result;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Core algorithms
  expectedWinProb,
  updateElo,
  calculateEWMA,
  // Database-backed analysis
  calculateTeamElos,
  getPlayerForms,
  analyzeMatch,
  getTeamRecord,
  // New 6-factor intelligence
  getHeadToHead,
  getMomentumScore,
  analyzeVenue,
  getTossImpact,
  getRoleWeightedForm,
  getPlayerVsTeamBatch,
  // Constants
  BASE_ELO,
  K_FACTOR,
};
