const { getDb, saveDatabase } = require("./init");

// ─── Helper ──────────────────────────────────────────────────

/**
 * Run a SELECT query and return all matching rows as an array of objects.
 */
function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Run a SELECT query and return the first matching row as an object, or null.
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Run an INSERT/UPDATE/DELETE query. Saves to disk after writes.
 */
function execute(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
}

// ─── User Operations ─────────────────────────────────────────

/**
 * Create a new user or ignore if already exists.
 */
function createUser(id, username, firstName, referredBy = null) {
  const existing = getUser(id);
  if (existing) return false; // Already exists

  execute(
    `INSERT INTO users (id, username, first_name, referred_by) VALUES (?, ?, ?, ?)`,
    [id, username, firstName, referredBy]
  );

  // If they have a referrer, increment referrer's count
  if (referredBy) {
    incrementReferralCount(referredBy);
  }

  return true; // New user created
}

/**
 * Get a user by their Telegram ID.
 */
function getUser(id) {
  return queryOne("SELECT * FROM users WHERE id = ?", [id]);
}

/**
 * Check if a user exists.
 */
function userExists(id) {
  const row = queryOne("SELECT 1 as found FROM users WHERE id = ?", [id]);
  return !!row;
}

/**
 * Update user's username and first_name (they can change on Telegram).
 */
function updateUserInfo(id, username, firstName) {
  execute(
    "UPDATE users SET username = ?, first_name = ? WHERE id = ?",
    [username, firstName, id]
  );
}

/**
 * Ban a user.
 */
function banUser(id) {
  execute("UPDATE users SET is_banned = 1 WHERE id = ?", [id]);
}

/**
 * Unban a user.
 */
function unbanUser(id) {
  execute("UPDATE users SET is_banned = 0 WHERE id = ?", [id]);
}

/**
 * Set user's video quality preference.
 */
function setQualityPref(id, quality) {
  execute("UPDATE users SET quality_pref = ? WHERE id = ?", [quality, id]);
}

// ─── Referral Operations ─────────────────────────────────────

/**
 * Increment referral count for a user.
 */
function incrementReferralCount(userId) {
  execute(
    "UPDATE users SET referral_count = referral_count + 1 WHERE id = ?",
    [userId]
  );
}

/**
 * Get referral stats for a user.
 */
function getReferralStats(userId) {
  const config = require("../config");
  const user = queryOne(
    "SELECT referral_count FROM users WHERE id = ?",
    [userId]
  );
  return {
    count: user ? user.referral_count : 0,
    bonusDownloads: user ? user.referral_count * config.referralBonus : 0,
  };
}

// ─── Premium Operations ──────────────────────────────────────

/**
 * Activate premium for a user for N days.
 */
function activatePremium(userId, days) {
  execute(
    `UPDATE users 
     SET is_premium = 1, 
         premium_expires = datetime('now', '+' || ? || ' days')
     WHERE id = ?`,
    [days, userId]
  );
}

/**
 * Check if a user's premium is currently active.
 */
function isPremiumActive(userId) {
  const user = queryOne(
    "SELECT is_premium, premium_expires FROM users WHERE id = ?",
    [userId]
  );

  if (!user || !user.is_premium) return false;

  // Check if premium has expired
  if (user.premium_expires) {
    const expiresAt = new Date(user.premium_expires + "Z");
    if (expiresAt <= new Date()) {
      // Premium expired, deactivate it
      execute(
        "UPDATE users SET is_premium = 0, premium_expires = NULL WHERE id = ?",
        [userId]
      );
      return false;
    }
  }

  return true;
}

/**
 * Get premium expiry date for a user.
 */
function getPremiumExpiry(userId) {
  const user = queryOne(
    "SELECT premium_expires FROM users WHERE id = ?",
    [userId]
  );
  return user ? user.premium_expires : null;
}

// ─── Download Operations ─────────────────────────────────────

/**
 * Log a download for a user.
 */
function logDownload(userId, url, platform) {
  execute(
    "INSERT INTO downloads (user_id, url, platform) VALUES (?, ?, ?)",
    [userId, url, platform]
  );
}

/**
 * Get the number of downloads a user has made today (UTC).
 */
function getDailyDownloadCount(userId) {
  const row = queryOne(
    `SELECT COUNT(*) as count FROM downloads 
     WHERE user_id = ? AND date(downloaded_at) = date('now')`,
    [userId]
  );
  return row ? row.count : 0;
}

/**
 * Get the daily download limit for a user.
 * Base limit + (referral_count * bonus), or Infinity if premium.
 */
function getDailyLimit(userId) {
  const config = require("../config");
  if (isPremiumActive(userId)) return Infinity;

  const user = queryOne(
    "SELECT referral_count FROM users WHERE id = ?",
    [userId]
  );
  const referralCount = user ? user.referral_count : 0;

  return config.dailyFreeLimit + referralCount * config.referralBonus;
}

/**
 * Get recent download history for a user.
 */
function getDownloadHistory(userId, limit = 10) {
  return queryAll(
    `SELECT url, platform, downloaded_at FROM downloads 
     WHERE user_id = ? ORDER BY downloaded_at DESC LIMIT ?`,
    [userId, limit]
  );
}

// ─── Admin / Stats Operations ────────────────────────────────

/**
 * Get total number of registered users.
 */
function getTotalUsers() {
  const row = queryOne("SELECT COUNT(*) as count FROM users");
  return row ? row.count : 0;
}

/**
 * Get number of active users today (users who downloaded today).
 */
function getActiveUsersToday() {
  const row = queryOne(
    `SELECT COUNT(DISTINCT user_id) as count FROM downloads 
     WHERE date(downloaded_at) = date('now')`
  );
  return row ? row.count : 0;
}

/**
 * Get total downloads today.
 */
function getDownloadsToday() {
  const row = queryOne(
    `SELECT COUNT(*) as count FROM downloads 
     WHERE date(downloaded_at) = date('now')`
  );
  return row ? row.count : 0;
}

/**
 * Get total downloads across all time.
 */
function getTotalDownloads() {
  const row = queryOne("SELECT COUNT(*) as count FROM downloads");
  return row ? row.count : 0;
}

/**
 * Get number of premium users.
 */
function getPremiumUserCount() {
  const row = queryOne(
    `SELECT COUNT(*) as count FROM users 
     WHERE is_premium = 1 AND premium_expires > datetime('now')`
  );
  return row ? row.count : 0;
}

/**
 * Get all user IDs (for broadcast). Returns an array of user ID numbers.
 */
function getAllUserIds() {
  const rows = queryAll("SELECT id FROM users WHERE is_banned = 0");
  return rows.map((r) => r.id);
}

/**
 * Get download stats by platform.
 */
function getDownloadsByPlatform() {
  return queryAll(
    `SELECT platform, COUNT(*) as count FROM downloads 
     GROUP BY platform ORDER BY count DESC`
  );
}

module.exports = {
  createUser,
  getUser,
  userExists,
  updateUserInfo,
  banUser,
  unbanUser,
  setQualityPref,
  incrementReferralCount,
  getReferralStats,
  activatePremium,
  isPremiumActive,
  getPremiumExpiry,
  logDownload,
  getDailyDownloadCount,
  getDailyLimit,
  getDownloadHistory,
  getTotalUsers,
  getActiveUsersToday,
  getDownloadsToday,
  getTotalDownloads,
  getPremiumUserCount,
  getAllUserIds,
  getDownloadsByPlatform,
};
