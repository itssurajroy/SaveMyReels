const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const config = require("../config");

let db;

/**
 * Initialize the SQLite database using sql.js (pure JS, no native deps).
 * Loads existing DB from disk if available, otherwise creates new.
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(fileBuffer);
    console.log("✅ Database loaded from disk");
  } else {
    db = new SQL.Database();
    console.log("✅ New database created");
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      referred_by INTEGER,
      referral_count INTEGER DEFAULT 0,
      is_premium INTEGER DEFAULT 0,
      premium_expires TEXT,
      quality_pref TEXT DEFAULT 'hd',
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      downloaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes for performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_downloads_user_date 
    ON downloads(user_id, downloaded_at)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_referred_by 
    ON users(referred_by)
  `);

  // Save to disk
  saveDatabase();

  return db;
}

/**
 * Get the database instance. Must call initDatabase() first.
 */
function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

/**
 * Save the in-memory database to disk.
 * Call this after any write operations.
 */
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  } catch (err) {
    console.error("❌ Failed to save database:", err.message);
  }
}

/**
 * Close the database connection gracefully.
 */
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    console.log("📦 Database connection closed");
  }
}

module.exports = { initDatabase, getDb, saveDatabase, closeDatabase };
