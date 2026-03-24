/**
 * Fantasy Strategy — EWMA + Player-vs-Team Matchup powered squad building.
 *
 * Uses cricketIntelligence engine for:
 *   - EWMA form scores for player selection
 *   - Value ratio (EWMA / credits) for optimal budget allocation
 *   - Player-vs-team matchups for opponent-specific boosts
 *   - Consistency scores for captain/VC selection
 *   - Trend detection for differential picks
 */

const { getPlayerForms, calculateEWMA, getPlayerVsTeamBatch } = require("../cricketIntelligence");

const BUDGET = 100;
const SQUAD_SIZE = 11;
const MIN_ROLES = { WK: 1, BAT: 3, BOWL: 3, ALL: 1 };

/**
 * Player value score: EWMA form per credit, boosted by matchup data.
 */
function valueScore(player, matchup = null) {
  const form = player.ewma || Number(player.recent_form || player.avg_fantasy_points || 0);
  const credits = Number(player.credits) || 1;
  let score = form > 0 ? form / credits : credits;

  // Boost if player historically performs well against this opponent
  if (matchup && matchup.matches >= 2) {
    const matchupFactor = form > 0 ? matchup.avgFP / form : 1;
    if (matchupFactor > 1) score *= Math.min(1.15, 0.85 + 0.15 * matchupFactor); // up to 15% boost
    else if (matchupFactor < 0.7) score *= 0.90; // 10% penalty for poor matchup
  }
  return score;
}

/**
 * Build an optimal squad using EWMA intelligence + player-vs-team matchups.
 */
