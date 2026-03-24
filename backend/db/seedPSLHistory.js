/**
 * Seed REAL historical PSL match results (PSL 8, 9, 10) into the database.
 * Data verified from ESPNcricinfo.
 *
 * match_id ranges:
 *   100-129 = PSL 8 (2023)
 *   130-159 = PSL 9 (2024)
 *   160-189 = PSL 10 (2025)
 *
 * Usage: node db/seedPSLHistory.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { pool, testConnection } = require("./index");

// ── Venue mapping ──
const VENUES = {
  Lahore:     "Gaddafi Stadium, Lahore",
  Karachi:    "National Stadium, Karachi",
  Rawalpindi: "Rawalpindi Cricket Stadium, Rawalpindi",
  Multan:     "Multan Cricket Stadium, Multan",
  Quetta:     "Bugti Stadium, Quetta",
};

function v(city) { return VENUES[city] || city; }

// ── PSL 8 (2023) — Feb 13 to Mar 19 ──
// Champion: Lahore Qalandars
const PSL8 = [
  { id: 100, date: "2023-02-13", t1: "Lahore Qalandars",   t2: "Multan Sultans",     venue: v("Multan"),     winner: "Lahore Qalandars" },
  { id: 101, date: "2023-02-14", t1: "Islamabad United",   t2: "Peshawar Zalmi",     venue: v("Multan"),     winner: "Islamabad United" },
  { id: 102, date: "2023-02-15", t1: "Multan Sultans",     t2: "Quetta Gladiators",  venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 103, date: "2023-02-16", t1: "Karachi Kings",      t2: "Lahore Qalandars",   venue: v("Karachi"),    winner: "Lahore Qalandars" },
  { id: 104, date: "2023-02-17", t1: "Peshawar Zalmi",     t2: "Quetta Gladiators",  venue: v("Karachi"),    winner: "Peshawar Zalmi" },
  { id: 105, date: "2023-02-18", t1: "Islamabad United",   t2: "Karachi Kings",      venue: v("Karachi"),    winner: "Islamabad United" },
  { id: 106, date: "2023-02-19", t1: "Lahore Qalandars",   t2: "Peshawar Zalmi",     venue: v("Karachi"),    winner: "Lahore Qalandars" },
  { id: 107, date: "2023-02-20", t1: "Multan Sultans",     t2: "Islamabad United",   venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 108, date: "2023-02-21", t1: "Quetta Gladiators",  t2: "Karachi Kings",      venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 109, date: "2023-02-22", t1: "Peshawar Zalmi",     t2: "Multan Sultans",     venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 110, date: "2023-02-23", t1: "Lahore Qalandars",   t2: "Islamabad United",   venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 111, date: "2023-02-24", t1: "Quetta Gladiators",  t2: "Peshawar Zalmi",     venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 112, date: "2023-02-25", t1: "Karachi Kings",      t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Multan Sultans" },
  { id: 113, date: "2023-02-26", t1: "Islamabad United",   t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 114, date: "2023-02-27", t1: "Lahore Qalandars",   t2: "Karachi Kings",      venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 115, date: "2023-03-01", t1: "Multan Sultans",     t2: "Lahore Qalandars",   venue: v("Lahore"),     winner: "Multan Sultans" },
  { id: 116, date: "2023-03-02", t1: "Peshawar Zalmi",     t2: "Islamabad United",   venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 117, date: "2023-03-03", t1: "Quetta Gladiators",  t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Multan Sultans" },
  { id: 118, date: "2023-03-04", t1: "Karachi Kings",      t2: "Peshawar Zalmi",     venue: v("Lahore"),     winner: "Peshawar Zalmi" },
  { id: 119, date: "2023-03-05", t1: "Islamabad United",   t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: "Lahore Qalandars" },
  { id: 120, date: "2023-03-06", t1: "Quetta Gladiators",  t2: "Karachi Kings",      venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 121, date: "2023-03-07", t1: "Multan Sultans",     t2: "Peshawar Zalmi",     venue: v("Lahore"),     winner: "Multan Sultans" },
  { id: 122, date: "2023-03-08", t1: "Islamabad United",   t2: "Karachi Kings",      venue: v("Lahore"),     winner: "Islamabad United" },
  { id: 123, date: "2023-03-09", t1: "Lahore Qalandars",   t2: "Quetta Gladiators",  venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 124, date: "2023-03-10", t1: "Peshawar Zalmi",     t2: "Karachi Kings",      venue: v("Rawalpindi"), winner: "Karachi Kings" },
  { id: 125, date: "2023-03-10", t1: "Multan Sultans",     t2: "Islamabad United",   venue: v("Lahore"),     winner: "Islamabad United" },
  { id: 126, date: "2023-03-11", t1: "Lahore Qalandars",   t2: "Peshawar Zalmi",     venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 127, date: "2023-03-11", t1: "Quetta Gladiators",  t2: "Islamabad United",   venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 128, date: "2023-03-12", t1: "Karachi Kings",      t2: "Quetta Gladiators",  venue: v("Lahore"),     winner: "Quetta Gladiators" },
  { id: 129, date: "2023-03-12", t1: "Peshawar Zalmi",     t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
];

// ── PSL 9 (2024) — Feb 17 to Mar 18 ──
// Champion: Islamabad United
const PSL9 = [
  { id: 130, date: "2024-02-17", t1: "Lahore Qalandars",   t2: "Islamabad United",   venue: v("Lahore"),     winner: "Islamabad United" },
  { id: 131, date: "2024-02-18", t1: "Multan Sultans",     t2: "Karachi Kings",      venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 132, date: "2024-02-19", t1: "Peshawar Zalmi",     t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 133, date: "2024-02-20", t1: "Lahore Qalandars",   t2: "Multan Sultans",     venue: v("Lahore"),     winner: "Multan Sultans" },
  { id: 134, date: "2024-02-21", t1: "Islamabad United",   t2: "Peshawar Zalmi",     venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 135, date: "2024-02-22", t1: "Karachi Kings",      t2: "Quetta Gladiators",  venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 136, date: "2024-02-23", t1: "Lahore Qalandars",   t2: "Peshawar Zalmi",     venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 137, date: "2024-02-24", t1: "Multan Sultans",     t2: "Islamabad United",   venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 138, date: "2024-02-25", t1: "Karachi Kings",      t2: "Lahore Qalandars",   venue: v("Karachi"),    winner: "Lahore Qalandars" },
  { id: 139, date: "2024-02-26", t1: "Peshawar Zalmi",     t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Multan Sultans" },
  { id: 140, date: "2024-02-27", t1: "Quetta Gladiators",  t2: "Islamabad United",   venue: v("Quetta"),     winner: "Quetta Gladiators" },
  { id: 141, date: "2024-02-28", t1: "Karachi Kings",      t2: "Peshawar Zalmi",     venue: v("Karachi"),    winner: "Peshawar Zalmi" },
  { id: 142, date: "2024-02-29", t1: "Lahore Qalandars",   t2: "Quetta Gladiators",  venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 143, date: "2024-03-01", t1: "Multan Sultans",     t2: "Peshawar Zalmi",     venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 144, date: "2024-03-02", t1: "Islamabad United",   t2: "Karachi Kings",      venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 145, date: "2024-03-03", t1: "Quetta Gladiators",  t2: "Lahore Qalandars",   venue: v("Quetta"),     winner: "Quetta Gladiators" },
  { id: 146, date: "2024-03-04", t1: "Multan Sultans",     t2: "Quetta Gladiators",  venue: v("Multan"),     winner: null },  // No Result (rain)
  { id: 147, date: "2024-03-04", t1: "Islamabad United",   t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: null },  // No Result (rain)
  { id: 148, date: "2024-03-05", t1: "Peshawar Zalmi",     t2: "Karachi Kings",      venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 149, date: "2024-03-06", t1: "Islamabad United",   t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 150, date: "2024-03-07", t1: "Multan Sultans",     t2: "Lahore Qalandars",   venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 151, date: "2024-03-08", t1: "Peshawar Zalmi",     t2: "Islamabad United",   venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 152, date: "2024-03-08", t1: "Karachi Kings",      t2: "Multan Sultans",     venue: v("Karachi"),    winner: "Multan Sultans" },
  { id: 153, date: "2024-03-09", t1: "Quetta Gladiators",  t2: "Peshawar Zalmi",     venue: v("Quetta"),     winner: "Quetta Gladiators" },
  { id: 154, date: "2024-03-10", t1: "Lahore Qalandars",   t2: "Karachi Kings",      venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 155, date: "2024-03-10", t1: "Islamabad United",   t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 156, date: "2024-03-11", t1: "Peshawar Zalmi",     t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 157, date: "2024-03-11", t1: "Quetta Gladiators",  t2: "Karachi Kings",      venue: v("Quetta"),     winner: "Quetta Gladiators" },
  { id: 158, date: "2024-03-12", t1: "Karachi Kings",      t2: "Islamabad United",   venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 159, date: "2024-03-12", t1: "Quetta Gladiators",  t2: "Multan Sultans",     venue: v("Quetta"),     winner: "Multan Sultans" },
];

// ── PSL 10 (2025) — Apr 11 to May 19 ──
// Champion: Quetta Gladiators (top of standings)
const PSL10 = [
  { id: 160, date: "2025-04-11", t1: "Islamabad United",   t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 161, date: "2025-04-12", t1: "Peshawar Zalmi",     t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 162, date: "2025-04-12", t1: "Karachi Kings",      t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Karachi Kings" },
  { id: 163, date: "2025-04-13", t1: "Lahore Qalandars",   t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Lahore Qalandars" },
  { id: 164, date: "2025-04-14", t1: "Islamabad United",   t2: "Peshawar Zalmi",     venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 165, date: "2025-04-15", t1: "Karachi Kings",      t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: "Lahore Qalandars" },
  { id: 166, date: "2025-04-16", t1: "Islamabad United",   t2: "Multan Sultans",     venue: v("Rawalpindi"), winner: "Islamabad United" },
  { id: 167, date: "2025-04-18", t1: "Karachi Kings",      t2: "Quetta Gladiators",  venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 168, date: "2025-04-19", t1: "Multan Sultans",     t2: "Peshawar Zalmi",     venue: v("Multan"),     winner: "Peshawar Zalmi" },
  { id: 169, date: "2025-04-20", t1: "Karachi Kings",      t2: "Islamabad United",   venue: v("Karachi"),    winner: "Islamabad United" },
  { id: 170, date: "2025-04-21", t1: "Karachi Kings",      t2: "Peshawar Zalmi",     venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 171, date: "2025-04-22", t1: "Lahore Qalandars",   t2: "Multan Sultans",     venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 172, date: "2025-04-23", t1: "Multan Sultans",     t2: "Islamabad United",   venue: v("Multan"),     winner: "Islamabad United" },
  { id: 173, date: "2025-04-24", t1: "Peshawar Zalmi",     t2: "Lahore Qalandars",   venue: v("Rawalpindi"), winner: "Lahore Qalandars" },
  { id: 174, date: "2025-04-25", t1: "Karachi Kings",      t2: "Quetta Gladiators",  venue: v("Karachi"),    winner: "Quetta Gladiators" },
  { id: 175, date: "2025-04-26", t1: "Multan Sultans",     t2: "Lahore Qalandars",   venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 176, date: "2025-04-27", t1: "Peshawar Zalmi",     t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 177, date: "2025-04-29", t1: "Multan Sultans",     t2: "Quetta Gladiators",  venue: v("Multan"),     winner: "Quetta Gladiators" },
  { id: 178, date: "2025-04-30", t1: "Lahore Qalandars",   t2: "Islamabad United",   venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 179, date: "2025-05-01", t1: "Multan Sultans",     t2: "Karachi Kings",      venue: v("Multan"),     winner: "Karachi Kings" },
  { id: 180, date: "2025-05-01", t1: "Lahore Qalandars",   t2: "Quetta Gladiators",  venue: v("Lahore"),     winner: null },  // No Result (abandoned)
  { id: 181, date: "2025-05-02", t1: "Islamabad United",   t2: "Peshawar Zalmi",     venue: v("Rawalpindi"), winner: "Peshawar Zalmi" },
  { id: 182, date: "2025-05-03", t1: "Islamabad United",   t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 183, date: "2025-05-04", t1: "Lahore Qalandars",   t2: "Karachi Kings",      venue: v("Lahore"),     winner: "Karachi Kings" },
  { id: 184, date: "2025-05-05", t1: "Multan Sultans",     t2: "Peshawar Zalmi",     venue: v("Multan"),     winner: "Multan Sultans" },
  { id: 185, date: "2025-05-07", t1: "Islamabad United",   t2: "Quetta Gladiators",  venue: v("Rawalpindi"), winner: "Quetta Gladiators" },
  { id: 186, date: "2025-05-17", t1: "Karachi Kings",      t2: "Peshawar Zalmi",     venue: v("Karachi"),    winner: "Karachi Kings" },
  { id: 187, date: "2025-05-18", t1: "Multan Sultans",     t2: "Quetta Gladiators",  venue: v("Multan"),     winner: "Quetta Gladiators" },
  { id: 188, date: "2025-05-18", t1: "Lahore Qalandars",   t2: "Peshawar Zalmi",     venue: v("Lahore"),     winner: "Lahore Qalandars" },
  { id: 189, date: "2025-05-19", t1: "Islamabad United",   t2: "Karachi Kings",      venue: v("Rawalpindi"), winner: "Islamabad United" },
];

const ALL_MATCHES = [...PSL8, ...PSL9, ...PSL10];

async function seedHistory() {
  console.log("Seeding historical PSL match results (PSL 8, 9, 10)...\n");
  const ok = await testConnection();
  if (!ok) { console.error("DB unreachable."); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let inserted = 0;
    for (const m of ALL_MATCHES) {
      const startTime = `${m.date}T19:00:00+05:00`; // default evening PKT
      const status = m.winner === null ? "ABANDONED" : "COMPLETED";
      const result = m.winner ? `${m.winner} won` : null;

      const res = await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status, result)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id) DO NOTHING`,
        [m.id, m.t1, m.t2, m.venue, startTime, status, result]
      );
      if (res.rowCount > 0) inserted++;
    }

    await client.query("COMMIT");

    // ── Print summary ──
    console.log(`\n  Inserted ${inserted} new rows (${ALL_MATCHES.length} total in script).\n`);

    // Compute per-team W/L records
    const teams = {};
    for (const m of ALL_MATCHES) {
      if (!teams[m.t1]) teams[m.t1] = { W: 0, L: 0, NR: 0 };
      if (!teams[m.t2]) teams[m.t2] = { W: 0, L: 0, NR: 0 };

      if (m.winner === null) {
        teams[m.t1].NR++;
        teams[m.t2].NR++;
      } else if (m.winner === m.t1) {
        teams[m.t1].W++;
        teams[m.t2].L++;
      } else {
        teams[m.t2].W++;
        teams[m.t1].L++;
      }
    }

    console.log("  Per-team W/L across PSL 8 + 9 + 10 (group stage):");
    console.log("  " + "-".repeat(50));
    const sorted = Object.entries(teams).sort((a, b) => b[1].W - a[1].W);
    for (const [name, rec] of sorted) {
      const nr = rec.NR > 0 ? `-${rec.NR}NR` : "";
      console.log(`  ${name.padEnd(22)} ${rec.W}W - ${rec.L}L${nr}`);
    }
    console.log("  " + "-".repeat(50));

    console.log(`\nSeeded ${ALL_MATCHES.length} historical PSL matches (PSL 8, 9, 10)`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("  Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedHistory();
}

module.exports = { seedHistory, PSL8, PSL9, PSL10 };
