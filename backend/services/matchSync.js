/**
 * Match Sync Service — Cron-based auto-sync from Sportmonks Cricket API.
 *
 * Jobs:
 *   1. syncSchedule()     — daily: fetch PSL fixtures → upsert DB matches + players
 *   2. checkLiveMatches()  — every 5 min: update live_match_state, detect completions
 *   3. autoSettle(matchId) — triggered on completion: oracle → resolve → finalize
 */

const cricApi = require("./cricApi");

let db = null;
let contracts = null;
let addresses = null;

/**
 * Initialize with app dependencies.
 */
function init(appDb, appContracts, appAddresses) {
  db = appDb;
  contracts = appContracts;
  addresses = appAddresses;
}

// ─── PSL League Discovery ───────────────────────────────────────────────────

/**
 * Get the league ID to sync from Sportmonks.
 *
 * Free tier available leagues: T20I (3), BBL (5), CSA T20 (10).
 * PSL requires paid plan — when upgraded, set SPORTMONKS_LEAGUE_ID in .env.
 * PSL matches can be managed manually via the admin panel in the meantime.
 */
async function getLeagueId() {
  // Check env override first (set this when PSL is available on your plan)
  if (process.env.SPORTMONKS_LEAGUE_ID) {
    return Number(process.env.SPORTMONKS_LEAGUE_ID);
  }

  // Try PSL first (paid plans)
  const psl = await cricApi.findLeague("Pakistan Super League");
  if (psl?.id) {
    console.log(`  Found PSL league: id=${psl.id}, name=${psl.name}`);
    return psl.id;
  }

  // PSL only — do not fall back to international leagues
  console.log("  PSL not found on current Sportmonks plan — sync will use manually seeded data only");
  return null;
}

// ─── Schedule Sync ──────────────────────────────────────────────────────────

/**
 * Sync PSL match schedule from Sportmonks → DB.
 * Runs daily at midnight (or on startup).
 */
async function syncSchedule() {
  if (!db) {
    console.warn("matchSync: DB not initialized, skipping sync");
    return;
  }

  console.log("[matchSync] Syncing match schedule from Sportmonks...");

  try {
    // PSL 2026 data is manually seeded — skip Sportmonks sync to avoid pulling in
    // international fixtures that pollute the DB. Re-enable when Sportmonks plan
    // reliably filters by PSL league ID only.
    console.log("[matchSync] Using manually seeded PSL data — Sportmonks sync disabled");
    return;

    // Fetch fixtures from Sportmonks
    const filters = { league_id: leagueId };

    // Get upcoming + recent matches (last 30 days to next 30 days)
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const to = new Date(now);
    to.setDate(to.getDate() + 30);
    filters.starts_between = `${from.toISOString().split("T")[0]},${to.toISOString().split("T")[0]}`;
    filters.include = "localteam,visitorteam,venue";

    const fixtures = await cricApi.getFixtures(filters);

    if (!fixtures || fixtures.length === 0) {
      console.log("[matchSync] No fixtures found from Sportmonks");
      return;
    }

    console.log(`[matchSync] Got ${fixtures.length} fixtures from Sportmonks`);

    let synced = 0;
    for (const fixture of fixtures) {
      try {
        const teams = cricApi.extractTeams(fixture);
        const status = cricApi.mapMatchStatus(fixture.status);
        const venue = fixture.venue?.name || null;
        const startTime = fixture.starting_at || fixture.started_at || null;
        const winner = cricApi.extractWinner(fixture);

        // Use Sportmonks fixture ID as match_id (or map to our sequence)
        const matchId = fixture.id;

        await db.query(
          `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status, result)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (match_id) DO UPDATE SET
             team1 = $3, team2 = $4, venue = $5, start_time = $6, status = $7, result = COALESCE($8, matches.result)`,
          [matchId, 1, teams.team1, teams.team2, venue, startTime, status, winner]
        );
        synced++;
      } catch (err) {
        console.error(`[matchSync] Failed to sync fixture ${fixture.id}:`, err.message);
      }
    }

    console.log(`[matchSync] Synced ${synced}/${fixtures.length} matches to DB`);

    // Sync squads for upcoming matches
    await syncSquads(fixtures.filter((f) => cricApi.mapMatchStatus(f.status) !== "COMPLETED"));
  } catch (err) {
    console.error("[matchSync] Schedule sync failed:", err.message);
  }
}

