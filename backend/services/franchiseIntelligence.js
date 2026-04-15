/**
 * Franchise Intelligence Service
 *
 * Wraps cricketIntelligence.js for franchise-specific use cases.
 * No duplicate algorithms - every function calls the core engine.
 *
 * Four capabilities:
 *   1. generateScoutingReport  - Pre-match opponent analysis
 *   2. getSquadFormAlerts      - Player form monitoring with alerts
 *   3. getContestIntelligence  - Contest optimization recommendations
 *   4. getOpponentWatch        - Rival team monitoring dashboard
 */

const {
  analyzeMatch,
  getPlayerForms,
  getMomentumScore,
  getTeamRecord,
  calculateTeamElos,
  getHeadToHead,
  analyzeVenue,
  getRoleWeightedForm,
} = require('./cricketIntelligence');

// ─── 1. Pre-Match Scouting Report ─────────────────────────────────────────

async function generateScoutingReport(db, myTeam, opponent, venue = null) {
  // Run full 6-factor analysis
  const analysis = await analyzeMatch(db, myTeam, opponent, venue);
  const opponentForms = await getPlayerForms(db, opponent, myTeam);
  const opponentMomentum = await getMomentumScore(db, opponent);
  const myMomentum = await getMomentumScore(db, myTeam);
  const myRecord = await getTeamRecord(db, myTeam);
  const oppRecord = await getTeamRecord(db, opponent);

  // Sort opponent players by EWMA form
  const oppPlayers = Object.values(opponentForms)
    .filter(p => p.team === opponent || p.team?.includes(opponent.replace(/^The\s+/i, '')))
    .sort((a, b) => (b.ewma || 0) - (a.ewma || 0));

  const keyThreats = oppPlayers.filter(p => p.trend === 'rising').slice(0, 3);
  const weaknesses = oppPlayers.filter(p => p.trend === 'declining').slice(0, 3);
  const topPlayers = oppPlayers.slice(0, 5);

  // Generate tactical notes
  const notes = [];

  // Momentum insight
  if (opponentMomentum.momentum <= 35) {
    notes.push(`${opponent} has low momentum (${opponentMomentum.momentum}/100, ${opponentMomentum.trajectory}). They may experiment with lineup changes.`);
  } else if (opponentMomentum.momentum >= 65) {
    notes.push(`${opponent} is in strong form (${opponentMomentum.momentum}/100, ${opponentMomentum.trajectory}). Expect their best XI and high confidence.`);
  }

  // Form comparison
  const myAvgForm = analysis.teamForm[myTeam] || 0;
  const oppAvgForm = analysis.teamForm[opponent] || 0;
  if (oppAvgForm > myAvgForm * 1.15) {
    notes.push(`Their batting form (EWMA ${oppAvgForm.toFixed(1)}) exceeds yours (${myAvgForm.toFixed(1)}). Consider strengthening your bowling lineup.`);
  } else if (myAvgForm > oppAvgForm * 1.15) {
    notes.push(`Your batting form (EWMA ${myAvgForm.toFixed(1)}) is stronger than theirs (${oppAvgForm.toFixed(1)}). Capitalize with aggressive top-order strategy.`);
  }

  // Rising threats
  if (keyThreats.length > 0) {
    notes.push(`Watch out for ${keyThreats.map(p => `${p.name} (${p.role}, EWMA ${p.ewma.toFixed(1)}, rising)`).join(', ')}. These players are trending up.`);
  }

  // Venue insight
  if (analysis.venue?.venueMatches > 0) {
    const avgRuns = analysis.venue.venueAvgRuns;
    const venueType = avgRuns > 165 ? 'batting-friendly' : avgRuns < 145 ? 'bowling-friendly' : 'balanced';
    notes.push(`${venue || 'This venue'} averages ${avgRuns} runs (${venueType}). ${venueType === 'batting-friendly' ? 'Bat first if you win the toss.' : venueType === 'bowling-friendly' ? 'Consider bowling first to exploit conditions.' : 'Toss impact is minimal here.'}`);
  }

  // H2H insight
  if (analysis.headToHead?.totalMatches >= 3) {
    const h2h = analysis.headToHead;
    const dominant = h2h.team1Wins > h2h.team2Wins ? myTeam : opponent;
    notes.push(`Head-to-head: ${h2h.team1Wins}-${h2h.team2Wins} in ${h2h.totalMatches} meetings. ${dominant === myTeam ? 'History favors you.' : 'They have the edge historically.'}`);
  }

  return {
    myTeam,
    opponent,
    venue,
    prediction: analysis.predictedWinner,
    confidence: analysis.confidence,
    winProbability: analysis.winProbability,
    factors: {
      elo: { my: analysis.elo[myTeam], opp: analysis.elo[opponent], weight: '25%' },
      form: { my: myAvgForm, opp: oppAvgForm, weight: '20%' },
      h2h: analysis.headToHead ? { ...analysis.headToHead, weight: '15%' } : null,
      momentum: { my: myMomentum, opp: opponentMomentum, weight: '15%' },
      venue: analysis.venue ? { ...analysis.venue, weight: '15%' } : null,
      roleWeighted: analysis.roleWeighted ? { ...analysis.roleWeighted, weight: '10%' } : null,
    },
    myRecord,
    oppRecord,
    topThreats: topPlayers.map(p => ({
      name: p.name, role: p.role, ewma: p.ewma, trend: p.trend,
      consistency: p.consistency, matchesPlayed: p.matchesPlayed,
    })),
    risingThreats: keyThreats.map(p => ({ name: p.name, role: p.role, ewma: p.ewma })),
    decliningPlayers: weaknesses.map(p => ({ name: p.name, role: p.role, ewma: p.ewma })),
    tacticalNotes: notes,
  };
}

