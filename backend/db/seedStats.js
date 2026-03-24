/**
 * Seeds historical player match stats for AI agent intelligence.
 * Marks matches 1-3 as COMPLETED and populates player_match_stats
 * with realistic cricket performance data.
 *
 * Usage: node db/seedStats.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { pool, testConnection } = require('./index');

// Realistic stat generator by role
function generateStats(role, tier) {
  // tier: 'star' (high credits), 'mid', 'low'
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const stats = { runs: 0, balls_faced: 0, fours: 0, sixes: 0, wickets: 0, overs_bowled: 0, runs_conceded: 0, economy: 0, catches: 0 };

  if (role === 'BAT') {
    if (tier === 'star')    { stats.runs = rand(35, 92); stats.balls_faced = rand(25, 55); }
    else if (tier === 'mid') { stats.runs = rand(15, 50); stats.balls_faced = rand(12, 40); }
    else                     { stats.runs = rand(5, 25);  stats.balls_faced = rand(5, 22); }
    stats.fours = Math.min(rand(2, Math.floor(stats.runs / 8)), Math.floor(stats.runs / 4));
    stats.sixes = rand(0, Math.min(4, Math.floor(stats.runs / 15)));
    stats.catches = rand(0, 1);
  } else if (role === 'BOWL') {
    stats.runs = rand(0, 15); stats.balls_faced = rand(2, 12);
    stats.fours = rand(0, Math.min(2, Math.floor(stats.runs / 6)));
    stats.sixes = rand(0, 1);
    if (tier === 'star')    { stats.wickets = rand(2, 4); stats.overs_bowled = 4; stats.runs_conceded = rand(22, 38); }
    else if (tier === 'mid') { stats.wickets = rand(1, 3); stats.overs_bowled = rand(3, 4); stats.runs_conceded = rand(25, 42); }
    else                     { stats.wickets = rand(0, 2); stats.overs_bowled = rand(2, 4); stats.runs_conceded = rand(28, 48); }
    stats.economy = stats.overs_bowled > 0 ? +(stats.runs_conceded / stats.overs_bowled).toFixed(2) : 0;
    stats.catches = rand(0, 2);
  } else if (role === 'ALL') {
    if (tier === 'star')    { stats.runs = rand(25, 65); stats.balls_faced = rand(18, 40); stats.wickets = rand(1, 3); }
    else if (tier === 'mid') { stats.runs = rand(12, 40); stats.balls_faced = rand(10, 30); stats.wickets = rand(0, 2); }
    else                     { stats.runs = rand(5, 25);  stats.balls_faced = rand(5, 18);  stats.wickets = rand(0, 2); }
    stats.fours = Math.min(rand(1, Math.floor(stats.runs / 7)), Math.floor(stats.runs / 4));
    stats.sixes = rand(0, Math.min(3, Math.floor(stats.runs / 12)));
    stats.overs_bowled = rand(2, 4);
    stats.runs_conceded = rand(18, 40);
    stats.economy = +(stats.runs_conceded / stats.overs_bowled).toFixed(2);
    stats.catches = rand(0, 2);
  } else if (role === 'WK') {
    if (tier === 'star')    { stats.runs = rand(30, 75); stats.balls_faced = rand(22, 48); }
    else if (tier === 'mid') { stats.runs = rand(15, 45); stats.balls_faced = rand(12, 35); }
    else                     { stats.runs = rand(5, 25);  stats.balls_faced = rand(5, 20); }
    stats.fours = Math.min(rand(2, Math.floor(stats.runs / 7)), Math.floor(stats.runs / 4));
    stats.sixes = rand(0, Math.min(3, Math.floor(stats.runs / 14)));
    stats.catches = rand(1, 3); // WK catches more
  }

  // Calculate fantasy points
  stats.fantasy_points =
    stats.runs +
    stats.fours +
    stats.sixes * 2 +
    stats.wickets * 25 +
    stats.catches * 8 +
    (stats.runs >= 100 ? 50 : stats.runs >= 50 ? 20 : 0) +
    (stats.wickets >= 5 ? 50 : stats.wickets >= 3 ? 20 : 0) +
    (stats.runs === 0 && stats.balls_faced >= 5 && (role === 'BAT' || role === 'WK') ? -10 : 0);

  return stats;
}

function getTier(credits) {
  if (credits >= 10) return 'star';
  if (credits >= 8) return 'mid';
  return 'low';
}

async function seedStats() {
  console.log('Seeding historical player match stats...');
  const ok = await testConnection();
  if (!ok) { console.error('Cannot seed — database unreachable.'); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark first 3 matches as COMPLETED
    const matchResults = [
      { id: 1, winner: 'Rawalpindi Pindiz' },   // Pindiz beat Peshawar
      { id: 2, winner: 'Rawalpindi Pindiz' },   // Pindiz beat Karachi
      { id: 3, winner: 'Islamabad United' },     // Islamabad beat Pindiz
    ];

    for (const m of matchResults) {
      await client.query(
        `UPDATE matches SET status = 'COMPLETED', result = $2 WHERE match_id = $1`,
        [m.id, m.winner]
      );
    }
    console.log('  ✓ Matches 1-3 marked as COMPLETED');

    // Get teams for each match
    const matchTeams = {};
    for (const m of matchResults) {
      const { rows } = await client.query('SELECT team1, team2 FROM matches WHERE match_id = $1', [m.id]);
      if (rows[0]) matchTeams[m.id] = rows[0];
    }

    // For each completed match, get players from both teams and generate stats
    let totalInserted = 0;
    for (const m of matchResults) {
      const teams = matchTeams[m.id];
      if (!teams) continue;

      const { rows: players } = await client.query(
        `SELECT player_id, name, team, role, credits FROM players
         WHERE active = true AND (LOWER(team) = LOWER($1) OR LOWER(team) = LOWER($2))
         ORDER BY credits DESC`,
        [teams.team1, teams.team2]
      );

      // Pick top 11 per team (realistic match squad)
      const team1Players = players.filter(p => p.team.toLowerCase() === teams.team1.toLowerCase()).slice(0, 11);
      const team2Players = players.filter(p => p.team.toLowerCase() === teams.team2.toLowerCase()).slice(0, 11);
      const matchPlayers = [...team1Players, ...team2Players];

      for (const p of matchPlayers) {
        const tier = getTier(Number(p.credits));
        const s = generateStats(p.role, tier);

        await client.query(
          `INSERT INTO player_match_stats (match_id, player_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, economy, catches, fantasy_points)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (match_id, player_id) DO UPDATE SET
             runs=$3, balls_faced=$4, fours=$5, sixes=$6, wickets=$7, overs_bowled=$8, runs_conceded=$9, economy=$10, catches=$11, fantasy_points=$12`,
          [m.id, p.player_id, s.runs, s.balls_faced, s.fours, s.sixes, s.wickets, s.overs_bowled, s.runs_conceded, s.economy, s.catches, s.fantasy_points]
        );
        totalInserted++;
      }
    }
    console.log(`  ✓ player_match_stats seeded (${totalInserted} rows across 3 matches)`);

    // Update player aggregate columns from seeded stats
    await client.query(`
      UPDATE players SET
        matches_played = sub.cnt,
        total_runs = sub.tot_runs,
        total_wickets = sub.tot_wickets,
        avg_fantasy_points = ROUND(sub.avg_fp, 1),
        recent_form = ROUND(sub.avg_fp, 1),
        batting_avg = CASE WHEN sub.cnt > 0 THEN ROUND(sub.tot_runs::numeric / sub.cnt, 1) ELSE 0 END,
        strike_rate = CASE WHEN sub.tot_balls > 0 THEN ROUND((sub.tot_runs::numeric / sub.tot_balls) * 100, 1) ELSE 0 END
      FROM (
        SELECT player_id,
          COUNT(*) as cnt,
          COALESCE(SUM(runs), 0) as tot_runs,
          COALESCE(SUM(wickets), 0) as tot_wickets,
          COALESCE(AVG(fantasy_points), 0) as avg_fp,
          COALESCE(SUM(balls_faced), 0) as tot_balls
        FROM player_match_stats
        GROUP BY player_id
      ) sub
      WHERE players.player_id = sub.player_id
    `);
    console.log('  ✓ Player aggregate columns updated');

    // Ensure match_players entries exist for completed matches
    for (const m of matchResults) {
      const teams = matchTeams[m.id];
      if (!teams) continue;
      const { rows: statRows } = await client.query(
        `SELECT player_id FROM player_match_stats WHERE match_id = $1`, [m.id]
      );
      for (const r of statRows) {
        await client.query(
          `INSERT INTO match_players (match_id, player_id, fantasy_points)
           VALUES ($1, $2, (SELECT fantasy_points FROM player_match_stats WHERE match_id=$1 AND player_id=$2))
           ON CONFLICT (match_id, player_id) DO UPDATE SET fantasy_points = EXCLUDED.fantasy_points`,
          [m.id, r.player_id]
        );
      }
    }
    console.log('  ✓ match_players updated with fantasy points');

    await client.query('COMMIT');
    console.log('Stats seed complete.');

    // Print summary
    const { rows: summary } = await pool.query(`
      SELECT p.name, p.team, p.role, p.matches_played, p.total_runs, p.total_wickets,
             p.avg_fantasy_points, p.batting_avg, p.strike_rate
      FROM players p WHERE p.matches_played > 0 ORDER BY p.avg_fantasy_points DESC LIMIT 10
    `);
    console.log('\nTop 10 by avg fantasy points:');
    summary.forEach(r => console.log(`  ${r.name} (${r.team}) — ${r.matches_played} matches, ${r.avg_fantasy_points} avg FP, ${r.total_runs} runs, ${r.total_wickets} wkts, SR ${r.strike_rate}`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ✗ Stats seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedStats();
}

module.exports = { seedStats };
