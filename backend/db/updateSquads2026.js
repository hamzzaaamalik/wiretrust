/**
 * Update player rosters to OFFICIAL PSL 2026 squads.
 * Source: Official PSL announcements (retentions, auction, trades, replacements).
 *
 * Usage: node db/updateSquads2026.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { pool, testConnection } = require("./index");

// ─── Official PSL 2026 Squads (post-trades, post-replacements) ──────────────

const SQUADS = {
  "Rawalpindi Pindiz": {
    captain: "Mohammad Rizwan",
    players: [
      { name: "Mohammad Rizwan",    role: "WK",   credits: 12.0 },
      { name: "Naseem Shah",        role: "BOWL", credits: 10.5 },
      { name: "Daryl Mitchell",     role: "ALL",  credits: 10.0 },
      { name: "Mohammad Amir",      role: "BOWL", credits: 9.5 },
      { name: "Sam Billings",       role: "WK",   credits: 9.0 },
      { name: "Zaman Khan",         role: "BOWL", credits: 8.5 },
      { name: "Kamran Ghulam",      role: "BAT",  credits: 8.0 },
      { name: "Amad Butt",          role: "ALL",  credits: 8.0 },
      { name: "Rishad Hossain",     role: "BOWL", credits: 7.5 },
      { name: "Laurie Evans",       role: "BAT",  credits: 7.0 },
      { name: "Yasir Khan",         role: "BAT",  credits: 7.0 },
      { name: "Dian Forrester",     role: "ALL",  credits: 7.0 },
      { name: "Abdullah Fazal",     role: "BAT",  credits: 6.5 },
      { name: "Asif Afridi",        role: "BOWL", credits: 6.5 },
      { name: "Mohammad Amir Khan", role: "BOWL", credits: 6.0 },
      { name: "Shahzaib Khan",      role: "BAT",  credits: 6.0 },
      { name: "Fawad Ali",          role: "BOWL", credits: 6.0 },
      // JFM opted out: { name: "Jake Fraser-McGurk", role: "BAT", credits: 11.0 },
    ],
  },
  "Karachi Kings": {
    captain: "David Warner",
    players: [
      { name: "David Warner",           role: "BAT",  credits: 12.0 },
      { name: "Moeen Ali",              role: "ALL",  credits: 10.5 },
      { name: "Salman Ali Agha",        role: "ALL",  credits: 10.0 },
      { name: "Adam Zampa",             role: "BOWL", credits: 9.0 },
      { name: "Azam Khan",              role: "WK",   credits: 8.5 },
      { name: "Hasan Ali",              role: "BOWL", credits: 8.5 },
      { name: "Mohammad Abbas Afridi",  role: "BOWL", credits: 8.0 },
      { name: "Johnson Charles",        role: "BAT",  credits: 8.0 },
      { name: "Khushdil Shah",          role: "BAT",  credits: 7.5 },
      { name: "Mir Hamza",              role: "BOWL", credits: 7.5 },
      { name: "Muhammad Waseem",        role: "BAT",  credits: 7.0 },
      { name: "Saad Baig",              role: "WK",   credits: 7.0 },
      { name: "Ihsanullah",             role: "BOWL", credits: 7.0 },
      { name: "Mohammad Hamza Sohail",  role: "BAT",  credits: 6.5 },
      { name: "Aqib Ilyas",             role: "ALL",  credits: 6.5 },
      { name: "Shahid Aziz",            role: "BOWL", credits: 6.0 },
      { name: "Khuzaima Bin Tanveer",   role: "BAT",  credits: 6.0 },
      { name: "Rizwanullah",            role: "BOWL", credits: 6.0 },
      { name: "Haroon Arshad",          role: "ALL",  credits: 6.0 },
      { name: "Reeza Hendricks",        role: "BAT",  credits: 9.0 }, // replacement for Charles
    ],
  },
  "Islamabad United": {
    captain: "Shadab Khan",
    players: [
      { name: "Shadab Khan",           role: "ALL",  credits: 11.0 },
      { name: "Devon Conway",          role: "BAT",  credits: 10.5 },
      { name: "Faheem Ashraf",         role: "ALL",  credits: 10.0 },
      { name: "Andries Gous",          role: "WK",   credits: 9.0 },
      { name: "Salman Mirza",          role: "BOWL", credits: 8.5 }, // traded from MS
      { name: "Mohammad Hasnain",      role: "BOWL", credits: 8.0 },
      { name: "Haider Ali",            role: "BAT",  credits: 8.0 },
      { name: "Mehran Mumtaz",         role: "BOWL", credits: 8.0 },
      { name: "Mark Chapman",          role: "BAT",  credits: 7.5 },
      { name: "Max Bryant",            role: "BAT",  credits: 7.5 },
      { name: "Imad Wasim",            role: "ALL",  credits: 7.5 },
      { name: "Salman Irshad",         role: "BOWL", credits: 7.0 },
      { name: "Richard Gleeson",       role: "BOWL", credits: 7.0 },
      { name: "Sameer Minhas",         role: "BAT",  credits: 6.5 },
      { name: "Mir Hamza Sajjad",      role: "BOWL", credits: 6.5 },
      { name: "Dipendra Singh Airee",  role: "ALL",  credits: 6.5 },
      { name: "Sameen Gul",            role: "BOWL", credits: 6.0 },
      { name: "Nisar Ahmed",           role: "BOWL", credits: 6.0 }, // traded from MS
    ],
  },
  "Lahore Qalandars": {
    captain: "Shaheen Shah Afridi",
    players: [
      { name: "Shaheen Shah Afridi",  role: "BOWL", credits: 11.5 },
      { name: "Fakhar Zaman",         role: "BAT",  credits: 10.0 },
      { name: "Haris Rauf",           role: "BOWL", credits: 9.5 },
      { name: "Abdullah Shafique",    role: "BAT",  credits: 9.5 },
      { name: "Sikandar Raza",        role: "ALL",  credits: 9.0 },
      { name: "Mustafizur Rahman",    role: "BOWL", credits: 8.5 },
      { name: "Daniel Sams",          role: "ALL",  credits: 8.0 }, // replacement for Shanaka
      { name: "Usama Mir",            role: "BOWL", credits: 7.5 },
      { name: "Ubaid Shah",           role: "BOWL", credits: 7.5 },
      { name: "Dunith Wellalage",     role: "ALL",  credits: 7.5 }, // replacement for Motie
      { name: "Hussain Talat",        role: "ALL",  credits: 7.0 },
      { name: "Haseebullah Khan",     role: "WK",   credits: 7.0 },
      { name: "Asif Ali",             role: "BAT",  credits: 7.0 },
      { name: "Tayyab Tahir",         role: "BAT",  credits: 6.5 },
      { name: "Parvez Hossain Emon",  role: "BAT",  credits: 6.5 },
      { name: "Rubin Hermann",        role: "ALL",  credits: 6.0 },
      { name: "Mohammad Naeem",       role: "BAT",  credits: 6.0 },
      { name: "Mohammad Farooq",      role: "BOWL", credits: 6.0 },
      { name: "Maaz Khan",            role: "BOWL", credits: 6.0 },
    ],
  },
  "Peshawar Zalmi": {
    captain: "Babar Azam",
    players: [
      { name: "Babar Azam",          role: "BAT",  credits: 12.0 },
      { name: "Sufiyan Muqeem",      role: "BOWL", credits: 9.0 },
      { name: "Kusal Mendis",        role: "WK",   credits: 9.0 },
      { name: "James Vince",         role: "BAT",  credits: 9.0 },
      { name: "Michael Bracewell",   role: "ALL",  credits: 8.5 },
      { name: "Mohammad Haris",      role: "WK",   credits: 8.5 },
      { name: "Aaron Hardie",        role: "ALL",  credits: 8.0 },
      { name: "Khurram Shahzad",     role: "BOWL", credits: 8.0 },
      { name: "Iftikhar Ahmed",      role: "ALL",  credits: 8.0 },
      { name: "Aamir Jamal",         role: "ALL",  credits: 7.5 },
      { name: "Shahnawaz Dahani",    role: "BOWL", credits: 7.5 },
      { name: "Tymal Mills",         role: "BOWL", credits: 7.0 },
      { name: "Abdul Samad",         role: "BAT",  credits: 7.0 },
      { name: "Tanzid Hasan",        role: "BAT",  credits: 7.0 },
      { name: "Khalid Usman",        role: "ALL",  credits: 6.5 },
      { name: "Mirza Tahir Baig",    role: "BAT",  credits: 6.5 },
      { name: "Nahid Rana",          role: "BOWL", credits: 6.5 },
      { name: "Ali Raza",            role: "BOWL", credits: 6.0 },
      { name: "Abdul Subhan",        role: "BAT",  credits: 6.0 },
      { name: "Kashif Ali",          role: "BAT",  credits: 6.0 },
      { name: "Mohammad Basit",      role: "BOWL", credits: 6.0 },
      { name: "Farhan Yousuf",       role: "BAT",  credits: 6.0 },
    ],
  },
  "Quetta Gladiators": {
    captain: "Saud Shakeel",
    players: [
      { name: "Tom Curran",          role: "ALL",  credits: 9.5 },
      { name: "Rilee Rossouw",       role: "BAT",  credits: 10.0 },
      { name: "Abrar Ahmed",         role: "BOWL", credits: 9.5 },
      { name: "Alzarri Joseph",      role: "BOWL", credits: 9.0 }, // replacement for Spencer Johnson
      { name: "Saud Shakeel",        role: "BAT",  credits: 9.0 },
      { name: "Khawaja Nafay",       role: "BAT",  credits: 8.5 },
      { name: "Ben McDermott",       role: "BAT",  credits: 8.0 },
      { name: "Sam Harper",          role: "WK",   credits: 7.5 },
      { name: "Usman Tariq",         role: "BOWL", credits: 7.5 },
      { name: "Hasan Nawaz",         role: "ALL",  credits: 7.0 },
      { name: "Shamyl Hussain",      role: "ALL",  credits: 7.0 },
      { name: "Jahandad Khan",       role: "BOWL", credits: 7.0 },
      { name: "Ahmed Daniyal",       role: "BOWL", credits: 7.0 }, // traded from MS
      { name: "Wasim Akram Jr",      role: "BOWL", credits: 6.5 },
      { name: "Bismillah Khan",      role: "WK",   credits: 6.5 },
      { name: "Brett Hampton",       role: "ALL",  credits: 6.0 },
      { name: "Bevon Jacobs",        role: "BAT",  credits: 6.0 },
      { name: "Khan Zeb",            role: "BOWL", credits: 6.0 },
      { name: "Saqib Khan",          role: "BOWL", credits: 6.0 },
      { name: "Jahanzaib Sultan",    role: "ALL",  credits: 6.0 }, // traded from MS
      { name: "Ahsan Ali",           role: "BAT",  credits: 6.0 }, // partial replacement for Harper
    ],
  },
  "Multan Sultans": {
    captain: "Steve Smith",
    players: [
      { name: "Steve Smith",            role: "BAT",  credits: 11.0 },
      { name: "Mohammad Nawaz",         role: "ALL",  credits: 9.5 },
      { name: "Ashton Turner",          role: "ALL",  credits: 9.0 },
      { name: "Shan Masood",            role: "BAT",  credits: 9.0 },
      { name: "Tabraiz Shamsi",         role: "BOWL", credits: 8.5 },
      { name: "Sahibzada Farhan",       role: "WK",   credits: 8.0 },
      { name: "Mohammad Wasim Jr",      role: "BOWL", credits: 8.0 }, // traded from IU
      { name: "Josh Philippe",          role: "WK",   credits: 8.0 },
      { name: "Peter Siddle",           role: "BOWL", credits: 7.5 },
      { name: "Arafat Minhas",          role: "ALL",  credits: 7.0 }, // traded from QG
      { name: "Faisal Akram",           role: "BAT",  credits: 7.0 }, // traded from QG
      { name: "Momin Qamar",            role: "BOWL", credits: 6.5 },
      { name: "Delano Potgieter",       role: "BAT",  credits: 6.5 },
      { name: "Lachlan Shaw",           role: "BAT",  credits: 6.0 },
      { name: "Saad Masood",            role: "BAT",  credits: 6.0 },
      { name: "Muhammad Awais Zafar",   role: "BOWL", credits: 6.0 },
      { name: "Muhammad Shahzad",       role: "WK",   credits: 6.0 },
      { name: "Imran Randhawa",         role: "ALL",  credits: 6.0 },
      { name: "Shehzad Gul",            role: "BOWL", credits: 6.0 },
    ],
  },
  "Hyderabad Kingsmen": {
    captain: "Marnus Labuschagne",
    players: [
      { name: "Saim Ayub",              role: "BAT",  credits: 11.0 }, // Platinum retention
      { name: "Glenn Maxwell",          role: "ALL",  credits: 10.5 }, // available 2nd half
      { name: "Marnus Labuschagne",     role: "ALL",  credits: 10.0 },
      { name: "Kusal Perera",           role: "WK",   credits: 9.0 },
      { name: "Riley Meredith",         role: "BOWL", credits: 8.0 },
      { name: "Usman Khan",             role: "BAT",  credits: 8.0 },
      { name: "Sharjeel Khan",          role: "BAT",  credits: 7.5 },
      { name: "Irfan Khan Niazi",       role: "ALL",  credits: 7.5 },
      { name: "Mohammad Ali",           role: "BOWL", credits: 7.0 },
      { name: "Ottneil Baartman",       role: "BOWL", credits: 7.0 },
      { name: "Akif Javed",             role: "BOWL", credits: 7.0 },
      { name: "Hassan Khan",            role: "ALL",  credits: 6.5 },
      { name: "Hammad Azam",            role: "ALL",  credits: 6.5 },
      { name: "Maaz Sadaqat",           role: "BOWL", credits: 6.5 },
      { name: "Shayan Jahangir",        role: "BAT",  credits: 6.0 },
      { name: "Asif Mehmood",           role: "BOWL", credits: 6.0 },
      { name: "Hunain Shah",            role: "BOWL", credits: 6.0 },
      { name: "Rizwan Mehmood",         role: "BAT",  credits: 6.0 },
      { name: "Saad Ali",               role: "BAT",  credits: 6.0 },
      { name: "Mohammad Tayyab Arif",   role: "BAT",  credits: 6.0 },
      { name: "Ahmed Hussain",          role: "ALL",  credits: 6.0 },
    ],
  },
};

async function updateSquads() {
  console.log("Updating PSL 2026 squads (OFFICIAL data)...\n");
  const ok = await testConnection();
  if (!ok) { console.error("DB unreachable."); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current max player_id
    const { rows: [{ m: maxId }] } = await client.query("SELECT COALESCE(MAX(player_id), 0) AS m FROM players");
    let nextId = Math.max(maxId + 1, 900);

    // Build set of all players that should be active
    const activePlayerNames = new Set();
    const allSquadEntries = [];

    for (const [team, squad] of Object.entries(SQUADS)) {
      for (const p of squad.players) {
        if (activePlayerNames.has(p.name)) {
          console.log(`  ⚠ Skipping duplicate: ${p.name} (already assigned)`);
          continue;
        }
        activePlayerNames.add(p.name);
        allSquadEntries.push({ ...p, team });
      }
    }

    // Get all existing players
    const { rows: existing } = await client.query("SELECT player_id, name, team, role, credits FROM players");
    const existingByName = {};
    for (const p of existing) {
      existingByName[p.name] = p;
    }

    let transferred = 0, added = 0, unchanged = 0, updated = 0;

    for (const entry of allSquadEntries) {
      const ex = existingByName[entry.name];
      if (ex) {
        if (ex.team !== entry.team || ex.role !== entry.role || Number(ex.credits) !== entry.credits) {
          await client.query(
            "UPDATE players SET team = $1, role = $2, credits = $3, active = true WHERE player_id = $4",
            [entry.team, entry.role, entry.credits, ex.player_id]
          );
          if (ex.team !== entry.team) {
            console.log(`  → ${entry.name}: ${ex.team} → ${entry.team}`);
            transferred++;
          } else {
            updated++;
          }
        } else {
          await client.query("UPDATE players SET active = true WHERE player_id = $1", [ex.player_id]);
          unchanged++;
        }
      } else {
        await client.query(
          "INSERT INTO players (player_id, name, team, role, credits, active) VALUES ($1, $2, $3, $4, $5, true)",
          [nextId, entry.name, entry.team, entry.role, entry.credits]
        );
        console.log(`  + ${entry.name} (${entry.team}, ${entry.role}, ${entry.credits}cr) #${nextId}`);
        nextId++;
        added++;
      }
    }

    // Deactivate players not in any 2026 squad
    const deactivated = await client.query(
      "UPDATE players SET active = false WHERE active = true AND name != ALL($1::text[]) RETURNING name, team",
      [Array.from(activePlayerNames)]
    );
    if (deactivated.rowCount > 0) {
      console.log(`\n  Deactivated ${deactivated.rowCount} players not in 2026 squads:`);
      for (const p of deactivated.rows) {
        console.log(`    - ${p.name} (${p.team})`);
      }
    }

    await client.query("COMMIT");

    // Summary
    const { rows: summary } = await client.query(
      "SELECT team, COUNT(*) as cnt FROM players WHERE active = true GROUP BY team ORDER BY team"
    );
    console.log("\n═══ PSL 2026 Official Squad Summary ═══");
    let total = 0;
    for (const s of summary) {
      const captain = SQUADS[s.team]?.captain || "TBD";
      console.log(`  ${s.team}: ${s.cnt} players (C: ${captain})`);
      total += Number(s.cnt);
    }
    console.log(`\n  Total active: ${total} | Transfers: ${transferred} | New: ${added} | Updated: ${updated} | Deactivated: ${deactivated.rowCount}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("  ✗ Failed:", err.message, err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  updateSquads();
}

module.exports = { updateSquads };
