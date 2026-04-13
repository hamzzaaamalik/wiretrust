/**
 * Database migration — creates all tables.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: node db/migrate.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { pool, testConnection } = require('./index');

const SCHEMA = `
-- Users: wallet addresses and login metadata
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  address       VARCHAR(42) NOT NULL UNIQUE,
  wallet_type   VARCHAR(20) NOT NULL DEFAULT 'metamask',  -- metamask | web3auth
  funded        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_address ON users (address);

-- Matches: PSL match schedule
CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  match_id      INTEGER NOT NULL UNIQUE,       -- on-chain matchId
  franchise_id  INTEGER NOT NULL DEFAULT 1,
  team1         VARCHAR(100) NOT NULL,
  team2         VARCHAR(100) NOT NULL,
  venue         VARCHAR(200),
  start_time    TIMESTAMPTZ,
  status        VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',  -- UPCOMING | LIVE | COMPLETED | ABANDONED
  result        VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players: cricket player roster
CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  player_id     INTEGER NOT NULL UNIQUE,       -- on-chain playerId
  name          VARCHAR(100) NOT NULL,
  team          VARCHAR(100) NOT NULL,
  role          VARCHAR(10) NOT NULL,           -- BAT | BOWL | ALL | WK
  credits       NUMERIC(5,1) NOT NULL DEFAULT 7,
  image_url     VARCHAR(500),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match players: which players are in which match
CREATE TABLE IF NOT EXISTS match_players (
  match_id      INTEGER NOT NULL REFERENCES matches(match_id),
  player_id     INTEGER NOT NULL REFERENCES players(player_id),
  fantasy_points INTEGER,                      -- scored points after settlement
  PRIMARY KEY (match_id, player_id)
);

-- Challenges: franchise challenge definitions
CREATE TABLE IF NOT EXISTS challenges (
  id            VARCHAR(50) PRIMARY KEY,
  franchise_id  INTEGER NOT NULL DEFAULT 1,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  category      VARCHAR(20) NOT NULL,           -- TICKET | EXPERIENCE | COLLECTIBLE | BADGE | MERCHANDISE
  condition_type VARCHAR(50) NOT NULL,           -- PREDICTIONS_MADE, PREDICTION_STREAK, etc.
  condition_target INTEGER NOT NULL,
  reward_name   VARCHAR(200) NOT NULL,
  reward_description TEXT,
  reward_metadata_uri VARCHAR(500) DEFAULT '',
  reward_category INTEGER NOT NULL DEFAULT 3,   -- NFT category enum
  reward_face_price INTEGER NOT NULL DEFAULT 0,
  reward_event_timestamp BIGINT DEFAULT 0,
  max_claims    INTEGER NOT NULL DEFAULT 0,      -- 0 = unlimited
  expires_at    TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenge claims: tracks who claimed what
CREATE TABLE IF NOT EXISTS challenge_claims (
  id            SERIAL PRIMARY KEY,
  challenge_id  VARCHAR(50) NOT NULL REFERENCES challenges(id),
  address       VARCHAR(42) NOT NULL,
  token_id      INTEGER,                        -- minted NFT token ID
  tx_hash       VARCHAR(66),
  claimed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(challenge_id, address)
);
CREATE INDEX IF NOT EXISTS idx_claims_address ON challenge_claims (address);

-- Faucet history: persistent across restarts
CREATE TABLE IF NOT EXISTS faucet_history (
  id            SERIAL PRIMARY KEY,
  address       VARCHAR(42) NOT NULL UNIQUE,
  amount        VARCHAR(50) NOT NULL DEFAULT '0.1',
  tx_hash       VARCHAR(66),
  funded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faucet_address ON faucet_history (address);

-- Player match stats: per-player per-match historical performance
CREATE TABLE IF NOT EXISTS player_match_stats (
  match_id       INTEGER NOT NULL,
  player_id      INTEGER NOT NULL,
  runs           INTEGER DEFAULT 0,
  balls_faced    INTEGER DEFAULT 0,
  fours          INTEGER DEFAULT 0,
  sixes          INTEGER DEFAULT 0,
  wickets        INTEGER DEFAULT 0,
  overs_bowled   NUMERIC(4,1) DEFAULT 0,
  runs_conceded  INTEGER DEFAULT 0,
  economy        NUMERIC(5,2) DEFAULT 0,
  catches        INTEGER DEFAULT 0,
  fantasy_points INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (match_id, player_id)
);

-- Player aggregate stats columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_wickets INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_fantasy_points NUMERIC(6,1) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS recent_form NUMERIC(6,1) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS batting_avg NUMERIC(6,1) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS strike_rate NUMERIC(6,1) DEFAULT 0;

-- Agent autonomous runs: persisted decision log
CREATE TABLE IF NOT EXISTS agent_runs (
  id            SERIAL PRIMARY KEY,
  agent_id      INTEGER NOT NULL,
  type          VARCHAR(20) NOT NULL DEFAULT 'info',    -- info | decision | success | error | violation | warning
  action        VARCHAR(50) NOT NULL,                    -- PREDICT | JOIN_CONTEST | INTELLIGENCE | STATUS | ANALYZE etc.
  outcome       TEXT,
  reasoning     TEXT,
  tx_hash       VARCHAR(66),
  gas_used      VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs (agent_id, created_at DESC);

-- Active agents: persisted for auto-resume on server restart
CREATE TABLE IF NOT EXISTS active_agents (
  agent_id      INTEGER PRIMARY KEY,
  config        JSONB NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contest sponsors: sponsor branding per contest
CREATE TABLE IF NOT EXISTS contest_sponsors (
  contest_id    INTEGER PRIMARY KEY,
  sponsor_name  VARCHAR(200) NOT NULL,
  sponsor_logo  VARCHAR(500),                    -- URL to sponsor logo/banner
  banner_url    VARCHAR(500),                    -- URL to contest banner image
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live match state: for demo/admin updates
CREATE TABLE IF NOT EXISTS live_match_state (
  match_id      INTEGER PRIMARY KEY,
  team1         VARCHAR(100) NOT NULL,
  team2         VARCHAR(100) NOT NULL,
  innings       INTEGER DEFAULT 1,
  overs         VARCHAR(10),
  score         VARCHAR(20),
  batting       VARCHAR(100),
  bowling       VARCHAR(100),
  current_batsman VARCHAR(100),
  current_bowler  VARCHAR(100),
  run_rate      VARCHAR(10),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  console.log('Running database migration...');
  const ok = await testConnection();
  if (!ok) {
    console.error('Cannot migrate — database unreachable.');
    process.exit(1);
  }

  try {
    await pool.query(SCHEMA);
    console.log('  ✓ All tables created successfully');
  } catch (err) {
    console.error('  ✗ Migration failed:', err.message);
    process.exit(1);
  }

  await pool.end();
  console.log('Migration complete.');
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, SCHEMA };
