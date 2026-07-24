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
        caption_pref TEXT DEFAULT 'full',
        notify_pref TEXT DEFAULT 'instant',
        is_banned INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure columns exist on pre-existing users tables
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS caption_pref TEXT DEFAULT 'full';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_pref TEXT DEFAULT 'instant';
    `);

    // Create downloads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        file_id TEXT,
        downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Ensure file_id column exists if table already existed
    await client.query(`
      ALTER TABLE downloads ADD COLUMN IF NOT EXISTS file_id TEXT
    `);

    // Create logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create funnel_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS funnel_events (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        event_type VARCHAR(50) NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        user_id BIGINT PRIMARY KEY,
        session_data JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes if they do not exist
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_downloads_user_date ON downloads(user_id, downloaded_at)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_funnel_events_type ON funnel_events(event_type)`
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