async function buildSquad(matchId, matchInfo, players, db = null) {
  const pool = players.filter(
    (p) => p.team === matchInfo.team1 || p.team === matchInfo.team2
  );
  if (pool.length < SQUAD_SIZE) return null;

  // Enrich with EWMA form data
  let enrichedPool = pool;
  if (db) {
    try {
      const forms = await getPlayerForms(db, matchInfo.team1, matchInfo.team2);
      enrichedPool = pool.map(p => {
        const f = forms[p.playerId] || forms[p.player_id];
        return f ? { ...p, ewma: f.ewma, trend: f.trend, consistency: f.consistency, peakForm: f.peakForm, matchesPlayed: f.matchesPlayed } : p;
      });
    } catch { /* use original pool */ }
  }

  // Get player-vs-team matchup data
  let matchupMap = new Map();
  if (db) {
    try {
      const allIds = enrichedPool.map(p => p.playerId || p.player_id);
      // team1 players vs team2, team2 players vs team1
      const vsT2 = await getPlayerVsTeamBatch(db, allIds, matchInfo.team2);
      const vsT1 = await getPlayerVsTeamBatch(db, allIds, matchInfo.team1);
      for (const p of enrichedPool) {
        const pid = p.playerId || p.player_id;
        const m = p.team === matchInfo.team1 ? vsT2.get(pid) : vsT1.get(pid);
        if (m) matchupMap.set(pid, m);
      }
    } catch {}
  }

  // Group by role, sort by value score with matchup factor
  const byRole = { WK: [], BAT: [], BOWL: [], ALL: [] };
  for (const p of enrichedPool) {
    const pid = p.playerId || p.player_id;
    (byRole[p.role] || byRole.ALL).push({ ...p, _matchup: matchupMap.get(pid) || null });
  }
  for (const role of Object.keys(byRole)) {
    byRole[role].sort((a, b) => valueScore(b, b._matchup) - valueScore(a, a._matchup));
  }

  // Phase 1: Minimum role requirements
  const squad = [];
  let spent = 0;
  for (const [role, min] of Object.entries(MIN_ROLES)) {
    const available = byRole[role];
    for (let i = 0; i < min && i < available.length; i++) {
      if (spent + Number(available[i].credits) <= BUDGET) {
        squad.push(available[i]);
        spent += Number(available[i].credits);
      }
    }
  }

  // Phase 2: Fill remaining by value score
  const inSquad = new Set(squad.map((p) => p.playerId || p.player_id));
  const remaining = enrichedPool
    .filter((p) => !inSquad.has(p.playerId || p.player_id))
    .map(p => {
      const pid = p.playerId || p.player_id;
      return { ...p, _matchup: matchupMap.get(pid) || null };
    })
    .sort((a, b) => valueScore(b, b._matchup) - valueScore(a, a._matchup));

  for (const p of remaining) {
    if (squad.length >= SQUAD_SIZE) break;
    if (spent + Number(p.credits) <= BUDGET) {
      squad.push(p);
      spent += Number(p.credits);
    }
  }

  // Phase 3: Cheapest available
  if (squad.length < SQUAD_SIZE) {
    const inSquad2 = new Set(squad.map((p) => p.playerId || p.player_id));
    const cheapest = enrichedPool
      .filter((p) => !inSquad2.has(p.playerId || p.player_id))
      .sort((a, b) => Number(a.credits) - Number(b.credits));
    for (const p of cheapest) {
      if (squad.length >= SQUAD_SIZE) break;
      if (spent + Number(p.credits) <= BUDGET) {
        squad.push(p);
        spent += Number(p.credits);
      }
    }
  }

  if (squad.length < SQUAD_SIZE) return null;

  // Captain: highest EWMA + consistency + matchup combo
  squad.sort((a, b) => {
    const pid_a = a.playerId || a.player_id;
    const pid_b = b.playerId || b.player_id;
    const mu_a = matchupMap.get(pid_a);
    const mu_b = matchupMap.get(pid_b);
    const aMatchupBoost = (mu_a && mu_a.matches >= 2 && mu_a.avgFP > (a.ewma || 0)) ? 10 : 0;
    const bMatchupBoost = (mu_b && mu_b.matches >= 2 && mu_b.avgFP > (b.ewma || 0)) ? 10 : 0;
    const aScore = (a.ewma || 0) * 0.6 + (a.consistency || 0) * 0.2 + aMatchupBoost * 0.2;
    const bScore = (b.ewma || 0) * 0.6 + (b.consistency || 0) * 0.2 + bMatchupBoost * 0.2;
    return bScore - aScore;
  });

  const captain = squad[0];
  const viceCaptain = squad[1];
  const captainId = captain.playerId || captain.player_id;
  const viceCaptainId = viceCaptain.playerId || viceCaptain.player_id;

  const teamCounts = {};
  const roleCounts = {};
  for (const p of squad) {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  }

  // Find value picks
  const topValue = [...squad]
    .filter(p => (p.ewma || 0) > 0)
    .sort((a, b) => valueScore(b, b._matchup) - valueScore(a, a._matchup))
    .slice(0, 2);

  // Rising players (differential picks)
  const risingPlayers = squad.filter(p => p.trend === 'rising');

  // Matchup picks (players who perform well against this opponent)
  const matchupPicks = squad
    .filter(p => {
      const pid = p.playerId || p.player_id;
      const m = matchupMap.get(pid);
      return m && m.matches >= 2 && m.avgFP > (p.ewma || 0);
    })
    .slice(0, 2);

  // Build reasoning
  const capEwma = captain.ewma || 0;
  const vcEwma = viceCaptain.ewma || 0;
  const capMatchup = matchupMap.get(captainId);
  const hasIntel = capEwma > 0;

  let reasoning;
  if (hasIntel) {
    const parts = [
      `Squad ${squad.length} players, ${spent}/${BUDGET} credits.`,
      `Captain: ${captain.name} (EWMA ${capEwma.toFixed(1)}, ${captain.trend || 'steady'}, ${captain.consistency || 0}% consistency${capMatchup ? `, vs opponent: ${capMatchup.avgFP} avg FP in ${capMatchup.matches} matches` : ''}) - 2x multiplier.`,
      `Vice-Captain: ${viceCaptain.name} (EWMA ${vcEwma.toFixed(1)}, ${viceCaptain.trend || 'steady'}) - 1.5x multiplier.`,
    ];
    if (topValue.length > 0) {
      const vp = topValue[0];
      parts.push(`Best value: ${vp.name} (${Number(vp.credits)} cr, EWMA ${(vp.ewma || 0).toFixed(1)}, ratio ${valueScore(vp, vp._matchup).toFixed(1)}).`);
    }
    if (matchupPicks.length > 0) {
      parts.push(`Matchup advantage: ${matchupPicks.map(p => { const pid = p.playerId || p.player_id; const m = matchupMap.get(pid); return `${p.name} (${m.avgFP} avg vs opponent)`; }).join(', ')}.`);
    }
    if (risingPlayers.length > 0) {
      parts.push(`Rising form: ${risingPlayers.map(p => p.name).join(', ')}.`);
    }
    parts.push(`Split: ${Object.entries(teamCounts).map(([t, c]) => `${t} ${c}`).join(' / ')}. Roles: ${Object.entries(roleCounts).map(([r, c]) => `${r} ${c}`).join(', ')}.`);
    reasoning = parts.join(' ');
  } else {
    reasoning = `Built squad of ${squad.length} within ${spent}/${BUDGET} credits. Captain: ${captain.name}. Vice-Captain: ${viceCaptain.name}.`;
  }

  return {
    playerIds: squad.map((p) => p.playerId || p.player_id),
    captainId,
    viceCaptainId,
    totalCredits: Math.round(spent),
    squad: squad.map((p) => ({
      id: p.playerId || p.player_id, name: p.name, role: p.role,
      credits: Number(p.credits), team: p.team, ewma: p.ewma || 0, trend: p.trend || 'unknown',
    })),
    reasoning,
  };
}

/**
 * Analyze contests and decide which to join.
 */
async function analyzeContests(openContests, joinedContests, matchInfo, players, db = null) {
  const joined = new Set(joinedContests.map(String));
  const decisions = [];

  for (const contest of openContests) {
    if (joined.has(String(contest.contestId))) continue;
    if (!contest.active) continue;

    const squad = await buildSquad(contest.matchId, matchInfo, players, db);
    if (!squad) continue;

    const confidence = 70 + Math.min(20, Math.round(squad.totalCredits / 5));
    decisions.push({
      contestId: contest.contestId,
      matchId: contest.matchId,
      ...squad,
      confidence,
      reasoning: `Joining contest #${contest.contestId} (pool: ${contest.sponsorPool || 0} WIRE). ${squad.reasoning}`,
    });
  }

  return decisions;
}

module.exports = { buildSquad, analyzeContests };
