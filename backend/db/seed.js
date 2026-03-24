/**
 * Seeds the database with initial PSL data.
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Usage: node db/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { pool, testConnection } = require('./index');

async function seed() {
  console.log('Seeding database...');
  const ok = await testConnection();
  if (!ok) {
    console.error('Cannot seed — database unreachable.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Matches ──────────────────────────────────────────────
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const matchRows = [
      [4, 1, 'The Pindiz', 'Karachi Kings', 'Rawalpindi Cricket Stadium', new Date(now.getTime() + 2 * day), 'UPCOMING'],
      [5, 1, 'The Pindiz', 'Lahore Qalandars', 'Rawalpindi Cricket Stadium', new Date(now.getTime() + 3 * day), 'UPCOMING'],
      [6, 1, 'Quetta Gladiators', 'The Pindiz', 'Quetta Stadium', new Date(now.getTime() + 5 * day), 'UPCOMING'],
    ];
    for (const m of matchRows) {
      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id) DO UPDATE SET start_time = $6, status = $7`,
        m
      );
    }
    console.log('  ✓ Matches seeded (3 rows)');

    // ── Players ──────────────────────────────────────────────
    const playerRows = [
      // The Pindiz
      [1,  'Babar Azam',      'The Pindiz',    'BAT',  12],
      [2,  'Shadab Khan',     'The Pindiz',    'ALL',  10],
      [3,  'Azam Khan',       'The Pindiz',    'WK',   8.5],
      [4,  'Naseem Shah',     'The Pindiz',    'BOWL', 9],
      [5,  'Faheem Ashraf',   'The Pindiz',    'ALL',  8],
      [6,  'Hasan Ali',       'The Pindiz',    'BOWL', 7.5],
      [7,  'Asif Ali',        'The Pindiz',    'BAT',  7],
      [8,  'Iftikhar Ahmed',  'The Pindiz',    'ALL',  8],
      [9,  'Rumman Raees',    'The Pindiz',    'BOWL', 6.5],
      [10, 'Hussain Talat',   'The Pindiz',    'BAT',  7],
      [11, 'Zeeshan Zameer',  'The Pindiz',    'BOWL', 6.5],
      // Karachi Kings
      [12, 'Fakhar Zaman',    'Karachi Kings', 'BAT',  11],
      [13, 'Shaheen Afridi',  'Karachi Kings', 'BOWL', 10.5],
      [14, 'Imad Wasim',      'Karachi Kings', 'ALL',  9],
      [15, 'Sharjeel Khan',   'Karachi Kings', 'BAT',  9.5],
      [16, 'Mohammad Amir',   'Karachi Kings', 'BOWL', 8.5],
      [17, 'Sarfaraz Ahmed',  'Karachi Kings', 'WK',   8],
      [18, 'Shan Masood',     'Karachi Kings', 'BAT',  8],
      [19, 'Usama Mir',       'Karachi Kings', 'BOWL', 7],
      [20, 'Aamer Yamin',     'Karachi Kings', 'ALL',  6.5],
      [21, 'Mir Hamza',       'Karachi Kings', 'BOWL', 6.5],
      [22, 'Irfan Khan',      'Karachi Kings', 'BAT',  6],
    ];
    for (const p of playerRows) {
      await client.query(
        `INSERT INTO players (player_id, name, team, role, credits)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id) DO NOTHING`,
        p
      );
    }
    console.log('  ✓ Players seeded (22 rows)');

    // ── Match-Players mapping (batch) ─────────────────────────
    const mpValues = [];
    const mpParams = [];
    let mpIdx = 1;
    // Match 4: all 22 players
    for (const pid of playerRows.map(r => r[0])) {
      mpValues.push(`($${mpIdx++}, $${mpIdx++})`);
      mpParams.push(4, pid);
    }
    // Match 5 & 6: Pindiz players (1-11)
    for (let pid = 1; pid <= 11; pid++) {
      mpValues.push(`($${mpIdx++}, $${mpIdx++})`);
      mpParams.push(5, pid);
      mpValues.push(`($${mpIdx++}, $${mpIdx++})`);
      mpParams.push(6, pid);
    }
    await client.query(
      `INSERT INTO match_players (match_id, player_id) VALUES ${mpValues.join(', ')} ON CONFLICT DO NOTHING`,
      mpParams
    );
    console.log('  ✓ Match-players mapped');

    // ── Challenges ───────────────────────────────────────────
    const challengeRows = [
      // TICKETS
      ['tkt-match-day', 1, 'Match Day Access', 'Make 3 predictions on any match to unlock a match ticket.', 'TICKET', 'PREDICTIONS_MADE', 3, 'Pindiz vs Karachi Kings — GA Ticket', 'General admission ticket earned through fan engagement.', 0, 0, Math.floor(Date.now() / 1000) + 7 * 86400, 50],
      ['tkt-vip', 1, 'VIP Box Unlock', 'Earn 500+ prediction points to unlock a VIP box ticket.', 'TICKET', 'PREDICTION_POINTS', 500, 'Pindiz VIP Box — Earned Pass', 'VIP box access earned by top predictors.', 0, 0, Math.floor(Date.now() / 1000) + 14 * 86400, 10],
      // EXPERIENCES
      ['exp-fan-zone', 1, 'Fan Zone VIP', 'Join 3 squad challenges to unlock Fan Zone VIP access.', 'EXPERIENCE', 'FANTASY_JOINS', 3, 'Fan Zone VIP Pass', 'Exclusive fan zone access earned through squad challenge participation.', 1, 0, Math.floor(Date.now() / 1000) + 10 * 86400, 20],
      ['exp-meet-greet', 1, 'Player Meet & Greet', 'Build a 5x prediction streak to meet the players.', 'EXPERIENCE', 'PREDICTION_STREAK', 5, 'Player Meet & Greet Pass', 'Meet the Pindiz squad. Earned by prediction masters.', 1, 0, Math.floor(Date.now() / 1000) + 21 * 86400, 5],
      // COLLECTIBLES
      ['col-babar-card', 1, 'Babar Azam Gold Card', 'Get 5 predictions correct to earn the Babar Azam Gold Card.', 'COLLECTIBLE', 'CORRECT_PREDICTIONS', 5, 'Babar Azam Gold Card', 'Limited edition player card. Proof of prediction skill.', 2, 0, 0, 100],
      ['col-season-card', 1, 'Season 2026 Collector', 'Join 5 squad challenges to earn the Season 2026 Highlights card.', 'COLLECTIBLE', 'FANTASY_JOINS', 5, 'Pindiz Season 2026 Highlights', 'Season highlights card. Earned by dedicated squad challenge players.', 2, 0, 0, 50],
      // BADGES
      ['bdg-first-agent', 1, 'Bot Builder', 'Deploy your first AI agent on WireTrust.', 'BADGE', 'AGENT_CREATED', 1, 'Bot Builder Badge', 'Soulbound badge. Deployed first AI agent on WireTrust.', 3, 0, 0, 0],
      ['bdg-oracle', 1, 'Oracle Fan', 'Make 10 predictions to prove your dedication.', 'BADGE', 'PREDICTIONS_MADE', 10, 'Oracle Fan Badge', 'Soulbound badge. 10+ predictions made on WireTrust.', 3, 0, 0, 0],
      ['bdg-safe-agent', 1, 'Trusted Agent', 'Get any agent to 70+ reputation score (SAFE tier).', 'BADGE', 'REPUTATION_SCORE', 70, 'Trusted Agent Badge', 'Soulbound badge. Agent reached SAFE reputation tier.', 3, 0, 0, 0],
      ['bdg-streak3', 1, 'Hot Streak', 'Get 3 predictions correct in a row.', 'BADGE', 'PREDICTION_STREAK', 3, 'Hot Streak x3 Badge', 'Soulbound badge. 3 correct predictions in a row.', 3, 0, 0, 0],
      // MERCHANDISE
      ['mrch-jersey', 1, 'Official Jersey Auth', 'Earn 3 badges to unlock official Pindiz jersey authentication.', 'MERCHANDISE', 'NFTS_EARNED', 3, 'Official Pindiz Jersey 2026 — Auth Token', 'Authentic merchandise token. Earned through fan achievement.', 4, 0, 0, 30],
      ['mrch-signed-cap', 1, 'Signed Cap Auth', 'Score 1000+ prediction points to unlock a signed Babar Azam cap.', 'MERCHANDISE', 'PREDICTION_POINTS', 1000, 'Signed Babar Azam Cap — Auth Token', 'Authentic signed cap token. Earned by top-tier predictors.', 4, 0, 0, 5],
    ];
    for (const c of challengeRows) {
      await client.query(
        `INSERT INTO challenges (id, franchise_id, name, description, category, condition_type, condition_target, reward_name, reward_description, reward_category, reward_face_price, reward_event_timestamp, max_claims)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        c
      );
    }
    console.log('  ✓ Challenges seeded (12 rows)');

    // ── Live match state ─────────────────────────────────────
    await client.query(
      `INSERT INTO live_match_state (match_id, team1, team2, innings, overs, score, batting, bowling, current_batsman, current_bowler, run_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (match_id) DO UPDATE SET
         overs = $5, score = $6, current_batsman = $9, current_bowler = $10, run_rate = $11, updated_at = NOW()`,
      [4, 'The Pindiz', 'Karachi Kings', 1, '12.3', '98/2', 'The Pindiz', 'Karachi Kings', 'Babar Azam', 'Shaheen Afridi', '7.84']
    );
    console.log('  ✓ Live match state seeded');

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
