/**
 * Seed FULL PSL data — 2024, 2025 historical + 2026 complete schedule.
 *
 * Historical seasons provide ELO training data (team win/loss records).
 * Per-match player stats across all seasons feed the EWMA engine.
 *
 * Usage: node db/seedPSLFull.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { pool, testConnection } = require("./index");

// ─── PSL Teams (8 franchises) ───────────────────────────────────────────────

const TEAMS = [
  "Rawalpindi Pindiz",
  "Peshawar Zalmi",
  "Karachi Kings",
  "Lahore Qalandars",
  "Islamabad United",
  "Multan Sultans",
  "Quetta Gladiators",
  "Hyderabad Kingsmen",
];

// ─── Helper: random int in range ────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── PSL 2024 Season (Historical — 34 matches) ─────────────────────────────
// Real-ish results based on actual PSL 9 (2024) standings
// Islamabad United won, Multan Sultans runner-up
const PSL_2024 = [
  // Group stage (30 matches) — each team plays ~7-8 matches
  { id: 100, t1: "Islamabad United", t2: "Quetta Gladiators", winner: "Islamabad United", date: "2024-02-17" },
  { id: 101, t1: "Multan Sultans", t2: "Lahore Qalandars", winner: "Multan Sultans", date: "2024-02-18" },
  { id: 102, t1: "Peshawar Zalmi", t2: "Karachi Kings", winner: "Peshawar Zalmi", date: "2024-02-19" },
  { id: 103, t1: "Rawalpindi Pindiz", t2: "Hyderabad Kingsmen", winner: "Rawalpindi Pindiz", date: "2024-02-20" },
  { id: 104, t1: "Islamabad United", t2: "Peshawar Zalmi", winner: "Islamabad United", date: "2024-02-21" },
  { id: 105, t1: "Lahore Qalandars", t2: "Karachi Kings", winner: "Lahore Qalandars", date: "2024-02-22" },
  { id: 106, t1: "Multan Sultans", t2: "Quetta Gladiators", winner: "Multan Sultans", date: "2024-02-23" },
  { id: 107, t1: "Rawalpindi Pindiz", t2: "Islamabad United", winner: "Islamabad United", date: "2024-02-24" },
  { id: 108, t1: "Karachi Kings", t2: "Hyderabad Kingsmen", winner: "Karachi Kings", date: "2024-02-25" },
  { id: 109, t1: "Peshawar Zalmi", t2: "Lahore Qalandars", winner: "Peshawar Zalmi", date: "2024-02-26" },
  { id: 110, t1: "Quetta Gladiators", t2: "Rawalpindi Pindiz", winner: "Rawalpindi Pindiz", date: "2024-02-27" },
  { id: 111, t1: "Islamabad United", t2: "Multan Sultans", winner: "Multan Sultans", date: "2024-02-28" },
  { id: 112, t1: "Lahore Qalandars", t2: "Hyderabad Kingsmen", winner: "Lahore Qalandars", date: "2024-03-01" },
  { id: 113, t1: "Karachi Kings", t2: "Quetta Gladiators", winner: "Quetta Gladiators", date: "2024-03-02" },
  { id: 114, t1: "Peshawar Zalmi", t2: "Rawalpindi Pindiz", winner: "Peshawar Zalmi", date: "2024-03-03" },
  { id: 115, t1: "Multan Sultans", t2: "Karachi Kings", winner: "Multan Sultans", date: "2024-03-04" },
  { id: 116, t1: "Islamabad United", t2: "Lahore Qalandars", winner: "Islamabad United", date: "2024-03-05" },
  { id: 117, t1: "Hyderabad Kingsmen", t2: "Peshawar Zalmi", winner: "Peshawar Zalmi", date: "2024-03-06" },
  { id: 118, t1: "Quetta Gladiators", t2: "Multan Sultans", winner: "Quetta Gladiators", date: "2024-03-07" },
  { id: 119, t1: "Rawalpindi Pindiz", t2: "Lahore Qalandars", winner: "Rawalpindi Pindiz", date: "2024-03-08" },
  { id: 120, t1: "Karachi Kings", t2: "Islamabad United", winner: "Islamabad United", date: "2024-03-09" },
  { id: 121, t1: "Hyderabad Kingsmen", t2: "Multan Sultans", winner: "Multan Sultans", date: "2024-03-10" },
  { id: 122, t1: "Peshawar Zalmi", t2: "Quetta Gladiators", winner: "Peshawar Zalmi", date: "2024-03-11" },
  { id: 123, t1: "Lahore Qalandars", t2: "Rawalpindi Pindiz", winner: "Lahore Qalandars", date: "2024-03-12" },
  { id: 124, t1: "Islamabad United", t2: "Hyderabad Kingsmen", winner: "Islamabad United", date: "2024-03-13" },
  { id: 125, t1: "Multan Sultans", t2: "Peshawar Zalmi", winner: "Multan Sultans", date: "2024-03-14" },
  { id: 126, t1: "Quetta Gladiators", t2: "Lahore Qalandars", winner: "Quetta Gladiators", date: "2024-03-15" },
  { id: 127, t1: "Karachi Kings", t2: "Rawalpindi Pindiz", winner: "Karachi Kings", date: "2024-03-16" },
  { id: 128, t1: "Hyderabad Kingsmen", t2: "Quetta Gladiators", winner: "Hyderabad Kingsmen", date: "2024-03-17" },
  { id: 129, t1: "Multan Sultans", t2: "Rawalpindi Pindiz", winner: "Rawalpindi Pindiz", date: "2024-03-18" },
  // Playoffs
  { id: 130, t1: "Islamabad United", t2: "Multan Sultans", winner: "Islamabad United", date: "2024-03-20" },
  { id: 131, t1: "Peshawar Zalmi", t2: "Rawalpindi Pindiz", winner: "Peshawar Zalmi", date: "2024-03-21" },
  { id: 132, t1: "Multan Sultans", t2: "Peshawar Zalmi", winner: "Multan Sultans", date: "2024-03-22" },
  // Final
  { id: 133, t1: "Islamabad United", t2: "Multan Sultans", winner: "Islamabad United", date: "2024-03-24" },
];

// ─── PSL 2025 Season (Historical — 34 matches) ─────────────────────────────
// Lahore Qalandars won, Peshawar Zalmi runner-up
const PSL_2025 = [
  { id: 200, t1: "Lahore Qalandars", t2: "Islamabad United", winner: "Lahore Qalandars", date: "2025-02-15" },
  { id: 201, t1: "Peshawar Zalmi", t2: "Multan Sultans", winner: "Peshawar Zalmi", date: "2025-02-16" },
  { id: 202, t1: "Quetta Gladiators", t2: "Karachi Kings", winner: "Karachi Kings", date: "2025-02-17" },
  { id: 203, t1: "Rawalpindi Pindiz", t2: "Hyderabad Kingsmen", winner: "Rawalpindi Pindiz", date: "2025-02-18" },
  { id: 204, t1: "Lahore Qalandars", t2: "Peshawar Zalmi", winner: "Lahore Qalandars", date: "2025-02-19" },
  { id: 205, t1: "Islamabad United", t2: "Karachi Kings", winner: "Islamabad United", date: "2025-02-20" },
  { id: 206, t1: "Multan Sultans", t2: "Rawalpindi Pindiz", winner: "Multan Sultans", date: "2025-02-21" },
  { id: 207, t1: "Quetta Gladiators", t2: "Peshawar Zalmi", winner: "Peshawar Zalmi", date: "2025-02-22" },
  { id: 208, t1: "Hyderabad Kingsmen", t2: "Lahore Qalandars", winner: "Lahore Qalandars", date: "2025-02-23" },
  { id: 209, t1: "Karachi Kings", t2: "Rawalpindi Pindiz", winner: "Rawalpindi Pindiz", date: "2025-02-24" },
  { id: 210, t1: "Islamabad United", t2: "Multan Sultans", winner: "Islamabad United", date: "2025-02-25" },
  { id: 211, t1: "Peshawar Zalmi", t2: "Hyderabad Kingsmen", winner: "Peshawar Zalmi", date: "2025-02-26" },
  { id: 212, t1: "Lahore Qalandars", t2: "Quetta Gladiators", winner: "Lahore Qalandars", date: "2025-02-27" },
  { id: 213, t1: "Multan Sultans", t2: "Karachi Kings", winner: "Karachi Kings", date: "2025-02-28" },
  { id: 214, t1: "Rawalpindi Pindiz", t2: "Islamabad United", winner: "Rawalpindi Pindiz", date: "2025-03-01" },
  { id: 215, t1: "Hyderabad Kingsmen", t2: "Quetta Gladiators", winner: "Quetta Gladiators", date: "2025-03-02" },
  { id: 216, t1: "Peshawar Zalmi", t2: "Lahore Qalandars", winner: "Peshawar Zalmi", date: "2025-03-03" },
  { id: 217, t1: "Karachi Kings", t2: "Islamabad United", winner: "Karachi Kings", date: "2025-03-04" },
  { id: 218, t1: "Multan Sultans", t2: "Hyderabad Kingsmen", winner: "Multan Sultans", date: "2025-03-05" },
  { id: 219, t1: "Quetta Gladiators", t2: "Rawalpindi Pindiz", winner: "Rawalpindi Pindiz", date: "2025-03-06" },
  { id: 220, t1: "Lahore Qalandars", t2: "Karachi Kings", winner: "Lahore Qalandars", date: "2025-03-07" },
  { id: 221, t1: "Islamabad United", t2: "Peshawar Zalmi", winner: "Peshawar Zalmi", date: "2025-03-08" },
  { id: 222, t1: "Hyderabad Kingsmen", t2: "Rawalpindi Pindiz", winner: "Hyderabad Kingsmen", date: "2025-03-09" },
  { id: 223, t1: "Multan Sultans", t2: "Quetta Gladiators", winner: "Multan Sultans", date: "2025-03-10" },
  { id: 224, t1: "Karachi Kings", t2: "Peshawar Zalmi", winner: "Peshawar Zalmi", date: "2025-03-11" },
  { id: 225, t1: "Islamabad United", t2: "Rawalpindi Pindiz", winner: "Islamabad United", date: "2025-03-12" },
  { id: 226, t1: "Lahore Qalandars", t2: "Multan Sultans", winner: "Lahore Qalandars", date: "2025-03-13" },
  { id: 227, t1: "Quetta Gladiators", t2: "Hyderabad Kingsmen", winner: "Quetta Gladiators", date: "2025-03-14" },
  { id: 228, t1: "Rawalpindi Pindiz", t2: "Peshawar Zalmi", winner: "Peshawar Zalmi", date: "2025-03-15" },
  { id: 229, t1: "Karachi Kings", t2: "Lahore Qalandars", winner: "Lahore Qalandars", date: "2025-03-16" },
  // Playoffs
  { id: 230, t1: "Lahore Qalandars", t2: "Peshawar Zalmi", winner: "Lahore Qalandars", date: "2025-03-18" },
  { id: 231, t1: "Islamabad United", t2: "Rawalpindi Pindiz", winner: "Rawalpindi Pindiz", date: "2025-03-19" },
  { id: 232, t1: "Peshawar Zalmi", t2: "Rawalpindi Pindiz", winner: "Peshawar Zalmi", date: "2025-03-20" },
  // Final
  { id: 233, t1: "Lahore Qalandars", t2: "Peshawar Zalmi", winner: "Lahore Qalandars", date: "2025-03-22" },
];

// ─── PSL 2026 Season (Current — Full 34-match schedule) ─────────────────────
// Group stage: each team plays 14 matches (7 home, 7 away) = 28 group matches
// + 2 qualifiers + 2 eliminators + 1 final = 34 total
// Matches 1-3, 50-61 already exist as COMPLETED in current DB
const PSL_2026_NEW = [
  // Remaining group stage matches (not already in DB)
  { id: 70, t1: "Karachi Kings", t2: "Peshawar Zalmi", status: "UPCOMING", date: "2026-03-25" },
  { id: 71, t1: "Lahore Qalandars", t2: "Islamabad United", status: "UPCOMING", date: "2026-03-25" },
  { id: 72, t1: "Hyderabad Kingsmen", t2: "Multan Sultans", status: "UPCOMING", date: "2026-03-26" },
  { id: 73, t1: "Rawalpindi Pindiz", t2: "Karachi Kings", status: "UPCOMING", date: "2026-03-27" },
  { id: 74, t1: "Peshawar Zalmi", t2: "Lahore Qalandars", status: "UPCOMING", date: "2026-03-28" },
  { id: 75, t1: "Islamabad United", t2: "Quetta Gladiators", status: "UPCOMING", date: "2026-03-28" },
  { id: 76, t1: "Multan Sultans", t2: "Karachi Kings", status: "UPCOMING", date: "2026-03-29" },
  { id: 77, t1: "Hyderabad Kingsmen", t2: "Lahore Qalandars", status: "UPCOMING", date: "2026-03-30" },
  { id: 78, t1: "Quetta Gladiators", t2: "Peshawar Zalmi", status: "UPCOMING", date: "2026-03-30" },
  { id: 79, t1: "Rawalpindi Pindiz", t2: "Islamabad United", status: "UPCOMING", date: "2026-03-31" },
  { id: 80, t1: "Karachi Kings", t2: "Hyderabad Kingsmen", status: "UPCOMING", date: "2026-04-01" },
  { id: 81, t1: "Multan Sultans", t2: "Quetta Gladiators", status: "UPCOMING", date: "2026-04-01" },
  { id: 82, t1: "Lahore Qalandars", t2: "Rawalpindi Pindiz", status: "UPCOMING", date: "2026-04-02" },
  { id: 83, t1: "Islamabad United", t2: "Peshawar Zalmi", status: "UPCOMING", date: "2026-04-03" },
  { id: 84, t1: "Quetta Gladiators", t2: "Karachi Kings", status: "UPCOMING", date: "2026-04-04" },
  { id: 85, t1: "Multan Sultans", t2: "Hyderabad Kingsmen", status: "UPCOMING", date: "2026-04-05" },
  // Playoffs
  { id: 90, t1: "TBD", t2: "TBD", status: "UPCOMING", date: "2026-04-08" },  // Qualifier 1
  { id: 91, t1: "TBD", t2: "TBD", status: "UPCOMING", date: "2026-04-09" },  // Eliminator 1
  { id: 92, t1: "TBD", t2: "TBD", status: "UPCOMING", date: "2026-04-10" },  // Qualifier 2
  // Final
  { id: 95, t1: "TBD", t2: "TBD", status: "UPCOMING", date: "2026-04-12" },  // FINAL
];

// ─── Venues ─────────────────────────────────────────────────────────────────
const VENUES = {
  "Rawalpindi Pindiz": "Rawalpindi Cricket Stadium",
  "Peshawar Zalmi": "Arbab Niaz Stadium, Peshawar",
  "Karachi Kings": "National Bank Cricket Arena, Karachi",
  "Lahore Qalandars": "Gaddafi Stadium, Lahore",
  "Islamabad United": "Rawalpindi Cricket Stadium",
  "Multan Sultans": "Multan Cricket Stadium",
  "Quetta Gladiators": "Bugti Stadium, Quetta",
  "Hyderabad Kingsmen": "Niaz Stadium, Hyderabad",
};

// ─── Generate player stats for a match ──────────────────────────────────────

function generatePlayerStats(player, isWinningTeam) {
  const role = player.role;
  const tier = Number(player.credits) >= 10 ? "star" : Number(player.credits) >= 8 ? "mid" : "low";
  const boost = isWinningTeam ? 1.15 : 0.9;

  let runs = 0, ballsFaced = 0, fours = 0, sixes = 0;
  let wickets = 0, oversBowled = 0, runsConceded = 0, catches = 0;

  if (role === "BAT" || role === "WK") {
    if (tier === "star") { runs = rand(20, 95); ballsFaced = rand(runs, runs + 30); }
    else if (tier === "mid") { runs = rand(10, 65); ballsFaced = rand(runs, runs + 25); }
    else { runs = rand(0, 35); ballsFaced = rand(Math.max(1, runs), runs + 20); }
    runs = Math.round(runs * boost);
    fours = Math.min(rand(0, Math.floor(runs / 10)), 10);
    sixes = Math.min(rand(0, Math.floor(runs / 20)), 6);
    if (role === "WK") catches = rand(0, 3);
  } else if (role === "BOWL") {
    oversBowled = rand(2, 4);
    if (tier === "star") { wickets = rand(0, 5); runsConceded = rand(15, 40); }
    else if (tier === "mid") { wickets = rand(0, 3); runsConceded = rand(20, 45); }
    else { wickets = rand(0, 2); runsConceded = rand(25, 50); }
    wickets = Math.round(wickets * boost);
    runs = rand(0, 15); ballsFaced = rand(Math.max(1, runs), runs + 10);
    fours = rand(0, 2); sixes = rand(0, 1);
    catches = rand(0, 2);
  } else { // ALL
    if (tier === "star") { runs = rand(15, 70); wickets = rand(0, 3); }
    else if (tier === "mid") { runs = rand(5, 50); wickets = rand(0, 2); }
    else { runs = rand(0, 30); wickets = rand(0, 2); }
    runs = Math.round(runs * boost);
    wickets = Math.round(wickets * boost);
    ballsFaced = rand(Math.max(1, runs), runs + 20);
    fours = Math.min(rand(0, Math.floor(runs / 12)), 8);
    sixes = Math.min(rand(0, Math.floor(runs / 22)), 4);
    oversBowled = rand(1, 4);
    runsConceded = rand(15, 45);
    catches = rand(0, 2);
  }

  const economy = oversBowled > 0 ? (runsConceded / oversBowled).toFixed(2) : 0;
  const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(1) : 0;

  // Fantasy points formula
  let fp = runs + fours + sixes * 2 + wickets * 25 + catches * 8;
  if (runs >= 50) fp += 15;
  if (runs >= 100) fp += 30;
  if (wickets >= 3) fp += 15;
  if (wickets >= 5) fp += 30;

  return {
    runs, balls_faced: ballsFaced, fours, sixes,
    wickets, overs_bowled: oversBowled, runs_conceded: runsConceded,
    economy, catches, fantasy_points: fp,
  };
}

// ─── Main Seed Function ─────────────────────────────────────────────────────

async function seedPSLFull() {
  console.log("Seeding FULL PSL data (2024 + 2025 + 2026)...");
  const ok = await testConnection();
  if (!ok) { console.error("DB unreachable."); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Seed PSL 2024 matches (historical for ELO) ──
    let inserted2024 = 0;
    for (const m of PSL_2024) {
      const venue = VENUES[m.t1] || "National Bank Cricket Arena, Karachi";
      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status, result)
         VALUES ($1, 1, $2, $3, $4, $5, 'COMPLETED', $6)
         ON CONFLICT (match_id) DO NOTHING`,
        [m.id, m.t1, m.t2, venue, m.date + "T14:00:00Z", m.winner]
      );
      inserted2024++;
    }
    console.log(`  ✓ PSL 2024: ${inserted2024} matches seeded`);

    // ── 2. Seed PSL 2025 matches (historical for ELO) ──
    let inserted2025 = 0;
    for (const m of PSL_2025) {
      const venue = VENUES[m.t1] || "Gaddafi Stadium, Lahore";
      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status, result)
         VALUES ($1, 1, $2, $3, $4, $5, 'COMPLETED', $6)
         ON CONFLICT (match_id) DO NOTHING`,
        [m.id, m.t1, m.t2, venue, m.date + "T14:00:00Z", m.winner]
      );
      inserted2025++;
    }
    console.log(`  ✓ PSL 2025: ${inserted2025} matches seeded`);

    // ── 3. Seed PSL 2026 remaining schedule ──
    let inserted2026 = 0;
    for (const m of PSL_2026_NEW) {
      const venue = VENUES[m.t1] || "Rawalpindi Cricket Stadium";
      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status)
         VALUES ($1, 1, $2, $3, $4, $5, $6)
         ON CONFLICT (match_id) DO NOTHING`,
        [m.id, m.t1, m.t2, venue, m.date + "T19:00:00Z", m.status]
      );
      inserted2026++;
    }
    console.log(`  ✓ PSL 2026 schedule: ${inserted2026} new matches seeded`);

    // ── 4. Seed player_match_stats for historical seasons ──
    // Get all active players grouped by team
    const { rows: allPlayers } = await client.query(
      "SELECT player_id, name, team, role, credits FROM players WHERE active = true"
    );
    const playersByTeam = {};
    for (const p of allPlayers) {
      if (!playersByTeam[p.team]) playersByTeam[p.team] = [];
      playersByTeam[p.team].push(p);
    }

    const allHistorical = [...PSL_2024, ...PSL_2025];
    let statsInserted = 0;

    // Batch insert for speed
    const BATCH_SIZE = 50;
    let batchValues = [];
    let batchParams = [];
    let paramIdx = 1;

    for (const match of allHistorical) {
      const team1Players = playersByTeam[match.t1] || [];
      const team2Players = playersByTeam[match.t2] || [];
      // Pick 11 from each team (or all if < 11)
      const t1Squad = team1Players.sort((a, b) => b.credits - a.credits).slice(0, 11);
      const t2Squad = team2Players.sort((a, b) => b.credits - a.credits).slice(0, 11);

      const allSquad = [
        ...t1Squad.map((p) => ({ ...p, isWinning: match.winner === match.t1 })),
        ...t2Squad.map((p) => ({ ...p, isWinning: match.winner === match.t2 })),
      ];

      for (const p of allSquad) {
        const stats = generatePlayerStats(p, p.isWinning);
        batchValues.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
        );
        batchParams.push(
          match.id, p.player_id,
          stats.runs, stats.balls_faced, stats.fours, stats.sixes,
          stats.wickets, stats.overs_bowled, stats.runs_conceded,
          stats.economy, stats.catches, stats.fantasy_points
        );
        statsInserted++;

        // Flush batch
        if (batchValues.length >= BATCH_SIZE) {
          await client.query(
            `INSERT INTO player_match_stats (match_id, player_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, economy, catches, fantasy_points)
             VALUES ${batchValues.join(", ")}
             ON CONFLICT (match_id, player_id) DO NOTHING`,
            batchParams
          );
          batchValues = [];
          batchParams = [];
          paramIdx = 1;
        }
      }
    }

    // Flush remaining
    if (batchValues.length > 0) {
      await client.query(
        `INSERT INTO player_match_stats (match_id, player_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, economy, catches, fantasy_points)
         VALUES ${batchValues.join(", ")}
         ON CONFLICT (match_id, player_id) DO NOTHING`,
        batchParams
      );
    }
    console.log(`  ✓ Player match stats: ${statsInserted} rows seeded for 2024+2025 seasons`);

    // ── 5. Recalculate all player aggregates ──
    await client.query(`
      UPDATE players p SET
        matches_played = sub.mp,
        total_runs = sub.tr,
        total_wickets = sub.tw,
        avg_fantasy_points = sub.avg_fp,
        batting_avg = sub.bat_avg,
        strike_rate = sub.sr
      FROM (
        SELECT
          s.player_id,
          COUNT(*) AS mp,
          SUM(s.runs) AS tr,
          SUM(s.wickets) AS tw,
          ROUND(AVG(s.fantasy_points), 1) AS avg_fp,
          CASE WHEN SUM(CASE WHEN s.runs > 0 THEN 1 ELSE 0 END) > 0
            THEN ROUND(SUM(s.runs)::NUMERIC / SUM(CASE WHEN s.runs > 0 THEN 1 ELSE 0 END), 1)
            ELSE 0 END AS bat_avg,
          CASE WHEN SUM(s.balls_faced) > 0
            THEN ROUND((SUM(s.runs)::NUMERIC / SUM(s.balls_faced)) * 100, 1)
            ELSE 0 END AS sr
        FROM player_match_stats s
        GROUP BY s.player_id
      ) sub
      WHERE p.player_id = sub.player_id
    `);
    console.log("  ✓ Player aggregates recalculated");

    // ── 6. Recalculate recent_form as last 5 matches avg ──
    const { rows: players } = await client.query(
      "SELECT player_id FROM players WHERE active = true AND matches_played > 0"
    );
    for (const p of players) {
      const { rows: recent } = await client.query(
        `SELECT fantasy_points FROM player_match_stats
         WHERE player_id = $1 ORDER BY match_id DESC LIMIT 5`,
        [p.player_id]
      );
      if (recent.length > 0) {
        const avg = recent.reduce((s, r) => s + r.fantasy_points, 0) / recent.length;
        await client.query(
          "UPDATE players SET recent_form = $1 WHERE player_id = $2",
          [Math.round(avg * 10) / 10, p.player_id]
        );
      }
    }
    console.log("  ✓ Recent form (last 5 matches) recalculated");

    await client.query("COMMIT");

    // ── Summary ──
    const { rows: matchCount } = await client.query("SELECT COUNT(*) as cnt, COUNT(*) FILTER (WHERE status='COMPLETED') as completed FROM matches");
    const { rows: statCount } = await client.query("SELECT COUNT(*) as cnt FROM player_match_stats");
    const { rows: playerCount } = await client.query("SELECT COUNT(*) as cnt FROM players WHERE active=true AND matches_played > 0");

    console.log("\n═══ PSL Full Seed Complete ═══");
    console.log(`  Matches: ${matchCount[0].cnt} total (${matchCount[0].completed} completed)`);
    console.log(`  Player stats: ${statCount[0].cnt} rows`);
    console.log(`  Players with data: ${playerCount[0].cnt}`);
    console.log("  Seasons: PSL 2024 (34) + PSL 2025 (34) + PSL 2026 (current)");
    console.log("  ELO engine will use all completed matches for team ratings");
    console.log("  EWMA engine will use all player_match_stats for form analysis");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("  ✗ Seed failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedPSLFull();
}

module.exports = { seedPSLFull };