/**
 * Sync player squads from Sportmonks for given fixtures.
 */
async function syncSquads(fixtures) {
  if (!fixtures || fixtures.length === 0) return;

  const seenTeams = new Set();
  let playersSynced = 0;

  for (const fixture of fixtures) {
    const teamIds = [fixture.localteam_id, fixture.visitorteam_id].filter(Boolean);
    const seasonId = fixture.season_id;

    for (const teamId of teamIds) {
      const teamKey = `${teamId}-${seasonId}`;
      if (seenTeams.has(teamKey) || !seasonId) continue;
      seenTeams.add(teamKey);

      try {
        const squad = await cricApi.getSquad(teamId, seasonId);
        if (!squad || squad.length === 0) continue;

        const teamName =
          (teamId === fixture.localteam_id ? fixture.localteam?.name : fixture.visitorteam?.name) ||
          `Team ${teamId}`;

        for (let i = 0; i < squad.length; i++) {
          const p = squad[i];
          const player = p.player || p;
          const playerId = player.id;
          if (!playerId) continue;

          const name = [player.firstname, player.lastname].filter(Boolean).join(" ") || player.fullname || `Player ${playerId}`;
          const role = cricApi.mapRole(player.position?.name || player.position);
          const credits = cricApi.assignCredits(player.position?.name || player.position, i);

          await db.query(
            `INSERT INTO players (player_id, name, team, role, credits)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (player_id) DO UPDATE SET
               name = $2, team = $3, role = $4, credits = $5`,
            [playerId, name, teamName, role, credits]
          );
          playersSynced++;

          // Link to match
          await db.query(
            `INSERT INTO match_players (match_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [fixture.id, playerId]
          );
        }
      } catch (err) {
        console.error(`[matchSync] Failed to sync squad for team ${teamId}:`, err.message);
      }
    }
  }

  if (playersSynced > 0) {
    console.log(`[matchSync] Synced ${playersSynced} players across ${seenTeams.size} team-seasons`);
  }
}

// ─── Live Match Checking ────────────────────────────────────────────────────

/**
 * Check for live/recently completed matches.
 * Runs every 5 minutes during match hours.
 */
async function checkLiveMatches() {
  if (!db) return;

  try {
    // Check DB for matches that should be live now
    const { rows: liveDbMatches } = await db.query(
      `SELECT match_id, team1, team2, status FROM matches
       WHERE status IN ('UPCOMING', 'LIVE')
       AND start_time IS NOT NULL
       AND start_time <= NOW() + INTERVAL '30 minutes'
       ORDER BY start_time ASC`
    );

    if (liveDbMatches.length === 0) return;

    // Also check Sportmonks livescores
    const livescores = await cricApi.getLivescores();

    for (const dbMatch of liveDbMatches) {
      // Find matching Sportmonks fixture
      const smFixture = livescores?.find((f) => f.id === dbMatch.match_id);

      if (smFixture) {
        const newStatus = cricApi.mapMatchStatus(smFixture.status);

        // Update live match state
        const scoreboards = smFixture.scoreboards || [];
        const innings1 = scoreboards.find((s) => s.type === "total" && s.scoreboard === "S1");
        const innings2 = scoreboards.find((s) => s.type === "total" && s.scoreboard === "S2");

        const currentInnings = innings2 ? 2 : 1;
        const currentScore = currentInnings === 2
          ? `${innings2?.total || 0}/${innings2?.wickets || 0}`
          : `${innings1?.total || 0}/${innings1?.wickets || 0}`;
        const currentOvers = currentInnings === 2
          ? String(innings2?.overs || "0.0")
          : String(innings1?.overs || "0.0");

        await db.query(
          `INSERT INTO live_match_state (match_id, team1, team2, innings, overs, score, batting, bowling, run_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (match_id) DO UPDATE SET
             innings = $4, overs = $5, score = $6, batting = $7, bowling = $8, run_rate = $9, updated_at = NOW()`,
          [
            dbMatch.match_id, dbMatch.team1, dbMatch.team2,
            currentInnings, currentOvers, currentScore,
            currentInnings === 1 ? dbMatch.team1 : dbMatch.team2,
            currentInnings === 1 ? dbMatch.team2 : dbMatch.team1,
            String(innings1?.rate || innings2?.rate || "0.00"),
          ]
        );

        // Update match status in DB
        if (newStatus !== dbMatch.status) {
          await db.query(
            "UPDATE matches SET status = $1 WHERE match_id = $2",
            [newStatus, dbMatch.match_id]
          );

          if (newStatus === "COMPLETED" || newStatus === "ABANDONED") {
            console.log(`[matchSync] Match ${dbMatch.match_id} (${dbMatch.team1} vs ${dbMatch.team2}) → ${newStatus}`);
            // Fetch full scorecard and auto-settle
            await onMatchCompleted(dbMatch.match_id, smFixture);
          }
        }
      } else if (dbMatch.status === "UPCOMING") {
        // Not found in livescores — check via fixture detail
        try {
          const detail = await cricApi.getFixtureById(dbMatch.match_id);
          if (detail) {
            const detailStatus = cricApi.mapMatchStatus(detail.status);
            if (detailStatus !== dbMatch.status) {
              await db.query("UPDATE matches SET status = $1 WHERE match_id = $2", [detailStatus, dbMatch.match_id]);
              if (detailStatus === "COMPLETED" || detailStatus === "ABANDONED") {
                await onMatchCompleted(dbMatch.match_id, detail);
              }
            }
          }
        } catch (err) {
          console.warn(`[matchSync] Fixture detail check failed for match ${dbMatch.match_id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[matchSync] Live check failed:", err.message);
  }
}

// ─── Match Completion + Auto-Settlement ─────────────────────────────────────

/**
 * Called when a match completes. Fetches scorecard, updates player fantasy points,
 * and triggers on-chain settlement if AUTO_SETTLE is enabled.
 */
async function onMatchCompleted(matchId, fixture) {
  console.log(`[matchSync] Processing completed match ${matchId}...`);

  try {
    // Fetch full scorecard if not already included
    let detail = fixture;
    if (!fixture.batting || fixture.batting.length === 0) {
      detail = await cricApi.getFixtureById(matchId);
    }

    if (!detail) {
      console.error(`[matchSync] Could not fetch scorecard for match ${matchId}`);
      return;
    }

    // Update match result in DB
    const winner = cricApi.extractWinner(detail);
    const abandoned = cricApi.mapMatchStatus(detail.status) === "ABANDONED";
    await db.query(
      "UPDATE matches SET status = $1, result = $2 WHERE match_id = $3",
      [abandoned ? "ABANDONED" : "COMPLETED", winner || "NO_RESULT", matchId]
    );

    // Calculate fantasy points from scorecard
    const battingData = detail.batting || [];
    const bowlingData = detail.bowling || [];

    const playerPoints = new Map();

    for (const bat of battingData) {
      const pid = bat.player_id;
      if (!pid) continue;
      const current = playerPoints.get(pid) || { batting: {}, bowling: {} };
      current.batting = bat;
      playerPoints.set(pid, current);
    }

    for (const bowl of bowlingData) {
      const pid = bowl.player_id;
      if (!pid) continue;
      const current = playerPoints.get(pid) || { batting: {}, bowling: {} };
      current.bowling = bowl;
      playerPoints.set(pid, current);
    }

    // Update match_players with fantasy points
    for (const [pid, data] of playerPoints) {
      const pts = cricApi.calculateFantasyPoints(data.batting, data.bowling);
      await db.query(
        `UPDATE match_players SET fantasy_points = $1 WHERE match_id = $2 AND player_id = $3`,
        [pts, matchId, pid]
      ).catch((err) => console.warn(`[matchSync] Player points update failed for pid=${pid}:`, err.message));
    }

    console.log(`[matchSync] Updated fantasy points for ${playerPoints.size} players in match ${matchId}`);

    // Auto-settle on-chain if enabled
    if (process.env.AUTO_SETTLE === "true" && contracts) {
      await autoSettle(matchId, winner, abandoned, playerPoints);
    }
  } catch (err) {
    console.error(`[matchSync] onMatchCompleted error for ${matchId}:`, err.message);
  }
}

/**
 * Auto-settle a match on-chain:
 *   1. Submit result to MatchOracle
 *   2. Resolve predictions
 *   3. Update fantasy scores + finalize contest
 */
async function autoSettle(matchId, winner, abandoned, playerPoints) {
  if (!contracts) {
    console.warn("[matchSync] No contracts available for auto-settlement");
    return;
  }

  const { ethers } = require("ethers");
  const steps = [];

  // Step 1: Submit result to oracle
  try {
    const tx = await contracts.matchOracle.submitResult(matchId, winner || "NO_RESULT", abandoned || false);
    await tx.wait();
    steps.push("oracle_result:OK");
  } catch (err) {
    steps.push(`oracle_result:FAIL(${err.message.slice(0, 50)})`);
  }

  // Step 2: Resolve predictions
  if (abandoned) {
    try {
      const tx = await contracts.predictionModule.cancelMatchPredictions(matchId);
      await tx.wait();
      steps.push("cancel_predictions:OK");
    } catch (err) {
      steps.push(`cancel_predictions:FAIL(${err.message.slice(0, 50)})`);
    }
  } else if (winner) {
    try {
      const winnerOutcome = winner.toUpperCase().replace(/\s+/g, "_") + "_WIN";
      const typeBytes = ethers.encodeBytes32String("MATCH_WINNER");
      const outcomeBytes = ethers.encodeBytes32String(winnerOutcome);
      const tx = await contracts.predictionModule.resolveAllMatchPredictions(matchId, typeBytes, outcomeBytes);
      await tx.wait();
      steps.push("resolve_predictions:OK");
    } catch (err) {
      steps.push(`resolve_predictions:FAIL(${err.message.slice(0, 50)})`);
    }
  }

  // Step 3: Fantasy contest settlement
  try {
    const contest = await contracts.fantasyModule.contests(matchId);
    if (contest && contest.active && !contest.finalized) {
      // Update player scores
      for (const [pid, data] of playerPoints) {
        const pts = cricApi.calculateFantasyPoints(data.batting, data.bowling);
        try {
          const tx = await contracts.fantasyModule.updatePlayerScore(matchId, pid, pts);
          await tx.wait();
        } catch (err) {
          console.warn(`[matchSync] updatePlayerScore failed for pid=${pid}:`, err.message);
        }
      }

      // Lock + Finalize
      try {
        const lockTx = await contracts.fantasyModule.lockContest(matchId);
        await lockTx.wait();
      } catch (err) {
        console.warn(`[matchSync] lockContest failed for match ${matchId}:`, err.message);
      }

      try {
        const finTx = await contracts.fantasyModule.finalizeContest(matchId);
        await finTx.wait();
        steps.push("finalize_contest:OK");
      } catch (err) {
        steps.push(`finalize_contest:FAIL(${err.message.slice(0, 50)})`);
      }
    } else {
      steps.push("contest:NONE_OR_ALREADY_FINALIZED");
    }
  } catch (err) {
    steps.push(`contest:FAIL(${err.message.slice(0, 50)})`);
  }

  console.log(`[matchSync] Auto-settlement for match ${matchId}: ${steps.join(" | ")}`);
}

// ─── Cron Management ────────────────────────────────────────────────────────

let scheduleSyncInterval = null;
let liveCheckInterval = null;

/**
 * Start cron jobs.
 */
function startCrons() {
  console.log("[matchSync] Starting cron jobs...");

  // Run schedule sync immediately on startup
  syncSchedule().catch((err) => console.error("[matchSync] Initial sync failed:", err.message));

  // Schedule sync every 24 hours
  scheduleSyncInterval = setInterval(() => {
    syncSchedule().catch((err) => console.error("[matchSync] Scheduled sync failed:", err.message));
  }, 24 * 60 * 60 * 1000);

  // Check live matches every 5 minutes
  liveCheckInterval = setInterval(() => {
    checkLiveMatches().catch((err) => console.error("[matchSync] Live check failed:", err.message));
  }, 5 * 60 * 1000);

  console.log("[matchSync] Crons started: schedule sync (24h), live check (5m)");
}

/**
 * Stop cron jobs (for graceful shutdown).
 */
function stopCrons() {
  if (scheduleSyncInterval) clearInterval(scheduleSyncInterval);
  if (liveCheckInterval) clearInterval(liveCheckInterval);
  console.log("[matchSync] Crons stopped");
}

module.exports = {
  init,
  syncSchedule,
  checkLiveMatches,
  autoSettle,
  startCrons,
  stopCrons,
};
