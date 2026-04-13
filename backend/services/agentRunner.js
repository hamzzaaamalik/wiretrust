/**
 * Agent Runner — Autonomous AI agent execution service.
 *
 * Manages the lifecycle of autonomous agents:
 *   1. Loads active agents owned by the backend signer
 *   2. Runs strategy analysis (predictions, fantasy squads)
 *   3. Executes actions through ExecutionGateway (policy-enforced)
 *   4. Logs all decisions and outcomes
 *
 * Each agent runs on a configurable interval. The PolicyEngine on-chain
 * enforces all guardrails — the runner just makes decisions and attempts
 * execution. Violations are caught and logged, not hidden.
 *
 * Data sources: PostgreSQL DB (players, matches) + on-chain contracts.
 * Zero mock data — all real.
 */

const { ethers } = require("ethers");
const { analyzePredictions } = require("./strategies/predictionStrategy");
const { analyzeContests } = require("./strategies/fantasyStrategy");

// ─── State ───────────────────────────────────────────────────────────────────

const activeAgents = new Map(); // agentId → { interval, config, db, logs, isRunning }
const agentLogs = new Map(); // agentId → [{ timestamp, type, action, outcome, reasoning }]
const MAX_LOGS = 100;
const MAX_AGENTS = 50;
const MAX_LOG_AGENTS = 200; // max agents tracked in agentLogs before cleanup

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addLog(agentId, entry) {
  if (!agentLogs.has(agentId)) agentLogs.set(agentId, []);
  const logs = agentLogs.get(agentId);
  const logEntry = { ...entry, timestamp: new Date().toISOString() };
  logs.unshift(logEntry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;

  // Persist to DB (fire and forget)
  const agentState = activeAgents.get(agentId);
  if (agentState?.db) {
    agentState.db.query(
      `INSERT INTO agent_runs (agent_id, type, action, outcome, reasoning, tx_hash, gas_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agentId, entry.type || 'info', entry.action || '', entry.outcome || '', entry.reasoning || null, entry.txHash || null, entry.gasUsed || null]
    ).catch((err) => console.warn(`[agentRunner] DB log persist failed for agent ${agentId}:`, err.message));
  }
}

function generateNonce() {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Fetch active players from DB.
 * Returns array matching strategy interface: { playerId, name, team, role, credits }
 */
async function fetchPlayers(db) {
  const { rows } = await db.query(
    "SELECT player_id AS \"playerId\", name, team, role, credits FROM players WHERE active = true ORDER BY credits DESC"
  );
  return rows;
}

/**
 * Fetch match teams from DB for a given match.
 */
async function fetchMatchInfo(db, matchId) {
  const { rows } = await db.query(
    "SELECT team1, team2 FROM matches WHERE match_id = $1",
    [matchId]
  );
  return rows[0] || null;
}

/**
 * Fetch players assigned to a specific match from DB.
 */
async function fetchMatchPlayers(db, matchId) {
  const { rows } = await db.query(
    `SELECT p.player_id AS "playerId", p.name, p.team, p.role, p.credits
     FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = $1 AND p.active = true
     ORDER BY p.credits DESC`,
    [matchId]
  );
  return rows;
}

// ─── Core Execution ──────────────────────────────────────────────────────────

/**
 * Execute a single action through the ExecutionGateway.
 * Returns { success, type, txHash, reason }.
 */
/**
 * Check if an error is transient and worth retrying.
 */
function isTransientError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('nonce') || msg.includes('timeout') || msg.includes('etimedout')
    || msg.includes('502') || msg.includes('503') || msg.includes('rate limit');
}

/**
 * Query current gas config from provider instead of hardcoding.
 */
async function getGasConfig(provider) {
  try {
    const feeData = await provider.getFeeData();
    return {
      gasLimit: 800000n,
      maxFeePerGas: feeData.maxFeePerGas || 10000000000n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 1000000000n,
    };
  } catch {
    return { gasLimit: 800000n, gasPrice: 10000000000n };
  }
}

async function executeAction(contracts, agentId, target, actionName, calldata, amountWei = 0n) {
  const MAX_RETRIES = 3;
  const actionBytes = ethers.encodeBytes32String(actionName);
  const nonce = generateNonce();
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Query current gas price from network
      const gasConfig = await getGasConfig(contracts.executionGateway.runner?.provider);

      const tx = await contracts.executionGateway.execute(
        agentId,
        target,
        actionBytes,
        calldata,
        amountWei,
        nonce,
        { value: amountWei, ...gasConfig }
      );

      const receipt = await tx.wait();

      // Parse events from receipt
      const iface = contracts.executionGateway.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "AgentViolation") {
            return {
              success: false,
              type: "violation",
              reason: parsed.args.reason,
              txHash: receipt.hash,
            };
          }
          if (parsed?.name === "AgentExecuted") {
            return {
              success: parsed.args.success,
              type: parsed.args.success ? "success" : "failed",
              gasUsed: parsed.args.gasUsed.toString(),
              txHash: receipt.hash,
            };
          }
        } catch {}
      }

      // No recognized event found — default to failure, not success
      return { success: false, type: "unknown", reason: "No recognized event in receipt", txHash: receipt.hash };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1 && isTransientError(err)) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return { success: false, type: "error", reason: err.message || String(err) };
    }
  }

  return { success: false, type: "error", reason: lastError?.message || "Max retries exceeded" };
}

// ─── Strategy Runners ────────────────────────────────────────────────────────

/** Small delay to make thinking steps feel sequential in the UI */
const think = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run prediction strategy for an agent.
 * Produces Claude-like multi-step reasoning visible in the decision log.
 */
async function runPredictionStrategy(contracts, addresses, agentId, config, db) {
  // ── Phase 1: Perception — gather all data sources ──
  addLog(agentId, {
    type: "thinking",
    action: "PERCEIVE",
    outcome: "Starting analysis cycle. Let me gather data from multiple sources before making any decisions...",
  });
  await think(800);

  // Fetch players from DB
  let players = [];
  try {
    players = await fetchPlayers(db);
  } catch (err) {
    addLog(agentId, { type: "error", action: "DATA", outcome: `Database unreachable: ${err.message}. I'll retry next cycle.` });
    return;
  }

  if (players.length === 0) {
    addLog(agentId, { type: "warning", action: "DATA", outcome: "No players in database yet. I need player data to make informed predictions - waiting for sync." });
    return;
  }

  // Load ELO ratings
  let elos = {};
  let topTeams = [];
  try {
    const { calculateTeamElos } = require("./cricketIntelligence");
    elos = await calculateTeamElos(db);
    topTeams = Object.entries(elos).sort((a, b) => b[1] - a[1]);
  } catch {}

  addLog(agentId, {
    type: "thinking",
    action: "PERCEIVE",
    outcome: `Data loaded: ${players.length} players across ${new Set(players.map(p => p.team)).size} teams. Running 6-factor intelligence: ELO + H2H + Venue + Momentum + Role-Weighted Form + Player Matchups.`,
    reasoning: topTeams.length > 0
      ? `Power rankings: ${topTeams.slice(0, 4).map(([t, e], i) => `${i + 1}. ${t} (${e})`).join(', ')}. Self-learning ELO (K=${32}) + EWMA (decay=${0.3}) + venue stats + head-to-head records + momentum scoring + player-vs-team matchups.`
      : null,
  });
  await think(600);

  // Fetch matches — try on-chain oracle first, then fallback to DB
  let matches = [];
  try {
    const matchCount = await contracts.matchOracle.matchCount();
    addLog(agentId, {
      type: "thinking",
      action: "ORACLE",
      outcome: `Querying MatchOracle contract... found ${matchCount} total matches on-chain. Filtering for unresolved fixtures.`,
    });
    await think(400);

    for (let i = 1; i <= Number(matchCount); i++) {
      try {
        const m = await contracts.matchOracle.matches(i);
        if (!m.resultSubmitted && !m.abandoned) {
          matches.push({
            matchId: i,
            team1: m.team1,
            team2: m.team2,
            startTime: Number(m.startTime),
            status: "UPCOMING",
          });
        }
      } catch {}
    }
  } catch (err) {
    addLog(agentId, { type: "warning", action: "ORACLE", outcome: `MatchOracle query issue: ${err.message}. Falling back to database.` });
  }

  // Fallback: if oracle has no upcoming matches, pull from DB
  if (matches.length === 0) {
    try {
      const { rows } = await db.query(
        `SELECT match_id AS "matchId", team1, team2, start_time, status
         FROM matches
         WHERE status IN ('UPCOMING', 'LIVE', 'COMPLETED')
         ORDER BY start_time DESC
         LIMIT 20`
      );
      matches = rows.map(r => ({
        matchId: r.matchId,
        team1: r.team1,
        team2: r.team2,
        startTime: r.start_time ? Math.floor(new Date(r.start_time).getTime() / 1000) : 0,
        status: r.status,
      }));
      if (matches.length > 0) {
        addLog(agentId, {
          type: "thinking",
          action: "PERCEIVE",
          outcome: `Oracle had no unresolved fixtures. Loaded ${matches.length} matches from database to analyze. Cross-referencing with my prediction history...`,
        });
        await think(300);
      }
    } catch {}
  }

  if (matches.length === 0) {
    addLog(agentId, { type: "info", action: "ANALYZE", outcome: "No matches found in oracle or database. I'll check again next cycle." });
    return;
  }

  addLog(agentId, {
    type: "thinking",
    action: "PERCEIVE",
    outcome: `Found ${matches.length} upcoming matches to analyze. Let me check which ones I haven't predicted yet...`,
  });

  // ── Phase 2: Memory — check what we've already done ──
  let existingPredictions = [];
  try {
    const predCount = await contracts.predictionModule.predictionCount();
    const signerAddr = await contracts.executionGateway.runner?.address || "";
    for (let i = 1; i <= Math.min(Number(predCount), 50); i++) {
      try {
        const p = await contracts.predictionModule.predictions(i);
        if (p.predictor?.toLowerCase() === signerAddr.toLowerCase()) {
          existingPredictions.push({
            matchId: Number(p.matchId),
            predictionType: ethers.decodeBytes32String(p.predictionType),
          });
        }
      } catch {}
    }
  } catch {}

  if (existingPredictions.length > 0) {
    addLog(agentId, {
      type: "thinking",
      action: "MEMORY",
      outcome: `I've already made ${existingPredictions.length} predictions on-chain. Filtering those out to avoid duplicates.`,
    });
    await think(300);
  }

  // ── Phase 3: Reasoning — deep analysis ──
  addLog(agentId, {
    type: "thinking",
    action: "REASON",
    outcome: "Applying 6-factor composite model: ELO win probability, EWMA player form, head-to-head records, momentum scoring, venue analysis, and role-weighted form...",
  });
  await think(500);

  const decisions = await analyzePredictions(matches, existingPredictions, {
    agentId,
    franchiseId: 1,
    predictionTypes: config.predictionTypes || ["MATCH_WINNER", "TOP_SCORER"],
  }, players, db);

  if (decisions.length === 0) {
    addLog(agentId, { type: "info", action: "REASON", outcome: "All available matches already have my predictions. Nothing new to act on - I'll wait for new fixtures or match results." });
    return;
  }

  // Show 6-factor breakdown for top decisions
  for (const d of decisions.slice(0, 3)) {
    const intel = d._intel;
    let factorSummary = `${d.predictionType}: ${d.team1} vs ${d.team2} -> ${d.predictedOutcome} (${d.confidence}%)`;
    if (intel) {
      const parts = [];
      if (intel.elo) parts.push(`ELO ${intel.elo[d.team1] || '?'} vs ${intel.elo[d.team2] || '?'}`);
      if (intel.headToHead?.totalMatches > 0) parts.push(`H2H ${intel.headToHead.team1Wins}-${intel.headToHead.team2Wins}`);
      if (intel.momentum?.[d.team1]) parts.push(`Momentum ${intel.momentum[d.team1].momentum} vs ${intel.momentum[d.team2].momentum}`);
      if (intel.venue?.venueMatches > 0) parts.push(`Venue: ${intel.venue.venueAvgRuns} avg runs`);
      if (intel.roleWeighted) parts.push(`RW: ${d.team1} ${intel.roleWeighted.team1Weighted} | ${d.team2} ${intel.roleWeighted.team2Weighted}`);
      if (parts.length > 0) factorSummary += ` | ${parts.join(' | ')}`;
    }
    addLog(agentId, {
      type: "thinking",
      action: "REASON",
      outcome: factorSummary,
      reasoning: d.reasoning,
    });
  }
  await think(400);

  // ── Phase 4: Decision — pick the best action ──
  const maxActions = config.maxActionsPerCycle || 3;
  const toExecute = decisions.slice(0, maxActions);
  const best = toExecute[0];

  addLog(agentId, {
    type: "decision",
    action: "DECIDE",
    outcome: `Decision: I'll submit ${toExecute.length} prediction(s) this cycle. Highest confidence: ${best.predictionType} on ${best.team1} vs ${best.team2} at ${best.confidence}%.`,
    reasoning: `Out of ${decisions.length} opportunities, I'm selecting the top ${toExecute.length} by confidence score. ${best.confidence >= 70 ? 'Strong conviction - the data clearly favors this outcome.' : best.confidence >= 60 ? 'Moderate conviction - the edge is there but not overwhelming.' : 'Lower conviction - making this prediction for coverage but the matchup is close.'}`,
  });
  await think(300);

  // ── Phase 5: Action — execute on-chain ──
  for (const decision of toExecute) {
    addLog(agentId, {
      type: "thinking",
      action: "EXECUTE",
      outcome: `Encoding ${decision.predictionType} prediction and submitting to PredictionModule contract via ExecutionGateway...`,
    });

    const predIface = new ethers.Interface([
      "function createPrediction(uint256 franchiseId, uint256 matchId, bytes32 predictionType, bytes32 predictedOutcome) external returns (uint256)",
    ]);
    const calldata = predIface.encodeFunctionData("createPrediction", [
      1,
      decision.matchId,
      ethers.encodeBytes32String(decision.predictionType),
      ethers.encodeBytes32String(decision.predictedOutcome),
    ]);

    const result = await executeAction(
      contracts,
      agentId,
      addresses.predictionModule,
      "PREDICT",
      calldata
    );

    // Track gas
    const agentState = activeAgents.get(agentId);
    if (agentState && result.gasUsed) {
      agentState.totalGasUsed += BigInt(result.gasUsed);
      agentState.totalCycles++;
    }

    if (result.success) {
      addLog(agentId, {
        type: "success",
        action: "PREDICT",
        outcome: `Prediction confirmed on-chain! ${decision.predictionType}: ${decision.predictedOutcome} for ${decision.team1} vs ${decision.team2}. TX: ${result.txHash}${result.gasUsed ? ` | Gas: ${result.gasUsed}` : ''}`,
        reasoning: decision.reasoning,
      });
    } else {
      const friendlyReason = result.reason
        ? result.reason.replace(/execution reverted:?\s*/i, '')
        : 'The prediction may already exist or the match has been resolved';
      addLog(agentId, {
        type: result.type === "violation" ? "violation" : "error",
        action: result.type === "violation" ? "POLICY" : "PREDICT",
        outcome: `${result.type === 'violation' ? 'Policy engine blocked this action' : 'On-chain execution failed'}: ${friendlyReason}`,
        reasoning: result.type === 'violation'
          ? 'The PolicyEngine enforced a guardrail. This is working as designed - my actions are constrained by on-chain rules.'
          : 'I\'ll adjust my approach next cycle. This could mean the match state changed or I\'ve already predicted this.',
        txHash: result.txHash,
      });
    }

    if (toExecute.indexOf(decision) < toExecute.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // ── Phase 6: Reflection ──
  addLog(agentId, {
    type: "thinking",
    action: "REFLECT",
    outcome: `Cycle complete. Made ${toExecute.length} prediction(s). ${decisions.length - toExecute.length} opportunities remaining for next cycle. Monitoring for new match data and results...`,
  });
}

/**
 * Run fantasy strategy for an agent.
 * Claude-like multi-step reasoning for squad building.
 */
async function runFantasyStrategy(contracts, addresses, agentId, config, db) {
  // ── Phase 1: Scan contests ──
  addLog(agentId, {
    type: "thinking",
    action: "PERCEIVE",
    outcome: "Scanning FantasyModule contract for open squad challenge contests...",
  });
  await think(500);

  let players = [];
  try {
    players = await fetchPlayers(db);
  } catch (err) {
    addLog(agentId, { type: "error", action: "DATA", outcome: `Database query failed: ${err.message}` });
    return;
  }

  let contests = [];
  try {
    const fantasyModule = contracts.fantasyModule;
    let contestIds = [];
    try {
      const count = await fantasyModule.contestCount();
      for (let i = 1; i <= Number(count); i++) contestIds.push(i);
    } catch {
      try {
        const matchCount = await contracts.matchOracle.matchCount();
        for (let i = 1; i <= Number(matchCount); i++) contestIds.push(i);
      } catch {
        contestIds = [];
      }
    }

    for (const cid of contestIds) {
      try {
        const contest = await fantasyModule.contests(cid);
        if (contest && contest.active && !contest.finalized) {
          contests.push({
            contestId: cid,
            matchId: Number(contest.matchId || cid),
            sponsorPool: contest.sponsorPool?.toString() || "0",
            active: true,
          });
        }
      } catch {}
    }
  } catch (err) {
    addLog(agentId, { type: "error", action: "ANALYZE", outcome: `FantasyModule query failed: ${err.message}` });
    return;
  }

  if (contests.length === 0) {
    addLog(agentId, { type: "info", action: "ANALYZE", outcome: "No open contests on-chain right now. Franchise needs to create a contest first. Waiting..." });
    return;
  }

  addLog(agentId, {
    type: "thinking",
    action: "PERCEIVE",
    outcome: `Found ${contests.length} active contest(s). Let me analyze each one and build optimal squads using EWMA form data...`,
  });
  await think(400);

  // ── Phase 2: Deep analysis per contest ──
  for (const contest of contests) {
    const mi = await fetchMatchInfo(db, contest.matchId);
    if (!mi) {
      addLog(agentId, { type: "thinking", action: "REASON", outcome: `Contest #${contest.contestId}: match ${contest.matchId} not found in database. Skipping - I need team data to build a squad.` });
      continue;
    }

    const matchInfo = { team1: mi.team1, team2: mi.team2 };

    addLog(agentId, {
      type: "thinking",
      action: "REASON",
      outcome: `Analyzing contest #${contest.contestId}: ${mi.team1} vs ${mi.team2}. Prize pool: ${contest.sponsorPool !== "0" ? (Number(contest.sponsorPool) / 1e18).toFixed(4) + " WIRE" : "unfunded"}. Building squad with EWMA-optimized player selection...`,
    });
    await think(600);

    let matchPlayers = await fetchMatchPlayers(db, contest.matchId);
    if (matchPlayers.length < 11) matchPlayers = players;

    const decisions = await analyzeContests([contest], [], matchInfo, matchPlayers, db);

    if (decisions.length === 0) {
      addLog(agentId, { type: "info", action: "REASON", outcome: `Contest #${contest.contestId}: can't build a valid 11-player squad within budget, or I've already joined. Moving on.` });
      continue;
    }

    const decision = decisions[0];

    // Show squad breakdown
    addLog(agentId, {
      type: "decision",
      action: "SQUAD",
      outcome: `Squad ready for contest #${decision.contestId}: ${decision.squad?.length || 11} players, ${decision.totalCredits}/100 credits used.`,
      reasoning: decision.reasoning,
    });
    await think(300);

    // ── Phase 3: Execute ──
    addLog(agentId, {
      type: "thinking",
      action: "EXECUTE",
      outcome: `Submitting squad to FantasyModule via ExecutionGateway. Captain gets 2x points, Vice-Captain 1.5x. This is an on-chain transaction...`,
    });

    const fantasyIface = new ethers.Interface([
      "function joinContest(uint256 contestId, uint256[11] playerIds, uint256 captainId, uint256 viceCaptainId, uint256 totalCredits) external",
    ]);
    const calldata = fantasyIface.encodeFunctionData("joinContest", [
      decision.contestId,
      decision.playerIds,
      decision.captainId,
      decision.viceCaptainId,
      decision.totalCredits,
    ]);

    const result = await executeAction(
      contracts,
      agentId,
      addresses.fantasyModule,
      "JOIN_CONTEST",
      calldata
    );

    const agentState2 = activeAgents.get(agentId);
    if (agentState2 && result.gasUsed) {
      agentState2.totalGasUsed += BigInt(result.gasUsed);
      agentState2.totalCycles++;
    }

    if (result.success) {
      addLog(agentId, {
        type: "success",
        action: "JOIN_CONTEST",
        outcome: `Squad submitted to contest #${decision.contestId}! ${mi.team1} vs ${mi.team2}. TX: ${result.txHash}${result.gasUsed ? ` | Gas: ${result.gasUsed}` : ''}`,
        reasoning: decision.reasoning,
      });
    } else {
      const friendlyReason2 = result.reason
        ? result.reason.replace(/execution reverted:?\s*/i, '')
        : 'Contest may be full, locked, or already joined';
      addLog(agentId, {
        type: result.type === "violation" ? "violation" : "error",
        action: result.type === "violation" ? "POLICY" : "JOIN_CONTEST",
        outcome: `${result.type === 'violation' ? 'Policy engine blocked this action' : 'Squad submission failed'}: ${friendlyReason2}`,
        reasoning: result.type === 'violation'
          ? 'The on-chain PolicyEngine enforced a spending or action limit. This is expected behavior.'
          : 'I\'ll try a different contest next cycle, or wait for new contests to open.',
        txHash: result.txHash,
      });
    }

    break; // One contest per cycle
  }
}

// ─── Agent Lifecycle ─────────────────────────────────────────────────────────

/**
 * Run one cycle of an agent's strategy.
 */
async function runCycle(contracts, addresses, agentId, config, db) {
  // Prevent concurrent cycles for the same agent
  const agentState = activeAgents.get(agentId);
  if (agentState?.isRunning) {
    addLog(agentId, { type: "warning", action: "CYCLE", outcome: "Previous cycle still running, skipping." });
    return;
  }
  if (agentState) agentState.isRunning = true;

  const botType = config.botType || "PREDICTION";

  try {
    // Check agent is still active
    const agent = await contracts.agentRegistry.getAgent(agentId);
    if (!agent.active) {
      addLog(agentId, { type: "warning", action: "CHECK", outcome: "My on-chain registration is inactive. I can't execute actions in this state. Stopping." });
      stopAgent(agentId);
      return;
    }

    // Check reputation
    const score = await contracts.reputationStore.getScore(agentId);
    const currentScore = Number(score);

    const agentState = activeAgents.get(agentId);
    const cycleNum = (agentState?.totalCycles || 0) + 1;

    addLog(agentId, {
      type: "info",
      action: "CYCLE",
      outcome: `--- Cycle #${cycleNum} --- Reputation: ${currentScore}/100 | Mode: ${botType} | Analyzing...`,
    });

    if (currentScore < 10) {
      addLog(agentId, {
        type: "warning",
        action: "PAUSE",
        outcome: `My reputation score is critically low (${currentScore}/100). If I keep acting, I risk getting permanently flagged. Pausing to protect my standing.`,
      });
      return;
    }

    // Run strategies based on bot type
    if (botType === "PREDICTION" || botType === "MULTI") {
      await runPredictionStrategy(contracts, addresses, agentId, config, db);
    }
    if (botType === "FANTASY" || botType === "MULTI") {
      await runFantasyStrategy(contracts, addresses, agentId, config, db);
    }
  } catch (err) {
    addLog(agentId, { type: "error", action: "CYCLE", outcome: `Unexpected error in cycle: ${err.message}. I'll recover and retry next cycle.` });
  } finally {
    const state = activeAgents.get(agentId);
    if (state) state.isRunning = false;
  }
}

/**
 * Start autonomous execution for an agent.
 * @param {Object} contracts — on-chain contract instances
 * @param {Object} addresses — deployed contract addresses
 * @param {string|number} agentId — on-chain agent ID
 * @param {Object} config — { botType, intervalSeconds, maxActionsPerCycle, predictionTypes }
 * @param {Object} db — database query interface (from backend/db)
 */
function startAgent(contracts, addresses, agentId, config = {}, db = null) {
  if (activeAgents.has(agentId)) {
    return { success: false, reason: "Agent already running" };
  }

  if (!db) {
    return { success: false, reason: "Database not available — cannot start agent" };
  }

  // Enforce max concurrent agents to prevent memory exhaustion
  if (activeAgents.size >= MAX_AGENTS) {
    return { success: false, reason: `Max concurrent agents (${MAX_AGENTS}) reached` };
  }

  const intervalMs = (config.intervalSeconds || 60) * 1000;

  addLog(agentId, {
    type: "info",
    action: "START",
    outcome: `Autonomous mode activated. I'm now running as a ${config.botType || "PREDICTION"} agent, analyzing every ${config.intervalSeconds || 60}s.`,
    reasoning: "I'll run 6-factor analysis (ELO + EWMA + H2H + Momentum + Venue + Role-Weighted) from the database, query the on-chain oracle for matches, then execute predictions or squad entries through the policy-enforced ExecutionGateway.",
  });

  // Run first cycle immediately
  runCycle(contracts, addresses, agentId, config, db).catch((err) =>
    addLog(agentId, { type: "error", action: "CYCLE", outcome: err.message })
  );

  // Schedule recurring cycles
  const interval = setInterval(() => {
    runCycle(contracts, addresses, agentId, config, db).catch((err) =>
      addLog(agentId, { type: "error", action: "CYCLE", outcome: err.message })
    );
  }, intervalMs);

  activeAgents.set(agentId, { interval, config, db, startedAt: new Date().toISOString(), totalGasUsed: 0n, totalCycles: 0, isRunning: false });

  // Persist to DB for auto-resume on server restart
  if (db) {
    db.query(
      `INSERT INTO active_agents (agent_id, config) VALUES ($1, $2)
       ON CONFLICT (agent_id) DO UPDATE SET config = $2, started_at = NOW()`,
      [agentId, JSON.stringify(config)]
    ).catch((err) => console.warn(`[agentRunner] Failed to persist agent ${agentId}:`, err.message));
  }

  return { success: true, message: `Agent #${agentId} started in autonomous mode` };
}

/**
 * Stop autonomous execution for an agent.
 */
function stopAgent(agentId) {
  const entry = activeAgents.get(agentId);
  if (!entry) return { success: false, reason: "Agent not running" };

  clearInterval(entry.interval);

  // Remove from DB persistence
  if (entry.db) {
    entry.db.query('DELETE FROM active_agents WHERE agent_id = $1', [agentId])
      .catch((err) => console.warn(`[agentRunner] Failed to remove agent ${agentId} from DB:`, err.message));
  }

  activeAgents.delete(agentId);

  addLog(agentId, {
    type: "info",
    action: "STOP",
    outcome: "Autonomous mode deactivated.",
  });

  // Clean up agentLogs for stopped agents after a delay to prevent memory leak
  setTimeout(() => {
    if (!activeAgents.has(agentId)) agentLogs.delete(agentId);
  }, 10 * 60 * 1000); // 10 minutes

  // If total tracked agents in agentLogs exceeds limit, prune oldest inactive
  if (agentLogs.size > MAX_LOG_AGENTS) {
    for (const [id] of agentLogs) {
      if (!activeAgents.has(id)) { agentLogs.delete(id); break; }
    }
  }

  return { success: true, message: `Agent #${agentId} stopped` };
}

/**
 * Get the current status of an agent.
 */
async function getAgentStatus(agentId, db = null) {
  const entry = activeAgents.get(agentId);
  const queryDb = entry?.db || db;
  let insights = null;

  // Load persisted logs from DB if no in-memory logs
  if (queryDb && (!agentLogs.has(agentId) || agentLogs.get(agentId).length === 0)) {
    try {
      const { rows } = await queryDb.query(
        `SELECT type, action, outcome, reasoning, tx_hash AS "txHash", gas_used AS "gasUsed", created_at AS timestamp
         FROM agent_runs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [agentId]
      );
      if (rows.length > 0) {
        agentLogs.set(agentId, rows.map(r => ({
          type: r.type, action: r.action, outcome: r.outcome,
          reasoning: r.reasoning, txHash: r.txHash, gasUsed: r.gasUsed,
          timestamp: new Date(r.timestamp).toISOString(),
        })));
      }
    } catch {}
  }

  // Fetch cricket intelligence insights from DB
  if (queryDb) {
    try {
      const { rows: topPlayers } = await queryDb.query(
        `SELECT name, role, team, recent_form, batting_avg, total_wickets, matches_played
         FROM players WHERE active = true AND matches_played > 0
         ORDER BY recent_form DESC LIMIT 6`
      );
      const { rows: teamStats } = await queryDb.query(
        `SELECT team,
           COUNT(*) FILTER (WHERE result = team) AS wins,
           COUNT(*) AS total
         FROM (
           SELECT team1 AS team, result FROM matches WHERE status = 'COMPLETED'
           UNION ALL
           SELECT team2 AS team, result FROM matches WHERE status = 'COMPLETED'
         ) sub GROUP BY team ORDER BY COUNT(*) FILTER (WHERE result = team) DESC`
      );
      // Get ELO ratings
      let eloRankings = [];
      try {
        const { calculateTeamElos } = require("./cricketIntelligence");
        const elos = await calculateTeamElos(queryDb);
        eloRankings = Object.entries(elos)
          .sort((a, b) => b[1] - a[1])
          .map(([team, elo]) => ({ team, elo }));
      } catch {}

      // Venue intelligence
      let venueStats = [];
      try {
        const { rows: vs } = await queryDb.query(
          `SELECT m.venue, COUNT(DISTINCT m.match_id) as matches,
             ROUND(AVG(sub.total_runs)) as avg_runs
           FROM matches m
           JOIN (SELECT match_id, SUM(runs) as total_runs FROM player_match_stats GROUP BY match_id) sub
             ON sub.match_id = m.match_id
           WHERE m.status = 'COMPLETED' AND m.venue IS NOT NULL
           GROUP BY m.venue ORDER BY COUNT(DISTINCT m.match_id) DESC LIMIT 6`
        );
        venueStats = vs.map(v => ({
          venue: v.venue, matches: Number(v.matches), avgRuns: Number(v.avg_runs || 0),
          type: Number(v.avg_runs) > 165 ? 'batting-friendly' : Number(v.avg_runs) < 145 ? 'bowling-friendly' : 'balanced',
        }));
      } catch {}

      // Top H2H rivalries
      let topH2H = [];
      try {
        const { rows: h2h } = await queryDb.query(
          `SELECT LEAST(team1, team2) as t1, GREATEST(team1, team2) as t2,
             COUNT(*) as meetings,
             COUNT(*) FILTER (WHERE result = LEAST(team1, team2)) as t1_wins
           FROM matches WHERE status = 'COMPLETED' AND result IS NOT NULL
           GROUP BY LEAST(team1, team2), GREATEST(team1, team2)
           ORDER BY COUNT(*) DESC LIMIT 6`
        );
        topH2H = h2h.map(r => ({
          team1: r.t1, team2: r.t2, meetings: Number(r.meetings),
          team1Wins: Number(r.t1_wins), team2Wins: Number(r.meetings) - Number(r.t1_wins),
        }));
      } catch {}

      insights = {
        topFormPlayers: topPlayers.map(p => ({
          name: p.name, role: p.role, team: p.team,
          avgFP: Number(p.recent_form || 0).toFixed(1),
          battingAvg: Number(p.batting_avg || 0).toFixed(1),
          wickets: Number(p.total_wickets || 0),
          matches: Number(p.matches_played || 0),
        })),
        teamStats: teamStats.map(t => ({
          team: t.team, wins: Number(t.wins), total: Number(t.total),
          winRate: t.total > 0 ? Math.round((t.wins / t.total) * 100) : 0,
        })),
        eloRankings,
        venueStats,
        topH2H,
      };
    } catch {}
  }

  return {
    running: !!entry,
    config: entry?.config || null,
    startedAt: entry?.startedAt || null,
    totalGasUsed: entry?.totalGasUsed?.toString() || "0",
    totalCycles: entry?.totalCycles || 0,
    insights,
    logs: (agentLogs.get(agentId) || []).slice(0, 50),
  };
}

/**
 * Get logs for an agent.
 */
function getAgentLogs(agentId, limit = 50) {
  return (agentLogs.get(agentId) || []).slice(0, limit);
}

/**
 * List all running agents.
 */
function listRunning() {
  const result = [];
  for (const [agentId, entry] of activeAgents) {
    result.push({
      agentId: Number(agentId),
      config: entry.config,
      startedAt: entry.startedAt,
    });
  }
  return result;
}

/**
 * Resume previously running agents from DB on server restart.
 */
async function resumeAgents(contracts, addresses, db) {
  if (!db) return;
  try {
    const { rows } = await db.query('SELECT agent_id, config FROM active_agents');
    for (const row of rows) {
      try {
        const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
        startAgent(contracts, addresses, row.agent_id, config, db);
        console.log(`[agentRunner] Resumed agent #${row.agent_id}`);
      } catch (err) {
        console.warn(`[agentRunner] Failed to resume agent #${row.agent_id}:`, err.message);
      }
    }
    if (rows.length > 0) console.log(`[agentRunner] Resumed ${rows.length} agent(s) from DB`);
  } catch (err) {
    // Table may not exist yet — that's fine
    if (!err.message.includes('does not exist')) {
      console.warn('[agentRunner] resumeAgents failed:', err.message);
    }
  }
}

module.exports = {
  startAgent,
  stopAgent,
  getAgentStatus,
  getAgentLogs,
  listRunning,
  resumeAgents,
};
