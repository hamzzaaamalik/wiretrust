/**
 * Seeds comprehensive 2026 player match stats for ALL completed matches
 * and adds more completed PSL matches for full team coverage.
 *
 * Usage: node db/seedFullStats.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { pool, testConnection } = require('./index');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];

function generateStats(role, tier) {
  const s = { runs: 0, balls_faced: 0, fours: 0, sixes: 0, wickets: 0, overs_bowled: 0, runs_conceded: 0, economy: 0, catches: 0 };

  if (role === 'BAT') {
    if (tier === 'star')    { s.runs = rand(30, 95); s.balls_faced = rand(22, 58); }
    else if (tier === 'mid') { s.runs = rand(12, 55); s.balls_faced = rand(10, 42); }
    else                     { s.runs = rand(3, 28);  s.balls_faced = rand(4, 24); }
    s.fours = Math.min(rand(1, Math.max(2, Math.floor(s.runs / 8))), Math.floor(s.runs / 4));
    s.sixes = rand(0, Math.min(5, Math.floor(s.runs / 12)));
    s.catches = rand(0, 1);
  } else if (role === 'BOWL') {
    s.runs = rand(0, 18); s.balls_faced = rand(1, 14);
    s.fours = rand(0, Math.min(2, Math.floor(s.runs / 6)));
    s.sixes = rand(0, 1);
    if (tier === 'star')    { s.wickets = rand(1, 5); s.overs_bowled = 4; s.runs_conceded = rand(18, 38); }
    else if (tier === 'mid') { s.wickets = rand(0, 3); s.overs_bowled = rand(3, 4); s.runs_conceded = rand(22, 44); }
    else                     { s.wickets = rand(0, 2); s.overs_bowled = rand(2, 4); s.runs_conceded = rand(26, 50); }
    s.economy = s.overs_bowled > 0 ? +(s.runs_conceded / s.overs_bowled).toFixed(2) : 0;
    s.catches = rand(0, 2);
  } else if (role === 'ALL') {
    if (tier === 'star')    { s.runs = rand(20, 70); s.balls_faced = rand(15, 45); s.wickets = rand(0, 3); }
    else if (tier === 'mid') { s.runs = rand(10, 45); s.balls_faced = rand(8, 32); s.wickets = rand(0, 2); }
    else                     { s.runs = rand(3, 28);  s.balls_faced = rand(4, 20);  s.wickets = rand(0, 2); }
    s.fours = Math.min(rand(1, Math.max(2, Math.floor(s.runs / 7))), Math.floor(s.runs / 4));
    s.sixes = rand(0, Math.min(4, Math.floor(s.runs / 11)));
    s.overs_bowled = rand(2, 4);
    s.runs_conceded = rand(16, 42);
    s.economy = +(s.runs_conceded / s.overs_bowled).toFixed(2);
    s.catches = rand(0, 2);
  } else if (role === 'WK') {
    if (tier === 'star')    { s.runs = rand(25, 80); s.balls_faced = rand(18, 50); }
    else if (tier === 'mid') { s.runs = rand(12, 50); s.balls_faced = rand(10, 38); }
    else                     { s.runs = rand(3, 28);  s.balls_faced = rand(4, 22); }
    s.fours = Math.min(rand(1, Math.max(2, Math.floor(s.runs / 7))), Math.floor(s.runs / 4));
    s.sixes = rand(0, Math.min(3, Math.floor(s.runs / 13)));
    s.catches = rand(1, 4);
  }

  // Calculate fantasy points
  s.fantasy_points =
    s.runs + s.fours + s.sixes * 2 + s.wickets * 25 + s.catches * 8 +
    (s.runs >= 100 ? 50 : s.runs >= 50 ? 20 : 0) +
    (s.wickets >= 5 ? 50 : s.wickets >= 3 ? 20 : 0) +
    (s.runs === 0 && s.balls_faced >= 5 && (role === 'BAT' || role === 'WK') ? -10 : 0);

  return s;
}

function getTier(credits) {
  if (credits >= 10) return 'star';
  if (credits >= 8) return 'mid';
  return 'low';
}

async function seedFullStats() {
  console.log('Seeding comprehensive 2026 season stats...');
  const ok = await testConnection();
  if (!ok) { console.error('Cannot seed — database unreachable.'); process.exit(1); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Step 1: Add more completed PSL matches for full team coverage ──
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const pslCompletedMatches = [
      // More PSL matches so every PSL team has 2-3 completed matches
      { id: 50, team1: 'Karachi Kings', team2: 'Multan Sultans', venue: 'National Stadium Karachi', days: -14, winner: 'Karachi Kings' },
      { id: 51, team1: 'Lahore Qalandars', team2: 'Peshawar Zalmi', venue: 'Gaddafi Stadium Lahore', days: -13, winner: 'Lahore Qalandars' },
      { id: 52, team1: 'Quetta Gladiators', team2: 'Islamabad United', venue: 'Quetta Cricket Ground', days: -12, winner: 'Quetta Gladiators' },
      { id: 53, team1: 'Hyderabad Kingsmen', team2: 'Karachi Kings', venue: 'Niaz Stadium Hyderabad', days: -11, winner: 'Karachi Kings' },
      { id: 54, team1: 'Multan Sultans', team2: 'Lahore Qalandars', venue: 'Multan Cricket Stadium', days: -10, winner: 'Multan Sultans' },
      { id: 55, team1: 'Rawalpindi Pindiz', team2: 'Quetta Gladiators', venue: 'Rawalpindi Cricket Stadium', days: -9, winner: 'Rawalpindi Pindiz' },
      { id: 56, team1: 'Islamabad United', team2: 'Hyderabad Kingsmen', venue: 'Rawalpindi Cricket Stadium', days: -8, winner: 'Islamabad United' },
      { id: 57, team1: 'Peshawar Zalmi', team2: 'Multan Sultans', venue: 'Arbab Niaz Stadium Peshawar', days: -7, winner: 'Peshawar Zalmi' },
      { id: 58, team1: 'Karachi Kings', team2: 'Lahore Qalandars', venue: 'National Stadium Karachi', days: -6, winner: 'Lahore Qalandars' },
      { id: 59, team1: 'Quetta Gladiators', team2: 'Hyderabad Kingsmen', venue: 'Quetta Cricket Ground', days: -5, winner: 'Quetta Gladiators' },
      { id: 60, team1: 'Rawalpindi Pindiz', team2: 'Peshawar Zalmi', venue: 'Rawalpindi Cricket Stadium', days: -4, winner: 'Peshawar Zalmi' },
      { id: 61, team1: 'Islamabad United', team2: 'Multan Sultans', venue: 'Rawalpindi Cricket Stadium', days: -3, winner: 'Islamabad United' },
    ];

    for (const m of pslCompletedMatches) {
      await client.query(
        `INSERT INTO matches (match_id, franchise_id, team1, team2, venue, start_time, status, result)
         VALUES ($1, 1, $2, $3, $4, $5, 'COMPLETED', $6)
         ON CONFLICT (match_id) DO UPDATE SET status='COMPLETED', result=$6`,
        [m.id, m.team1, m.team2, m.venue, new Date(now.getTime() + m.days * day), m.winner]
      );
    }
    console.log(`  ✓ Added ${pslCompletedMatches.length} completed PSL matches`);

    // ── Step 2: Seed player_match_stats for ALL completed matches ──
    const { rows: completedMatches } = await client.query(
      `SELECT match_id, team1, team2, result FROM matches WHERE status = 'COMPLETED' ORDER BY match_id`
    );
    console.log(`  Found ${completedMatches.length} completed matches to populate`);

    let totalInserted = 0;
    for (const match of completedMatches) {
      // Check if already seeded
      const { rows: existing } = await client.query(
        'SELECT count(*) as c FROM player_match_stats WHERE match_id = $1', [match.match_id]
      );
      if (Number(existing[0].c) > 0) {
        // Already has stats, skip
        continue;
      }

      // Get players for both teams
      const { rows: players } = await client.query(
        `SELECT player_id, name, team, role, credits FROM players
         WHERE active = true AND (LOWER(team) = LOWER($1) OR LOWER(team) = LOWER($2))
         ORDER BY credits DESC`,
        [match.team1, match.team2]
      );

      // Pick top 11 per team
      const team1Players = players.filter(p => p.team.toLowerCase() === match.team1.toLowerCase()).slice(0, 11);
      const team2Players = players.filter(p => p.team.toLowerCase() === match.team2.toLowerCase()).slice(0, 11);
      const matchPlayers = [...team1Players, ...team2Players];

      if (matchPlayers.length < 2) continue;

      // Give winning team's players slightly better stats
      for (const p of matchPlayers) {
        let tier = getTier(Number(p.credits));
        // Winning team bonus: upgrade tier for some players
        const isWinningTeam = p.team.toLowerCase() === (match.result || '').toLowerCase();
        if (isWinningTeam && tier === 'mid' && Math.random() > 0.5) tier = 'star';
        if (isWinningTeam && tier === 'low' && Math.random() > 0.5) tier = 'mid';

        const s = generateStats(p.role, tier);

        await client.query(
          `INSERT INTO player_match_stats (match_id, player_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, economy, catches, fantasy_points)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (match_id, player_id) DO NOTHING`,
          [match.match_id, p.player_id, s.runs, s.balls_faced, s.fours, s.sixes, s.wickets, s.overs_bowled, s.runs_conceded, s.economy, s.catches, s.fantasy_points]
        );
        totalInserted++;
      }

      // Also ensure match_players entries exist
      for (const p of matchPlayers) {
        await client.query(
          `INSERT INTO match_players (match_id, player_id, fantasy_points)
           VALUES ($1, $2, (SELECT fantasy_points FROM player_match_stats WHERE match_id=$1 AND player_id=$2))
           ON CONFLICT (match_id, player_id) DO UPDATE SET fantasy_points = EXCLUDED.fantasy_points`,
          [match.match_id, p.player_id]
        );
      }
    }
    console.log(`  ✓ Seeded ${totalInserted} new player_match_stats rows`);

    // ── Step 3: Recalculate ALL player aggregates ──
    await client.query(`
      UPDATE players SET
        matches_played = COALESCE(sub.cnt, 0),
        total_runs = COALESCE(sub.tot_runs, 0),
        total_wickets = COALESCE(sub.tot_wickets, 0),
        avg_fantasy_points = COALESCE(ROUND(sub.avg_fp, 1), 0),
        recent_form = COALESCE(ROUND(sub.recent_avg, 1), 0),
        batting_avg = CASE WHEN COALESCE(sub.cnt, 0) > 0 THEN ROUND(COALESCE(sub.tot_runs, 0)::numeric / sub.cnt, 1) ELSE 0 END,
        strike_rate = CASE WHEN COALESCE(sub.tot_balls, 0) > 0 THEN ROUND((COALESCE(sub.tot_runs, 0)::numeric / sub.tot_balls) * 100, 1) ELSE 0 END
      FROM (
        SELECT
          pms.player_id,
          COUNT(*) as cnt,
          SUM(pms.runs) as tot_runs,
          SUM(pms.wickets) as tot_wickets,
          AVG(pms.fantasy_points) as avg_fp,
          SUM(pms.balls_faced) as tot_balls,
          -- recent_form: avg of last 3 matches
          (SELECT AVG(r.fantasy_points) FROM (
            SELECT fantasy_points FROM player_match_stats
            WHERE player_id = pms.player_id
            ORDER BY created_at DESC LIMIT 3
          ) r) as recent_avg
        FROM player_match_stats pms
        GROUP BY pms.player_id
      ) sub
      WHERE players.player_id = sub.player_id
    `);
    console.log('  ✓ All player aggregates recalculated');

    await client.query('COMMIT');

    // ── Print summary ──
    const { rows: teamSummary } = await pool.query(`
      SELECT p.team,
        COUNT(DISTINCT p.player_id) as players,
        ROUND(AVG(p.matches_played), 1) as avg_matches,
        ROUND(AVG(p.avg_fantasy_points), 1) as avg_fp,
        MAX(p.recent_form) as top_form
      FROM players p
      WHERE p.matches_played > 0
      GROUP BY p.team
      ORDER BY avg_fp DESC
    `);
    console.log('\nTeam Intelligence Summary:');
    console.log('─'.repeat(80));
    teamSummary.forEach(t =>
      console.log(`  ${t.team.padEnd(22)} | ${t.players} players | ${t.avg_matches} avg matches | ${t.avg_fp} avg FP | top form: ${t.top_form}`)
    );

    const { rows: topPlayers } = await pool.query(`
      SELECT name, team, role, matches_played, avg_fantasy_points, recent_form, batting_avg, strike_rate, total_wickets
      FROM players WHERE matches_played > 0
      ORDER BY recent_form DESC LIMIT 15
    `);
    console.log('\nTop 15 Players by Recent Form:');
    console.log('─'.repeat(100));
    topPlayers.forEach(p =>
      console.log(`  ${p.name.padEnd(22)} ${p.team.padEnd(22)} ${p.role.padEnd(5)} | ${p.matches_played}m | ${p.recent_form} form | ${p.avg_fantasy_points} avg FP | ${p.batting_avg} bat avg | SR ${p.strike_rate} | ${p.total_wickets} wkts`)
    );

    const { rows: matchStats } = await pool.query(`
      SELECT team,
        COUNT(*) FILTER (WHERE result = team) AS wins,
        COUNT(*) AS total
      FROM (
        SELECT team1 AS team, result FROM matches WHERE status = 'COMPLETED'
        UNION ALL
        SELECT team2 AS team, result FROM matches WHERE status = 'COMPLETED'
      ) sub
      GROUP BY team ORDER BY COUNT(*) FILTER (WHERE result = team) DESC
    `);
    console.log('\nTeam Win Rates:');
    console.log('─'.repeat(60));
    matchStats.forEach(t => {
      const rate = t.total > 0 ? Math.round((t.wins / t.total) * 100) : 0;
      console.log(`  ${t.team.padEnd(22)} ${t.wins}W-${t.total - t.wins}L (${rate}%)`);
    });

    console.log('\nFull 2026 season stats seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ✗ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedFullStats();
}

module.exports = { seedFullStats };
