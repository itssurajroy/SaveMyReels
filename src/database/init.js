const { Pool } = require("pg");
const config = require("../config");

let pool;

/**
 * Initialize Postgres Connection Pool and create tables.
 */
async function initDatabase() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not set in configuration!");
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: {
      rejectUnauthorized: false, // Required for Neon / Supabase connection ssl
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Verify connection
  const client = await pool.connect();
  try {
    console.log("✅ Connected to Postgres database");

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        referred_by BIGINT,
        referral_count INTEGER DEFAULT 0,
        is_premium INTEGER DEFAULT 0,
        premium_expires TIMESTAMP WITH TIME ZONE,
        quality_pref TEXT DEFAULT 'hd',
        is_banned INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create downloads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create indexes if they do not exist
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_downloads_user_date ON downloads(user_id, downloaded_at)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`
    );

    console.log("✅ Database schema verified");
  } finally {
    client.release();
  }

  return pool;
}

/**
 * Get the connection pool. Must call initDatabase() first.
 */
function getPool() {
  if (!pool) {
    throw new Error("Database pool not initialized. Call initDatabase() first.");
  }
  return pool;
}

/**
 * Close pool connection.
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log("📦 Postgres pool closed");
  }
}

module.exports = { initDatabase, getPool, closeDatabase };