// ─── 2. Squad Form Alerts ─────────────────────────────────────────────────

async function getSquadFormAlerts(db, teamName, declineThreshold = 0.15, peakThreshold = 0.15) {
  const forms = await getPlayerForms(db, teamName, teamName);
  const players = Object.values(forms).sort((a, b) => (b.ewma || 0) - (a.ewma || 0));

  const alerts = [];

  const result = players.map(p => {
    let status = 'STEADY';
    const avg = p.average || p.ewma || 0;
    const recent = p.recentAvg || p.ewma || 0;

    if (avg > 0 && recent > avg * (1 + peakThreshold) && p.trend === 'rising') {
      status = 'PEAKING';
      alerts.push({ name: p.name, role: p.role, status, ewma: p.ewma, message: `${p.name} is peaking (EWMA ${p.ewma.toFixed(1)}, +${((recent / avg - 1) * 100).toFixed(0)}% above average)` });
    } else if (avg > 0 && recent < avg * (1 - declineThreshold) && p.trend === 'declining') {
      status = 'DECLINING';
      alerts.push({ name: p.name, role: p.role, status, ewma: p.ewma, message: `${p.name} is declining (EWMA ${p.ewma.toFixed(1)}, ${((1 - recent / avg) * 100).toFixed(0)}% below average)` });
    } else if (p.consistency >= 70) {
      status = 'CONSISTENT';
    } else if (p.consistency > 0 && p.consistency < 40) {
      status = 'INCONSISTENT';
    }

    return {
      playerId: p.player_id, name: p.name, role: p.role, team: p.team,
      ewma: p.ewma || 0, trend: p.trend || 'steady',
      consistency: p.consistency || 0, peakForm: p.peakForm || 0,
      matchesPlayed: p.matchesPlayed || 0, recentAvg: recent,
      status,
    };
  });

  return {
    players: result,
    alerts,
    summary: {
      total: result.length,
      peaking: result.filter(p => p.status === 'PEAKING').length,
      declining: result.filter(p => p.status === 'DECLINING').length,
      consistent: result.filter(p => p.status === 'CONSISTENT').length,
    },
  };
}

// ─── 3. Contest Intelligence ──────────────────────────────────────────────

