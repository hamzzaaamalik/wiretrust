/**
 * Franchise Agent Runner — Autonomous AI agents for franchise management.
 *
 * Three agent types:
 *   1. SCOUT        — Monitors rival teams every 30 min, alerts on form changes
 *   2. FORM_MONITOR — Tracks squad form every 15 min, alerts on breakouts/collapses
 *   3. MATCH_PREP   — Generates pre-match scouting reports 24h before fixtures
 *
 * Agents run on intervals, store reports in DB, and push alerts.
 * Uses mlEngine.js for all analysis (Random Forest, regression, z-score).
 */

const { runAllIntelligence } = require('./mlEngine');

// ─── State ──────────────────────────────────────────────────────────────────

const activeAgents = new Map(); // agentId -> { interval, config, type, ... }
const agentReports = new Map(); // agentId -> [{ timestamp, type, data }]
const MAX_REPORTS = 50;

// ─── Agent Types ────────────────────────────────────────────────────────────

const AGENT_TYPES = {
  SCOUT: {
    name: 'Opposition Scout',
    description: 'Monitors all rival teams for form changes, momentum shifts, and player breakouts. Runs every 30 minutes.',
    interval: 30 * 60 * 1000,
    icon: 'eye',
  },
  FORM_MONITOR: {
    name: 'Squad Form Monitor',
    description: 'Tracks your squad players using ML regression. Alerts on performance anomalies (breakouts, collapses). Runs every 15 minutes.',
    interval: 15 * 60 * 1000,
    icon: 'activity',
  },
  MATCH_PREP: {
    name: 'Match Preparation',
    description: 'Auto-generates scouting reports using Random Forest predictions before upcoming fixtures. Runs every hour.',
    interval: 60 * 60 * 1000,
    icon: 'brain',
  },
};

// ─── Report Storage ─────────────────────────────────────────────────────────

