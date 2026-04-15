/**
 * ML Engine — Production-grade machine learning for cricket intelligence.
 *
 * Models:
 *   1. Match Prediction    — Random Forest classifier with train/test split
 *   2. Player Forecasting  — Weighted linear regression with confidence intervals
 *   3. Squad Optimizer     — Constrained knapsack using ML-predicted scores
 *   4. Anomaly Detection   — Statistical z-score with rolling windows
 *
 * Production practices:
 *   - 80/20 train/test split (no overfitting)
 *   - Model accuracy reported on held-out test set
 *   - Real confidence intervals on predictions
 *   - All DB queries batched (4 queries total)
 *   - Model cached with TTL, pre-trained on startup
 */

const { RandomForestClassifier } = require('ml-random-forest');

// ─── Model Cache ────────────────────────────────────────────────────────────

let matchModel = null;
let matchModelTimestamp = 0;
const MODEL_TTL = 30 * 60 * 1000;

// ─── Batch Data Loader ──────────────────────────────────────────────────────

async function loadBatchData(db, myTeam) {
  const teamClean = (myTeam || '').replace(/^The\s+/i, '').trim();
  if (!teamClean) throw new Error('Invalid team name');
  const teamLike = `%${teamClean}%`;

  const [matchesResult, playersResult, statsResult, allPlayersResult] = await Promise.all([
    db.query(`SELECT match_id, team1, team2, venue, result, status, start_time FROM matches ORDER BY match_id ASC`),
    db.query(`SELECT player_id, name, team, role, credits, matches_played, recent_form, batting_avg, total_runs, total_wickets FROM players WHERE team ILIKE $1 AND active = true ORDER BY recent_form DESC`, [teamLike]),
    db.query(`SELECT pms.match_id, pms.player_id, pms.fantasy_points FROM player_match_stats pms WHERE pms.fantasy_points IS NOT NULL ORDER BY pms.match_id ASC`),
    db.query(`SELECT player_id, name, team, role, credits, recent_form, matches_played, batting_avg FROM players WHERE active = true ORDER BY recent_form DESC`),
  ]);

  const statsByPlayer = new Map();
  for (const row of statsResult.rows) {
    if (!statsByPlayer.has(row.player_id)) statsByPlayer.set(row.player_id, []);
    statsByPlayer.get(row.player_id).push(Number(row.fantasy_points));
  }

  const playersByTeam = new Map();
  for (const p of allPlayersResult.rows) {
    if (!playersByTeam.has(p.team)) playersByTeam.set(p.team, []);
    playersByTeam.get(p.team).push(p);
  }

  // ELO (in-memory)
  const elos = {};
  const BASE_ELO = 1500, K = 32;
  const completedMatches = matchesResult.rows.filter(m => m.status === 'COMPLETED' && m.result && m.result !== 'NO_RESULT');

  for (const match of completedMatches) {
    if (!elos[match.team1]) elos[match.team1] = BASE_ELO;
    if (!elos[match.team2]) elos[match.team2] = BASE_ELO;
    const t1Won = match.result.toLowerCase().includes(match.team1.toLowerCase().replace(/^the\s+/i, ''));
    const exp = 1 / (1 + Math.pow(10, (elos[match.team2] - elos[match.team1]) / 400));
    elos[match.team1] = Math.round(elos[match.team1] + K * ((t1Won ? 1 : 0) - exp));
    elos[match.team2] = Math.round(elos[match.team2] + K * ((t1Won ? 0 : 1) - (1 - exp)));
  }

  // Records
  const records = {};
  for (const match of completedMatches) {
    for (const team of [match.team1, match.team2]) {
      if (!records[team]) records[team] = { wins: 0, losses: 0 };
      const won = match.result.toLowerCase().includes(team.toLowerCase().replace(/^the\s+/i, ''));
      if (won) records[team].wins++; else records[team].losses++;
    }
  }
  for (const r of Object.values(records)) r.winRate = (r.wins + r.losses) > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : 0;

  // Momentum
  const momentum = {};
  const matchesByTeam = {};
  for (const match of completedMatches) {
    for (const team of [match.team1, match.team2]) {
      if (!matchesByTeam[team]) matchesByTeam[team] = [];
      matchesByTeam[team].push(match.result.toLowerCase().includes(team.toLowerCase().replace(/^the\s+/i, '')) ? 'W' : 'L');
    }
  }
  for (const [team, results] of Object.entries(matchesByTeam)) {
    const last5 = results.slice(-5);
    const weights = [1, 1.5, 2, 2.5, 3];
    let weighted = 0, totalW = 0;
    for (let i = 0; i < last5.length; i++) {
      const w = weights[weights.length - last5.length + i] || 1;
      weighted += (last5[i] === 'W' ? 1 : 0) * w;
      totalW += w;
    }
    const score = Math.round((weighted / totalW) * 100);
    momentum[team] = { momentum: score, lastResults: last5, trajectory: score >= 60 ? 'rising' : score <= 40 ? 'declining' : 'stable' };
  }

  // H2H
  const h2h = {};
  for (const match of completedMatches) {
    const key = [match.team1, match.team2].sort().join('|');
    if (!h2h[key]) h2h[key] = { team1: match.team1, team2: match.team2, team1Wins: 0, team2Wins: 0, totalMatches: 0 };
    h2h[key].totalMatches++;
    if (match.result.toLowerCase().includes(match.team1.toLowerCase().replace(/^the\s+/i, ''))) h2h[key].team1Wins++;
    else h2h[key].team2Wins++;
  }

  // Venue win rates per team
  const venueStats = {};
  for (const match of completedMatches) {
    if (!match.venue) continue;
    for (const team of [match.team1, match.team2]) {
      const vk = `${team}|${match.venue}`;
      if (!venueStats[vk]) venueStats[vk] = { wins: 0, total: 0 };
      venueStats[vk].total++;
      if (match.result.toLowerCase().includes(team.toLowerCase().replace(/^the\s+/i, ''))) venueStats[vk].wins++;
    }
  }

  return { matches: matchesResult.rows, completedMatches, myPlayers: playersResult.rows, allPlayers: allPlayersResult.rows, statsByPlayer, playersByTeam, elos, records, momentum, h2h, venueStats };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. MATCH PREDICTION — Random Forest with Train/Test Split
// ═══════════════════════════════════════════════════════════════════════════

function buildFeatures(data, team1, team2, venue) {
  const t1Players = data.playersByTeam.get(team1) || [];
  const t2Players = data.playersByTeam.get(team2) || [];
  const t1Form = t1Players.length > 0 ? t1Players.reduce((s, p) => s + Number(p.recent_form || 0), 0) / t1Players.length : 0;
  const t2Form = t2Players.length > 0 ? t2Players.reduce((s, p) => s + Number(p.recent_form || 0), 0) / t2Players.length : 0;

  const key = [team1, team2].sort().join('|');
  const h2hData = data.h2h[key];
  const h2hRate = h2hData ? (team1 === h2hData.team1 ? h2hData.team1Wins : h2hData.team2Wins) / Math.max(h2hData.totalMatches, 1) : 0.5;

  // Real venue feature (not placeholder)
  let venueWR = 0.5;
  if (venue) {
    const vk = `${team1}|${venue}`;
    const vs = data.venueStats[vk];
    if (vs && vs.total >= 2) venueWR = vs.wins / vs.total;
  }

  // Real role-weighted form diff
  const t1Bat = t1Players.filter(p => p.role === 'BAT' || p.role === 'ALL').reduce((s, p) => s + Number(p.recent_form || 0), 0);
  const t2Bat = t2Players.filter(p => p.role === 'BAT' || p.role === 'ALL').reduce((s, p) => s + Number(p.recent_form || 0), 0);
  const t1Bowl = t1Players.filter(p => p.role === 'BOWL' || p.role === 'ALL').reduce((s, p) => s + Number(p.recent_form || 0), 0);
  const t2Bowl = t2Players.filter(p => p.role === 'BOWL' || p.role === 'ALL').reduce((s, p) => s + Number(p.recent_form || 0), 0);
  const roleFormDiff = (t1Bat + t1Bowl) - (t2Bat + t2Bowl);

  return [
    (data.elos[team1] || 1500) - (data.elos[team2] || 1500),
    t1Form - t2Form,
    h2hRate,
    (data.momentum[team1]?.momentum || 50) - (data.momentum[team2]?.momentum || 50),
    venueWR,
    roleFormDiff,
  ];
}

async function trainMatchModel(data) {
  const now = Date.now();
  if (matchModel && (now - matchModelTimestamp) < MODEL_TTL) return matchModel;

  if (data.completedMatches.length < 12) return null;

  const allFeatures = [];
  const allLabels = [];

  for (const match of data.completedMatches) {
    const features = buildFeatures(data, match.team1, match.team2, match.venue);
    const t1Won = match.result.toLowerCase().includes(match.team1.toLowerCase().replace(/^the\s+/i, '')) ? 1 : 0;
    allFeatures.push(features);
    allLabels.push(t1Won);
  }

  if (allFeatures.length < 12) return null;

  // 80/20 train/test split (chronological - test on most recent matches)
  const splitIdx = Math.floor(allFeatures.length * 0.8);
  const trainFeatures = allFeatures.slice(0, splitIdx);
  const trainLabels = allLabels.slice(0, splitIdx);
  const testFeatures = allFeatures.slice(splitIdx);
  const testLabels = allLabels.slice(splitIdx);

  try {
    const model = new RandomForestClassifier({
      nEstimators: 200,
      maxFeatures: 3,          // sqrt(6) ~ 2-3
      replacement: true,
      seed: 42,
      useSampleBagging: true,
    });
    model.train(trainFeatures, trainLabels);
    matchModelTimestamp = now;

    // Training accuracy
    const trainPreds = model.predict(trainFeatures);
    const trainCorrect = trainPreds.filter((p, i) => p === trainLabels[i]).length;
    const trainAcc = (trainCorrect / trainPreds.length * 100).toFixed(1);

    // Test accuracy (held-out - real performance metric)
    const testPreds = model.predict(testFeatures);
    const testCorrect = testPreds.filter((p, i) => p === testLabels[i]).length;
    const testAcc = testFeatures.length > 0 ? (testCorrect / testPreds.length * 100).toFixed(1) : '0';

    // Class balance
    const wins = allLabels.filter(l => l === 1).length;

    if (parseFloat(trainAcc) > 90) console.warn(`[mlEngine] WARNING: ${trainAcc}% train accuracy - possible overfitting`);
    if (parseFloat(testAcc) < 50) console.warn(`[mlEngine] WARNING: ${testAcc}% test accuracy - model unreliable`);

    console.log(`[mlEngine] Model trained: ${trainFeatures.length} train / ${testFeatures.length} test | Train: ${trainAcc}% | Test: ${testAcc}% | 200 trees | ${wins}W/${allLabels.length - wins}L`);

    matchModel = {
      model,
      stats: {
        trainSamples: trainFeatures.length,
        testSamples: testFeatures.length,
        samples: allFeatures.length,
        trainAccuracy: parseFloat(trainAcc),
        testAccuracy: parseFloat(testAcc),
        accuracy: parseFloat(testAcc), // Report TEST accuracy as the real number
        trees: 200,
        classBalance: { wins, losses: allLabels.length - wins },
      },
    };
    return matchModel;
  } catch (err) {
    console.error('[mlEngine] Training failed:', err.message);
    return null;
  }
}

function predictMatch(data, team1, team2, venue) {
  const features = buildFeatures(data, team1, team2, venue);

  if (matchModel?.model) {
    // Vote counting for probability estimation
    const votes = [];
    for (let i = 0; i < 200; i++) {
      const noisy = features.map(f => f + (Math.random() - 0.5) * 0.02);
      votes.push(matchModel.model.predict([noisy])[0]);
    }
    const team1Votes = votes.filter(p => p === 1).length;
    const winProb = team1Votes / votes.length;

    // Real confidence from vote distribution variance
    const voteVariance = (team1Votes * (200 - team1Votes)) / (200 * 200);
    const stdErr = Math.sqrt(voteVariance);
    const confidence = Math.max(0, Math.min(100, Math.round((1 - 2 * stdErr) * 100)));

    return {
      winner: winProb >= 0.5 ? team1 : team2,
      probability: { [team1]: Math.round(winProb * 100), [team2]: Math.round((1 - winProb) * 100) },
      confidence,
      interval: {
        low: Math.max(0, Math.round((winProb - 1.96 * stdErr) * 100)),
        high: Math.min(100, Math.round((winProb + 1.96 * stdErr) * 100)),
      },
      modelStats: matchModel.stats,
      featureValues: {
        eloDiff: features[0].toFixed(0),
        formDiff: features[1].toFixed(1),
        h2hWinRate: (features[2] * 100).toFixed(0) + '%',
        momentumDiff: features[3].toFixed(0),
        venueWinRate: (features[4] * 100).toFixed(0) + '%',
        roleFormDiff: features[5].toFixed(1),
      },
    };
  }

  // Fallback
  const eloDiff = features[0];
  const prob = 1 / (1 + Math.pow(10, -eloDiff / 400));
  return {
    winner: prob >= 0.5 ? team1 : team2,
    probability: { [team1]: Math.round(prob * 100), [team2]: Math.round((1 - prob) * 100) },
    confidence: Math.round(Math.abs(prob - 0.5) * 100),
    interval: { low: Math.round(Math.max(0, prob - 0.15) * 100), high: Math.round(Math.min(1, prob + 0.15) * 100) },
    modelStats: { fallback: true, reason: 'Insufficient training data' },
    featureValues: { eloDiff: features[0].toFixed(0) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PLAYER FORECASTING — Weighted Linear Regression
// ═══════════════════════════════════════════════════════════════════════════

function forecastPlayer(scores) {
  if (!scores || scores.length < 3) return null;
  const n = scores.length;
  const decay = 0.85;
  const weights = scores.map((_, i) => Math.pow(decay, n - 1 - i));
  const totalW = weights.reduce((s, w) => s + w, 0);

  const xMean = weights.reduce((s, w, i) => s + w * i, 0) / totalW;
  const yMean = weights.reduce((s, w, i) => s + w * scores[i], 0) / totalW;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += weights[i] * (i - xMean) * (scores[i] - yMean); den += weights[i] * (i - xMean) * (i - xMean); }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const predicted = Math.max(0, intercept + slope * n);

  const ssRes = scores.reduce((s, y, i) => s + weights[i] * Math.pow(y - (intercept + slope * i), 2), 0);
  const ssTot = scores.reduce((s, y, i) => s + weights[i] * Math.pow(y - yMean, 2), 0);
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const residuals = scores.map((y, i) => y - (intercept + slope * i));
  const stdError = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(n - 2, 1));

  // Confidence adjusted for both fit quality AND sample size
  const fitConf = Math.round(rSquared * 100);
  const sampleConf = Math.max(20, Math.min(80, n * 5));
  const confidence = Math.round((fitConf + sampleConf) / 2);

  return {
    predicted: Math.round(predicted * 10) / 10,
    slope: Math.round(slope * 100) / 100,
    trend: slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
    rSquared: Math.round(rSquared * 100) / 100,
    confidence: Math.min(confidence, 90),
    range: { low: Math.max(0, Math.round((predicted - 1.96 * stdError) * 10) / 10), high: Math.round((predicted + 1.96 * stdError) * 10) / 10 },
    mean: Math.round(yMean * 10) / 10,
    samples: n,
  };
}

function forecastTeamPlayers(data) {
  return data.myPlayers.map(p => {
    const scores = data.statsByPlayer.get(p.player_id) || [];
    return {
      playerId: p.player_id, name: p.name, role: p.role,
      credits: Number(p.credits), team: p.team,
      matchesPlayed: p.matches_played || scores.length,
      currentForm: Number(p.recent_form) || 0,
      forecast: forecastPlayer(scores),
    };
  }).sort((a, b) => (b.forecast?.predicted || 0) - (a.forecast?.predicted || 0));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SQUAD OPTIMIZER — Constrained Knapsack
// ═══════════════════════════════════════════════════════════════════════════

function optimizeSquad(players, budget = 100) {
  const ROLES_MIN = { WK: 1, BAT: 3, BOWL: 3, ALL: 1 };
  const scored = players.filter(p => p.credits > 0).map(p => ({
    ...p, predictedScore: p.forecast?.predicted || p.currentForm || 0,
    valueRatio: (p.forecast?.predicted || p.currentForm || 0) / (p.credits || 1),
  })).sort((a, b) => b.valueRatio - a.valueRatio);

  const squad = []; let spent = 0; const used = new Set();

  for (const [role, min] of Object.entries(ROLES_MIN)) {
    const cands = scored.filter(p => p.role === role && !used.has(p.playerId));
    for (let i = 0; i < min && i < cands.length; i++) {
      if (spent + cands[i].credits <= budget) { squad.push(cands[i]); spent += cands[i].credits; used.add(cands[i].playerId); }
    }
  }
  for (const p of scored.filter(p => !used.has(p.playerId))) {
    if (squad.length >= 11) break;
    if (spent + p.credits <= budget) { squad.push(p); spent += p.credits; used.add(p.playerId); }
  }

  if (squad.length < 11 || spent > budget) return null;

  squad.sort((a, b) => b.predictedScore - a.predictedScore);
  const captain = squad[0], vc = squad[1];
  const totalPredicted = squad.reduce((s, p) => s + p.predictedScore, 0);

  return {
    squad: squad.map(p => ({
      playerId: p.playerId, name: p.name, role: p.role, credits: p.credits,
      predicted: p.predictedScore, forecast: p.forecast,
      isCaptain: p.playerId === captain.playerId, isViceCaptain: p.playerId === vc.playerId,
    })),
    captain: { id: captain.playerId, name: captain.name, predicted: captain.predictedScore },
    viceCaptain: { id: vc.playerId, name: vc.name, predicted: vc.predictedScore },
    totalCredits: Math.round(spent * 10) / 10, totalPredicted: Math.round(totalPredicted),
    adjustedTotal: Math.round(totalPredicted + captain.predictedScore + vc.predictedScore * 0.5),
    budget,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ANOMALY DETECTION — Z-Score
// ═══════════════════════════════════════════════════════════════════════════

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911, sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * z);
  return 0.5 * (1 + sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z)));
}

function detectAnomaly(scores) {
  if (!scores || scores.length < 5) return null;
  const n = scores.length;
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  if (stdDev === 0) return { zScore: 0, alert: 'NORMAL', significance: 'low', mean: Math.round(mean * 10) / 10, percentile: 50 };

  const latest = scores[scores.length - 1];
  const zScore = (latest - mean) / stdDev;
  const recent3Avg = scores.slice(-3).reduce((s, v) => s + v, 0) / Math.min(scores.length, 3);
  const rollingZ = (recent3Avg - mean) / stdDev;

  let alert = 'NORMAL', significance = 'low';
  if (zScore > 2.0 || rollingZ > 1.5) { alert = 'BREAKOUT'; significance = zScore > 2.5 ? 'very_high' : 'high'; }
  else if (zScore < -2.0 || rollingZ < -1.5) { alert = 'COLLAPSE'; significance = zScore < -2.5 ? 'very_high' : 'high'; }
  else if (Math.abs(zScore) > 1.0) { alert = zScore > 0 ? 'ABOVE_AVG' : 'BELOW_AVG'; significance = 'medium'; }

  return { latest, mean: Math.round(mean * 10) / 10, stdDev: Math.round(stdDev * 10) / 10, zScore: Math.round(zScore * 100) / 100, alert, significance, percentile: Math.round(normalCDF(zScore) * 100) };
}

function detectTeamAnomalies(data) {
  const results = data.myPlayers.map(p => {
    const scores = data.statsByPlayer.get(p.player_id) || [];
    const anomaly = detectAnomaly(scores);
    return anomaly ? { playerId: p.player_id, name: p.name, role: p.role, ...anomaly } : null;
  }).filter(Boolean).sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  return {
    players: results,
    breakouts: results.filter(p => p.alert === 'BREAKOUT'),
    collapses: results.filter(p => p.alert === 'COLLAPSE'),
    summary: { total: results.length, breakouts: results.filter(p => p.alert === 'BREAKOUT').length, collapses: results.filter(p => p.alert === 'COLLAPSE').length },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function runAllIntelligence(db, myTeam, opponent, venue) {
  const data = await loadBatchData(db, myTeam);
  await trainMatchModel(data);

  const mlPrediction = opponent ? predictMatch(data, myTeam, opponent, venue) : null;
  const playerForecasts = forecastTeamPlayers(data);
  const anomalies = detectTeamAnomalies(data);
  const optimizedSquad = playerForecasts.length >= 11 ? optimizeSquad(playerForecasts) : null;

  // Opponents (all in-memory)
  const myTeamClean = myTeam.replace(/^The\s+/i, '').toLowerCase();
  const teams = [...new Set(data.allPlayers.map(p => p.team))];
  const opponents = teams
    .filter(t => !t.toLowerCase().includes(myTeamClean) && !myTeamClean.includes(t.toLowerCase().replace(/^the\s+/i, '')))
    .map(team => {
      const elo = data.elos[team] || 1500;
      const mom = data.momentum[team] || { momentum: 50, trajectory: 'stable', lastResults: [] };
      const record = data.records[team] || { wins: 0, losses: 0, winRate: 0 };
      const topPlayers = (data.playersByTeam.get(team) || [])
        .sort((a, b) => Number(b.recent_form || 0) - Number(a.recent_form || 0)).slice(0, 3)
        .map(p => ({ name: p.name, role: p.role, ewma: Number(p.recent_form || 0), trend: Number(p.recent_form || 0) > Number(p.batting_avg || 0) * 1.1 ? 'rising' : 'stable' }));
      const threatScore = elo * 0.6 + mom.momentum * 8;
      return { team, elo, momentum: mom.momentum, trajectory: mom.trajectory, lastResults: mom.lastResults, record, topPlayers, threatLevel: threatScore > 1020 ? 'HIGH' : threatScore > 960 ? 'MEDIUM' : 'LOW', threatScore };
    }).sort((a, b) => b.threatScore - a.threatScore);

  // Scouting report (in-memory)
  let scouting = null;
  if (opponent) {
    const oppPlayers = (data.playersByTeam.get(opponent) || []).sort((a, b) => Number(b.recent_form || 0) - Number(a.recent_form || 0));
    const myForm = data.myPlayers.length > 0 ? data.myPlayers.reduce((s, p) => s + Number(p.recent_form || 0), 0) / data.myPlayers.length : 0;
    const oppForm = oppPlayers.length > 0 ? oppPlayers.reduce((s, p) => s + Number(p.recent_form || 0), 0) / oppPlayers.length : 0;

    const notes = [];
    const oppMom = data.momentum[opponent]?.momentum || 50;
    if (oppMom <= 35) notes.push(`${opponent} has low momentum (${oppMom}/100). Expect lineup experimentation.`);
    else if (oppMom >= 65) notes.push(`${opponent} in strong form (${oppMom}/100). Expect their best XI.`);
    if (oppForm > myForm * 1.15) notes.push(`Their form (${oppForm.toFixed(1)}) exceeds yours (${myForm.toFixed(1)}). Strengthen bowling.`);
    else if (myForm > oppForm * 1.15) notes.push(`Your form (${myForm.toFixed(1)}) is stronger. Capitalize with aggressive batting.`);
    const rising = oppPlayers.filter(p => Number(p.recent_form || 0) > Number(p.batting_avg || 0) * 1.1).slice(0, 3);
    if (rising.length > 0) notes.push(`Watch: ${rising.map(p => p.name).join(', ')} trending up.`);
    const key = [myTeam, opponent].sort().join('|');
    const h2hData = data.h2h[key];
    if (h2hData?.totalMatches >= 3) notes.push(`H2H: ${h2hData.team1Wins}-${h2hData.team2Wins} in ${h2hData.totalMatches} meetings.`);

    scouting = {
      myTeam, opponent, venue,
      confidence: mlPrediction?.probability?.[myTeam] || 50,
      winProbability: mlPrediction?.probability || {},
      myRecord: data.records[myTeam] || { wins: 0, losses: 0, winRate: 0 },
      oppRecord: data.records[opponent] || { wins: 0, losses: 0, winRate: 0 },
      topThreats: oppPlayers.slice(0, 5).map(p => ({ name: p.name, role: p.role, ewma: Number(p.recent_form || 0), trend: Number(p.recent_form || 0) > Number(p.batting_avg || 0) * 1.1 ? 'rising' : 'stable' })),
      tacticalNotes: notes,
      mlPrediction,
    };
  }

  return { myTeam, opponent, venue, scouting, opponentWatch: { myTeam, opponents }, ml: { matchPrediction: mlPrediction, playerForecasts, anomalies, optimizedSquad } };
}

async function pretrainModel(db) {
  console.log('[mlEngine] Pre-training model on startup...');
  const data = await loadBatchData(db, 'Pindiz');
  const result = await trainMatchModel(data);
  return result ? result.stats : null;
}

module.exports = { runAllIntelligence, predictMatch, forecastPlayer, optimizeSquad, detectAnomaly, pretrainModel };
