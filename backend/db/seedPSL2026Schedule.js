/**
 * Seed the OFFICIAL PSL 2026 schedule — 44 matches, all UPCOMING.
 * Season: 26 March – 3 May 2026
 *
 * Usage: node db/seedPSL2026Schedule.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { pool, testConnection } = require("./index");

// Team name mapping (short → DB name)
const T = {
  LQ:  "Lahore Qalandars",
  HK:  "Hyderabad Kingsmen",
  QG:  "Quetta Gladiators",
  KK:  "Karachi Kings",
  PZ:  "Peshawar Zalmi",
  RP:  "Rawalpindi Pindiz",
  MS:  "Multan Sultans",
  IU:  "Islamabad United",
};

// Official PSL 2026 schedule from HBL PSL poster
// 40 group matches + Qualifier + Eliminator 1 + Eliminator 2 + Final = 44
const SCHEDULE = [
  // ── Phase 1: Lahore (Mar 26 – Apr 6) ──
  { id: 1,  date: "2026-03-26", time: "19:00", t1: T.LQ, t2: T.HK, venue: "Lahore" },
  { id: 2,  date: "2026-03-27", time: "19:00", t1: T.QG, t2: T.KK, venue: "Lahore" },
  { id: 3,  date: "2026-03-28", time: "14:30", t1: T.PZ, t2: T.RP, venue: "Lahore" },
  { id: 4,  date: "2026-03-28", time: "19:00", t1: T.MS, t2: T.IU, venue: "Lahore" },
  { id: 5,  date: "2026-03-29", time: "14:30", t1: T.QG, t2: T.HK, venue: "Lahore" },
  { id: 6,  date: "2026-03-29", time: "19:00", t1: T.LQ, t2: T.KK, venue: "Lahore" },

  { id: 7,  date: "2026-03-31", time: "19:00", t1: T.IU, t2: T.PZ, venue: "Lahore" },
  { id: 8,  date: "2026-04-01", time: "19:00", t1: T.MS, t2: T.HK, venue: "Lahore" },
  { id: 9,  date: "2026-04-02", time: "19:00", t1: T.QG, t2: T.IU, venue: "Lahore" },
  { id: 10, date: "2026-04-02", time: "19:00", t1: T.RP, t2: T.KK, venue: "Lahore" },
  { id: 11, date: "2026-04-03", time: "19:00", t1: T.LQ, t2: T.MS, venue: "Lahore" },
  { id: 12, date: "2026-04-04", time: "19:00", t1: T.RP, t2: T.IU, venue: "Lahore" },
  { id: 13, date: "2026-04-05", time: "19:00", t1: T.QG, t2: T.MS, venue: "Lahore" },
  { id: 14, date: "2026-04-06", time: "19:00", t1: T.MS, t2: T.RP, venue: "Lahore" },

  // ── Phase 2: Karachi (Apr 8 – Apr 19) ──
  { id: 15, date: "2026-04-08", time: "19:00", t1: T.HK, t2: T.PZ, venue: "Karachi" },
  { id: 16, date: "2026-04-09", time: "14:30", t1: T.LQ, t2: T.IU, venue: "Karachi" },
  { id: 17, date: "2026-04-09", time: "19:00", t1: T.KK, t2: T.PZ, venue: "Karachi" },
  { id: 18, date: "2026-04-10", time: "19:00", t1: T.QG, t2: T.RP, venue: "Karachi" },
  { id: 19, date: "2026-04-11", time: "19:00", t1: T.PZ, t2: T.LQ, venue: "Karachi" },
  { id: 20, date: "2026-04-12", time: "14:30", t1: T.KK, t2: T.HK, venue: "Karachi" },
  { id: 21, date: "2026-04-12", time: "19:00", t1: T.HK, t2: T.IU, venue: "Karachi" },
  { id: 22, date: "2026-04-13", time: "19:00", t1: T.PZ, t2: T.MS, venue: "Karachi" },

  { id: 23, date: "2026-04-15", time: "19:00", t1: T.PZ, t2: T.QG, venue: "Karachi" },
  { id: 24, date: "2026-04-16", time: "14:30", t1: T.HK, t2: T.RP, venue: "Karachi" },
  { id: 25, date: "2026-04-16", time: "19:00", t1: T.KK, t2: T.IU, venue: "Karachi" },
  { id: 26, date: "2026-04-17", time: "19:00", t1: T.LQ, t2: T.QG, venue: "Karachi" },
  { id: 27, date: "2026-04-18", time: "19:00", t1: T.LQ, t2: T.RP, venue: "Karachi" },
  { id: 28, date: "2026-04-19", time: "14:30", t1: T.KK, t2: T.MS, venue: "Karachi" },
  { id: 29, date: "2026-04-19", time: "19:00", t1: T.PZ, t2: T.QG, venue: "Karachi" },

  // ── Phase 3: Lahore + Karachi (Apr 21 – Apr 26) ──
  { id: 30, date: "2026-04-21", time: "14:30", t1: T.LQ, t2: T.QG, venue: "Lahore" },
  { id: 31, date: "2026-04-21", time: "19:00", t1: T.RP, t2: T.MS, venue: "Karachi" },
  { id: 32, date: "2026-04-22", time: "14:30", t1: T.KK, t2: T.PZ, venue: "Lahore" },
  { id: 33, date: "2026-04-22", time: "19:00", t1: T.HK, t2: T.MS, venue: "Karachi" },
  { id: 34, date: "2026-04-23", time: "14:30", t1: T.RP, t2: T.IU, venue: "Karachi" },
  { id: 35, date: "2026-04-23", time: "19:00", t1: T.LQ, t2: T.KK, venue: "Lahore" },
  { id: 36, date: "2026-04-24", time: "19:00", t1: T.HK, t2: T.IU, venue: "Karachi" },
  { id: 37, date: "2026-04-25", time: "14:30", t1: T.QG, t2: T.KK, venue: "Lahore" },
  { id: 38, date: "2026-04-25", time: "19:00", t1: T.LQ, t2: T.PZ, venue: "Lahore" },
  { id: 39, date: "2026-04-26", time: "14:30", t1: T.HK, t2: T.RP, venue: "Karachi" },
  { id: 40, date: "2026-04-26", time: "19:00", t1: T.IU, t2: T.MS, venue: "Karachi" },

  // ── Playoffs ──
  { id: 41, date: "2026-04-28", time: "19:00", t1: "TBD", t2: "TBD", venue: "Karachi" },  // Qualifier
  { id: 42, date: "2026-04-29", time: "19:00", t1: "TBD", t2: "TBD", venue: "Lahore" },   // Eliminator 1
  { id: 43, date: "2026-05-01", time: "19:00", t1: "TBD", t2: "TBD", venue: "Lahore" },   // Eliminator 2
  { id: 44, date: "2026-05-03", time: "19:00", t1: "TBD", t2: "TBD", venue: "Lahore" },   // FINAL
];

const VENUE_FULL = {
  Lahore: "Gaddafi Stadium, Lahore",
  Karachi: "National Bank Cricket Arena, Karachi",
};

async function seedSchedule() {
  console.log("Seeding OFFICIAL PSL 2026 schedule (44 matches)...");
  const ok = await testConnection();
  if (!ok) { console.error("DB unreachable."); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let inserted = 0;
    for (const m of SCHEDULE) {
      const startTime = `${m.date}T${m.time}:00+05:00`; // PKT timezone
      const venue = VENUE_FULL[m.venue] || m.venue;

      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status)
         VALUES ($1, 1, $2, $3, $4, $5, 'UPCOMING')
         ON CONFLICT (match_id) DO UPDATE SET
           team1 = $2, team2 = $3, venue = $4, start_time = $5, status = 'UPCOMING', result = NULL`,
        [m.id, m.t1, m.t2, venue, startTime]
      );
      inserted++;
    }

    await client.query("COMMIT");

    console.log(`  ✓ ${inserted} PSL 2026 matches seeded (all UPCOMING)`);
    console.log(`  Phase 1: Lahore (Mar 26 – Apr 6) — Matches 1-14`);
    console.log(`  Phase 2: Karachi (Apr 8 – Apr 19) — Matches 15-29`);
    console.log(`  Phase 3: Lahore+Karachi (Apr 21 – Apr 26) — Matches 30-40`);
    console.log(`  Playoffs: Qualifier + Eliminator 1 + Eliminator 2 + Final — Matches 41-44`);

    // Verify
    const { rows } = await client.query(
      "SELECT COUNT(*) as cnt FROM matches WHERE match_id BETWEEN 1 AND 44"
    );
    console.log(`  Total PSL 2026 in DB: ${rows[0].cnt} matches`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("  ✗ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedSchedule();
}

module.exports = { seedSchedule, SCHEDULE };