function addReport(agentId, report) {
  if (!agentReports.has(agentId)) agentReports.set(agentId, []);
  const reports = agentReports.get(agentId);
  reports.unshift({ ...report, timestamp: new Date().toISOString() });
  if (reports.length > MAX_REPORTS) reports.length = MAX_REPORTS;

  // Persist to DB
  const agent = activeAgents.get(agentId);
  if (agent?.db) {
    agent.db.query(
      `INSERT INTO franchise_agent_reports (agent_id, franchise_id, type, severity, title, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agentId, agent.franchiseId, report.type, report.severity || 'info', report.title, JSON.stringify(report.data || {})]
    ).catch(err => console.warn('[franchiseAgent] DB persist failed:', err.message));
  }
}

// ─── Agent Cycle Logic ──────────────────────────────────────────────────────

async function runScoutCycle(agentId, config) {
  const agent = activeAgents.get(agentId);
  if (!agent) return;

  try {
    addReport(agentId, { type: 'cycle', severity: 'info', title: 'Scout cycle started', data: { message: 'Analyzing all rival teams...' } });

    const intel = await runAllIntelligence(agent.db, config.teamName, null, null);
    const opponents = intel.opponentWatch?.opponents || [];

    // Check for high-threat teams
    const highThreats = opponents.filter(o => o.threatLevel === 'HIGH');
    if (highThreats.length > 0) {
      addReport(agentId, {
        type: 'alert', severity: 'warning',
        title: `${highThreats.length} high-threat opponent${highThreats.length > 1 ? 's' : ''} detected`,
        data: { teams: highThreats.map(t => ({ team: t.team, elo: t.elo, momentum: t.momentum, record: t.record })) },
      });
    }

    // Check for momentum shifts
    for (const opp of opponents) {
      if (opp.momentum >= 75) {
        addReport(agentId, {
          type: 'alert', severity: 'warning',
          title: `${opp.team} on a hot streak (momentum ${opp.momentum}/100)`,
          data: { team: opp.team, momentum: opp.momentum, lastResults: opp.lastResults, elo: opp.elo },
        });
      }
      if (opp.momentum <= 25) {
        addReport(agentId, {
          type: 'insight', severity: 'info',
          title: `${opp.team} struggling (momentum ${opp.momentum}/100) — potential upset target`,
          data: { team: opp.team, momentum: opp.momentum, lastResults: opp.lastResults },
        });
      }
    }

    addReport(agentId, {
      type: 'report', severity: 'info',
      title: `Scouted ${opponents.length} opponents`,
      data: { opponents: opponents.map(o => ({ team: o.team, elo: o.elo, momentum: o.momentum, threat: o.threatLevel })) },
    });
  } catch (err) {
    addReport(agentId, { type: 'error', severity: 'error', title: `Scout cycle failed: ${err.message}`, data: {} });
  }
}

async function runFormMonitorCycle(agentId, config) {
  const agent = activeAgents.get(agentId);
  if (!agent) return;

  try {
    addReport(agentId, { type: 'cycle', severity: 'info', title: 'Form analysis started', data: { message: 'Running ML regression on squad...' } });

    const intel = await runAllIntelligence(agent.db, config.teamName, null, null);
    const anomalies = intel.ml?.anomalies;
    const forecasts = intel.ml?.playerForecasts || [];

    // Alert on breakouts
    if (anomalies?.breakouts?.length > 0) {
      for (const p of anomalies.breakouts) {
        addReport(agentId, {
          type: 'alert', severity: 'success',
          title: `BREAKOUT: ${p.name} performing at z-score ${p.zScore} (top ${100 - p.percentile}%)`,
          data: { player: p.name, role: p.role, zScore: p.zScore, percentile: p.percentile, mean: p.mean, latest: p.latest },
        });
      }
    }

    // Alert on collapses
    if (anomalies?.collapses?.length > 0) {
      for (const p of anomalies.collapses) {
        addReport(agentId, {
          type: 'alert', severity: 'error',
          title: `COLLAPSE: ${p.name} dropped to z-score ${p.zScore} (bottom ${p.percentile}%)`,
          data: { player: p.name, role: p.role, zScore: p.zScore, percentile: p.percentile, mean: p.mean, latest: p.latest },
        });
      }
    }

    // Top form players
    const topPredicted = forecasts.filter(p => p.forecast?.predicted > 0).slice(0, 3);
    if (topPredicted.length > 0) {
      addReport(agentId, {
        type: 'insight', severity: 'info',
        title: `Top predicted performers: ${topPredicted.map(p => `${p.name} (${p.forecast.predicted} FP)`).join(', ')}`,
        data: { players: topPredicted.map(p => ({ name: p.name, predicted: p.forecast.predicted, trend: p.forecast.trend, confidence: p.forecast.confidence })) },
      });
    }

    addReport(agentId, {
      type: 'report', severity: 'info',
      title: `Form check complete — ${anomalies?.summary?.breakouts || 0} breakouts, ${anomalies?.summary?.collapses || 0} collapses`,
      data: { summary: anomalies?.summary },
    });
  } catch (err) {
    addReport(agentId, { type: 'error', severity: 'error', title: `Form monitor failed: ${err.message}`, data: {} });
  }
}

async function runMatchPrepCycle(agentId, config) {
  const agent = activeAgents.get(agentId);
  if (!agent) return;

  try {
    // Find next upcoming match
    const { rows } = await agent.db.query(
      `SELECT match_id, team1, team2, venue, start_time FROM matches
       WHERE status = 'UPCOMING' AND (team1 ILIKE $1 OR team2 ILIKE $1)
       ORDER BY start_time ASC LIMIT 1`,
      [`%${config.teamName.replace(/^The\s+/i, '')}%`]
    );

    if (rows.length === 0) {
      addReport(agentId, { type: 'info', severity: 'info', title: 'No upcoming matches found', data: {} });
      return;
    }

    const match = rows[0];
    const opponent = match.team1.toLowerCase().includes(config.teamName.toLowerCase().replace(/^the\s+/i, ''))
      ? match.team2 : match.team1;

    addReport(agentId, { type: 'cycle', severity: 'info', title: `Preparing scouting report: vs ${opponent}`, data: { matchId: match.match_id, venue: match.venue } });

    const intel = await runAllIntelligence(agent.db, config.teamName, opponent, match.venue);

    if (intel.scouting) {
      addReport(agentId, {
        type: 'scouting_report', severity: 'info',
        title: `Match Report: ${config.teamName} vs ${opponent}`,
        data: {
          opponent,
          venue: match.venue,
          winProbability: intel.ml?.matchPrediction?.probability || {},
          confidence: intel.ml?.matchPrediction?.confidence || 0,
          modelAccuracy: intel.ml?.matchPrediction?.modelStats?.accuracy,
          topThreats: intel.scouting.topThreats?.slice(0, 3),
          tacticalNotes: intel.scouting.tacticalNotes,
          optimizedSquad: intel.ml?.optimizedSquad ? {
            captain: intel.ml.optimizedSquad.captain,
            viceCaptain: intel.ml.optimizedSquad.viceCaptain,
            predictedTotal: intel.ml.optimizedSquad.adjustedTotal,
          } : null,
        },
      });
    }
  } catch (err) {
    addReport(agentId, { type: 'error', severity: 'error', title: `Match prep failed: ${err.message}`, data: {} });
  }
}

const CYCLE_FUNCTIONS = {
  SCOUT: runScoutCycle,
  FORM_MONITOR: runFormMonitorCycle,
  MATCH_PREP: runMatchPrepCycle,
};

// ─── Lifecycle ──────────────────────────────────────────────────────────────

function startAgent(agentId, type, config, db) {
  if (activeAgents.has(agentId)) return { success: false, reason: 'Agent already running' };
  if (!AGENT_TYPES[type]) return { success: false, reason: `Unknown type: ${type}` };
  if (activeAgents.size >= 10) return { success: false, reason: 'Maximum agents reached (10)' };

  const agentType = AGENT_TYPES[type];
  const cycleFn = CYCLE_FUNCTIONS[type];
  const intervalMs = config.intervalMs || agentType.interval;

  // MUST register agent in Map BEFORE running first cycle
  // (cycle functions call activeAgents.get(agentId) to access db)
  const agentEntry = { interval: null, type, config, db, franchiseId: config.franchiseId, startedAt: new Date().toISOString() };
  activeAgents.set(agentId, agentEntry);

  addReport(agentId, { type: 'status', severity: 'info', title: `${agentType.name} agent activated`, data: { type, interval: `${Math.round(intervalMs / 60000)}m` } });

  // Run first cycle immediately (agent is already in Map)
  console.log(`[franchiseAgent] Starting ${type} agent (id: ${agentId}) for team: ${config.teamName}`);
  cycleFn(agentId, config).then(() => {
    console.log(`[franchiseAgent] First cycle complete for ${agentId}`);
  }).catch(err => {
    console.error(`[franchiseAgent] First cycle failed for ${agentId}:`, err.message);
    addReport(agentId, { type: 'error', severity: 'error', title: err.message, data: {} });
  });

  const interval = setInterval(() => {
    cycleFn(agentId, config).catch(err =>
      addReport(agentId, { type: 'error', severity: 'error', title: err.message, data: {} })
    );
  }, intervalMs);

  agentEntry.interval = interval;
  return { success: true, message: `${agentType.name} started` };
}

function stopAgent(agentId, requesterFranchiseId = null) {
  const agent = activeAgents.get(agentId);
  if (!agent) return { success: false, reason: 'Not running' };

  // Auth: only the franchise that started it can stop it
  if (requesterFranchiseId && agent.franchiseId !== requesterFranchiseId) {
    return { success: false, reason: 'Not authorized' };
  }

  clearInterval(agent.interval);
  addReport(agentId, { type: 'status', severity: 'info', title: `${AGENT_TYPES[agent.type]?.name || agent.type} agent stopped`, data: {} });
  activeAgents.delete(agentId);

  // Clean up orphaned reports after 5 minutes
  setTimeout(() => { if (!activeAgents.has(agentId)) agentReports.delete(agentId); }, 5 * 60 * 1000);

  return { success: true };
}

function getAgentStatus(agentId) {
  const agent = activeAgents.get(agentId);
  return {
    running: !!agent,
    type: agent?.type || null,
    typeName: agent ? AGENT_TYPES[agent.type]?.name : null,
    franchiseId: agent?.franchiseId || null,
    startedAt: agent?.startedAt || null,
    reports: (agentReports.get(agentId) || []).slice(0, 30),
  };
}

function listAgents(franchiseId) {
  const result = [];
  for (const [id, agent] of activeAgents) {
    if (!franchiseId || agent.franchiseId === franchiseId) {
      result.push({
        agentId: id,
        type: agent.type,
        typeName: AGENT_TYPES[agent.type]?.name,
        startedAt: agent.startedAt,
        reportCount: (agentReports.get(id) || []).length,
      });
    }
  }
  return result;
}

function getAgentTypes() {
  return Object.entries(AGENT_TYPES).map(([id, t]) => ({ id, ...t }));
}

module.exports = { startAgent, stopAgent, getAgentStatus, listAgents, getAgentTypes, AGENT_TYPES };
