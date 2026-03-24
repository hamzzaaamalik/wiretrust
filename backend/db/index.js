const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Cloud SQL over public IP — disable SSL for now (testnet)
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err.message);
});

// Helper: run a single query
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`Slow query (${duration}ms):`, text.slice(0, 80));
  }
  return result;
}

// Helper: get a client for transactions
async function getClient() {
  return pool.connect();
}

// Test connection
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`  ✓ PostgreSQL connected at ${new Date(res.rows[0].now).toISOString()}`);
    return true;
  } catch (err) {
    console.error('  ✗ PostgreSQL connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, query, getClient, testConnection };
