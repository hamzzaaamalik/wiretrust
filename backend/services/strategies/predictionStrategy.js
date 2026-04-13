/**
 * Prediction Strategy — 6-Factor Cricket Intelligence.
 *
 * Uses the full cricket intelligence engine:
 *   1. ELO ratings (25%) — team power rankings
 *   2. EWMA player form (20%) — exponential weighted recent performance
 *   3. Head-to-Head (15%) — historical matchup dominance
 *   4. Momentum (15%) — winning streaks and trajectory
 *   5. Venue analysis (15%) — ground-specific performance
 *   6. Role-weighted form (10%) — batting vs bowling split
 *
 * Plus: player-vs-team matchups for TOP_SCORER, toss impact for TOTAL_RUNS.
 * Falls back to credit-based heuristics if DB unavailable.
 */

const { analyzeMatch } = require("../cricketIntelligence");

// Maximum confidence cap — normalized across all prediction types
const MAX_CONFIDENCE = 85;

// ─── Fallback helpers (no DB) ────────────────────────────────────────────────

function teamStrength(players, teamName) {
  const roster = players.filter((p) => p.team === teamName);
  const total = roster.reduce((sum, p) => sum + Number(p.credits), 0);
  const stars = roster.filter((p) => Number(p.credits) >= 10).length;
  return { total, stars, size: roster.length };
}

function pickTopScorer(players, teamName) {
  return players
    .filter((p) => p.team === teamName && (p.role === "BAT" || p.role === "ALL" || p.role === "WK"))
    .sort((a, b) => Number(b.credits) - Number(a.credits))[0] || null;
}

function playerToOutcome(name) {
  return name.toUpperCase().replace(/\s+/g, "_");
}

// ─── Main Analysis ───────────────────────────────────────────────────────────