async function getContestIntelligence(db, franchiseId) {
  // Get upcoming matches for this franchise
  const { rows: upcomingMatches } = await db.query(
    `SELECT match_id, team1, team2, venue, start_time FROM matches
     WHERE franchise_id = $1 AND status = 'UPCOMING'
     ORDER BY start_time ASC LIMIT 10`,
    [franchiseId]
  );

  // Get completed match engagement stats
  let avgPredictionsPerMatch = 0;
  let avgSquadsPerContest = 0;
  try {
    const { rows: predStats } = await db.query(
      `SELECT COUNT(*) / GREATEST(COUNT(DISTINCT match_id), 1) AS avg_per_match
       FROM predictions WHERE franchise_id = $1`,
      [franchiseId]
    );
    avgPredictionsPerMatch = Number(predStats[0]?.avg_per_match || 0);
  } catch { /* table might not exist */ }

  // Find best match for next contest (highest combined team EWMA)
  let bestMatch = null;
  if (upcomingMatches.length > 0) {
    const elos = await calculateTeamElos(db);
    let bestScore = 0;
    for (const m of upcomingMatches) {
      const score = (elos[m.team1] || 1500) + (elos[m.team2] || 1500);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          matchId: m.match_id, team1: m.team1, team2: m.team2,
          venue: m.venue, startTime: m.start_time,
          combinedElo: score,
          reason: `${m.team1} (ELO ${elos[m.team1] || 1500}) vs ${m.team2} (ELO ${elos[m.team2] || 1500}) - highest-profile matchup drives maximum fan engagement.`,
        };
      }
    }
  }

  // Suggested prize pool based on engagement
  const suggestedPool = Math.max(1, Math.round(avgPredictionsPerMatch * 0.5));

  return {
    upcomingMatches: upcomingMatches.length,
    avgPredictionsPerMatch: Math.round(avgPredictionsPerMatch),
    avgSquadsPerContest: Math.round(avgSquadsPerContest),
    bestMatchForContest: bestMatch,
    suggestedPrizePool: `${suggestedPool} WIRE`,
    recommendations: [
      bestMatch ? `Create a contest for ${bestMatch.team1} vs ${bestMatch.team2} - highest combined ELO drives fan interest.` : 'No upcoming matches found.',
      avgPredictionsPerMatch > 10 ? 'Strong prediction engagement - consider increasing prize pools to attract more squad challenge entries.' : 'Build prediction engagement first - fans who predict are more likely to join contests.',
      'Time contests to start 24 hours before match day for maximum participation.',
    ],
  };
}

// ─── 4. Opponent Watch ────────────────────────────────────────────────────

async function getOpponentWatch(db, myTeam) {
  // Get all teams
  const { rows: teams } = await db.query(
    `SELECT DISTINCT team FROM players WHERE active = true ORDER BY team`
  );

  const elos = await calculateTeamElos(db);
  const opponents = [];

  for (const { team } of teams) {
    // Skip own team
    if (team.toLowerCase().includes(myTeam.toLowerCase().replace(/^the\s+/i, '')) ||
        myTeam.toLowerCase().includes(team.toLowerCase().replace(/^the\s+/i, ''))) continue;

    const [momentum, record] = await Promise.all([
      getMomentumScore(db, team).catch(() => ({ momentum: 50, trajectory: 'unknown', lastResults: [] })),
      getTeamRecord(db, team).catch(() => ({ wins: 0, losses: 0, winRate: 0 })),
    ]);

    // Get top 3 form players
    const forms = await getPlayerForms(db, team, team).catch(() => ({}));
    const topPlayers = Object.values(forms)
      .sort((a, b) => (b.ewma || 0) - (a.ewma || 0))
      .slice(0, 3)
      .map(p => ({ name: p.name, role: p.role, ewma: p.ewma, trend: p.trend }));

    // Threat level based on ELO + momentum
    const elo = elos[team] || 1500;
    const mom = momentum.momentum || 50;
    const threatScore = elo * 0.6 + mom * 8; // weighted composite
    const threatLevel = threatScore > 1020 ? 'HIGH' : threatScore > 960 ? 'MEDIUM' : 'LOW';

    opponents.push({
      team, elo,
      momentum: mom,
      trajectory: momentum.trajectory,
      lastResults: momentum.lastResults || [],
      record: { wins: record.wins, losses: record.losses, winRate: record.winRate },
      topPlayers,
      threatLevel,
      threatScore,
    });
  }

  // Sort by threat level (HIGH first), then by ELO
  opponents.sort((a, b) => b.threatScore - a.threatScore);

  return { myTeam, opponents };
}

module.exports = {
  generateScoutingReport,
  getSquadFormAlerts,
  getContestIntelligence,
  getOpponentWatch,
};