async function analyzePredictions(upcomingMatches, existingPredictions, options = {}, players = [], db = null) {
  const { predictionTypes = ["MATCH_WINNER", "TOP_SCORER", "TOTAL_RUNS"] } = options;
  const decisions = [];
  const alreadyPredicted = new Set(
    existingPredictions.map((p) => `${p.matchId}-${p.predictionType}`)
  );

  for (const match of upcomingMatches) {
    // Accept UPCOMING, LIVE, and COMPLETED matches (agent can analyze any unpredicted match)
    if (match.status === "ABANDONED") continue;

    // ── Try 6-Factor Intelligence ──
    if (db) {
      try {
        // Look up venue from DB
        let venue = null;
        try {
          const { rows } = await db.query('SELECT venue FROM matches WHERE match_id = $1', [match.matchId]);
          venue = rows[0]?.venue || null;
        } catch {}

        const intel = await analyzeMatch(db, match.team1, match.team2, venue);

        for (const predType of predictionTypes) {
          const key = `${match.matchId}-${predType}`;
          if (alreadyPredicted.has(key)) continue;

          let outcome, confidence, reasoning;

          if (predType === "MATCH_WINNER") {
            const winner = intel.predictedWinner;
            const loser = winner === match.team1 ? match.team2 : match.team1;
            outcome = winner.toUpperCase().replace(/\s+/g, "_") + "_WIN";
            confidence = intel.confidence;

            const { getTeamRecord } = require("../cricketIntelligence");
            const winnerRecord = await getTeamRecord(db, winner);
            const loserRecord = await getTeamRecord(db, loser);

            // Build rich 6-factor reasoning
            const parts = [
              `ELO: ${winner} ${intel.elo[winner]} vs ${loser} ${intel.elo[loser]} (${intel.winProbability[winner]}% win prob).`,
              `Record: ${winner} ${winnerRecord.wins}W-${winnerRecord.losses}L, ${loser} ${loserRecord.wins}W-${loserRecord.losses}L.`,
              `Form: ${winner} EWMA ${intel.teamForm[winner]} | ${loser} EWMA ${intel.teamForm[loser]}.`,
            ];
            if (intel.headToHead?.totalMatches > 0) parts.push(intel.headToHead.reasoning);
            if (intel.momentum?.[winner]) parts.push(`Momentum: ${winner} ${intel.momentum[winner].momentum}/100 (${intel.momentum[winner].trajectory}) | ${loser} ${intel.momentum[loser].momentum}/100.`);
            if (intel.venue?.venueMatches > 0) parts.push(intel.venue.reasoning);
            if (intel.roleWeighted?.reasoning) parts.push(intel.roleWeighted.reasoning);
            parts.push(`6-Factor composite: ${confidence}% for ${winner}.`);
            reasoning = parts.join(' ');

          } else if (predType === "TOP_SCORER") {
            if (intel.topScorer) {
              const ts = intel.topScorer;
              outcome = playerToOutcome(ts.name);
              confidence = Math.min(MAX_CONFIDENCE, Math.round(45 + ts.ewma * 0.2 + (ts.consistency || 0) * 0.1));

              // Boost from player-vs-team matchup
              if (ts.matchup && ts.matchup.matches >= 2) {
                if (ts.matchup.avgFP > ts.ewma) confidence = Math.min(MAX_CONFIDENCE, confidence + 5);
              }

              const loser = ts.team === match.team1 ? match.team2 : match.team1;
              const runner = Object.values(intel.forms)
                .filter(p => p.player_id !== ts.player_id && (p.role === 'BAT' || p.role === 'ALL' || p.role === 'WK') && p.matchesPlayed > 0)
                .sort((a, b) => b.ewma - a.ewma)[0];

              reasoning = `${ts.name} (${ts.team}): EWMA ${ts.ewma} FP, ${ts.trend}, ${ts.consistency}% consistency, peak ${ts.peakForm} FP.`;
              if (ts.matchup) reasoning += ` vs ${loser}: ${ts.matchup.avgFP} avg FP in ${ts.matchup.matches} matches.`;
              if (runner) reasoning += ` Runner-up: ${runner.name} (EWMA ${runner.ewma}, ${runner.trend}).`;
              reasoning += ` Picking ${ts.name} - strongest form + matchup advantage.`;
            }

          } else if (predType === "TOTAL_RUNS") {
            const combinedForm = (intel.teamForm[match.team1] || 0) + (intel.teamForm[match.team2] || 0);
            const venueAvg = intel.venue?.venueAvgRuns || 160;
            const roleBat = (intel.roleWeighted?.team1BatForm || 0) + (intel.roleWeighted?.team2BatForm || 0);

            // Multi-factor total prediction
            const predictedScore = venueAvg * 0.35 + combinedForm * 0.35 + roleBat * 0.30;

            if (predictedScore > 170) {
              outcome = "OVER_180"; confidence = Math.min(MAX_CONFIDENCE, Math.round(55 + (predictedScore - 170) * 0.5));
            } else if (predictedScore > 145) {
              outcome = "OVER_150"; confidence = 62;
            } else {
              outcome = "UNDER_150"; confidence = 58;
            }

            const parts = [
              `Venue avg: ${venueAvg} runs (${intel.venue?.highScoringVenue ? 'high-scoring' : venueAvg < 145 ? 'bowling-friendly' : 'balanced'}).`,
              `Combined EWMA: ${match.team1} ${intel.teamForm[match.team1]} + ${match.team2} ${intel.teamForm[match.team2]} = ${combinedForm.toFixed(1)}.`,
              `Role-weighted batting: ${roleBat.toFixed(1)}.`,
            ];
            if (intel.tossImpact?.venueType !== 'balanced') parts.push(intel.tossImpact.reasoning);
            parts.push(`Predicted composite: ${predictedScore.toFixed(0)}. Calling ${outcome}.`);
            reasoning = parts.join(' ');
          }

          if (outcome) {
            decisions.push({
              matchId: match.matchId, team1: match.team1, team2: match.team2,
              predictionType: predType, predictedOutcome: outcome, confidence, reasoning,
              _intel: intel, // pass through for agent thinking logs
            });
          }
        }
        continue;
      } catch (err) {
        console.error("6-factor intelligence failed for match", match.matchId, err.message);
      }
    }

    // ── Credit-based fallback ──
    const t1 = teamStrength(players, match.team1);
    const t2 = teamStrength(players, match.team2);

    for (const predType of predictionTypes) {
      const key = `${match.matchId}-${predType}`;
      if (alreadyPredicted.has(key)) continue;
      let outcome, confidence, reasoning;

      if (predType === "MATCH_WINNER") {
        const diff = t1.total - t2.total;
        if (diff > 5) {
          outcome = match.team1.toUpperCase().replace(/\s+/g, "_") + "_WIN";
          confidence = Math.min(MAX_CONFIDENCE, 60 + Math.abs(diff) * 2);
          reasoning = `${match.team1} stronger roster (${t1.total.toFixed(1)} vs ${t2.total.toFixed(1)} credits). Fallback mode - no historical intelligence available.`;
        } else if (diff < -5) {
          outcome = match.team2.toUpperCase().replace(/\s+/g, "_") + "_WIN";
          confidence = Math.min(MAX_CONFIDENCE, 60 + Math.abs(diff) * 2);
          reasoning = `${match.team2} stronger roster. Fallback mode.`;
        } else {
          outcome = match.team1.toUpperCase().replace(/\s+/g, "_") + "_WIN";
          confidence = 55;
          reasoning = `Evenly matched - slight edge to ${match.team1}. Fallback mode.`;
        }
      } else if (predType === "TOP_SCORER") {
        const p1 = pickTopScorer(players, match.team1);
        const p2 = pickTopScorer(players, match.team2);
        const pick = p1 && p2 ? (p1.credits >= p2.credits ? p1 : p2) : (p1 || p2);
        if (pick) { outcome = playerToOutcome(pick.name); confidence = 50; reasoning = `${pick.name} highest credit value. Fallback mode.`; }
      } else if (predType === "TOTAL_RUNS") {
        const c = t1.total + t2.total;
        if (c > 170) { outcome = "OVER_180"; confidence = 65; }
        else if (c > 150) { outcome = "OVER_150"; confidence = 60; }
        else { outcome = "UNDER_150"; confidence = 55; }
        reasoning = `Combined credits: ${c.toFixed(1)}. Fallback mode.`;
      }

      if (outcome) {
        decisions.push({ matchId: match.matchId, team1: match.team1, team2: match.team2, predictionType: predType, predictedOutcome: outcome, confidence, reasoning });
      }
    }
  }

  decisions.sort((a, b) => b.confidence - a.confidence);
  return decisions;
}

module.exports = { analyzePredictions, teamStrength, pickTopScorer };
