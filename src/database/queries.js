const { getPool } = require("./init");

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Execute a query that returns rows.
 */
async function queryAll(sql, params = []) {
  const pool = getPool();
  const res = await pool.query(sql, params);
  return res.rows;
}

/**
 * Execute a query that returns at most one row.
 */
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a non-SELECT query (INSERT, UPDATE, DELETE).
 */
async function execute(sql, params = []) {
  const pool = getPool();
  await pool.query(sql, params);
}

// ─── User Operations ─────────────────────────────────────────

/**
 * Create a new user or ignore if already exists.
 */
async function createUser(id, username, firstName, referredBy = null) {
  const existing = await getUser(id);
  if (existing) return false;

  await execute(
    `INSERT INTO users (id, username, first_name, referred_by) VALUES ($1, $2, $3, $4)`,
    [id, username, firstName, referredBy]
  );

  if (referredBy) {
    await incrementReferralCount(referredBy);
  }

  return true;
}

/**
 * Get a user by their Telegram ID.
 */
async function getUser(id) {
  // Telegram ID is a BIGINT, parse to string or big integer
  return queryOne("SELECT * FROM users WHERE id = $1", [id]);
}

/**
 * Check if a user exists.
 */
async function userExists(id) {
  const row = await queryOne("SELECT 1 as found FROM users WHERE id = $1", [id]);
  return !!row;
}

/**
 * Update user's username and first_name.
 */
async function updateUserInfo(id, username, firstName) {
  await execute(
    "UPDATE users SET username = $1, first_name = $2 WHERE id = $3",
    [username, firstName, id]
  );
}

/**
 * Ban a user.
 */
async function banUser(id) {
  await execute("UPDATE users SET is_banned = 1 WHERE id = $1", [id]);
}

/**
 * Unban a user.
 */
async function unbanUser(id) {
  await execute("UPDATE users SET is_banned = 0 WHERE id = $1", [id]);
}

/**
 * Set user's video quality preference.
 */
async function setQualityPref(id, quality) {
  await execute("UPDATE users SET quality_pref = $1 WHERE id = $2", [quality, id]);
}

// ─── Referral Operations ─────────────────────────────────────

/**
 * Increment referral count for a user.
 */
async function incrementReferralCount(userId) {
  await execute(
    "UPDATE users SET referral_count = referral_count + 1 WHERE id = $1",
    [userId]
  );
}

/**
 * Get referral stats for a user.
 */
async function getReferralStats(userId) {
  const config = require("../config");
  const user = await queryOne(
    "SELECT referral_count FROM users WHERE id = $1",
    [userId]
  );
  const count = user ? user.referral_count : 0;
  return {
    count,
    bonusDownloads: count * config.referralBonus,
  };
}

// ─── Premium Operations ──────────────────────────────────────

/**
 * Activate premium for a user for N days.
 */
async function activatePremium(userId, days) {
  await execute(
    `UPDATE users 
     SET is_premium = 1, 
         premium_expires = CURRENT_TIMESTAMP + ($1 || ' days')::INTERVAL
     WHERE id = $2`,
    [days, userId]
  );
}

/**
 * Check if a user's premium is currently active.
 */
async function isPremiumActive(userId) {
  const user = await queryOne(
    "SELECT is_premium, premium_expires FROM users WHERE id = $1",
    [userId]
  );

  if (!user || !user.is_premium) return false;

  if (user.premium_expires) {
    const expiresAt = new Date(user.premium_expires);
    if (expiresAt <= new Date()) {
      // Premium expired, deactivate
      await execute(
        "UPDATE users SET is_premium = 0, premium_expires = NULL WHERE id = $1",
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
async function getPremiumExpiry(userId) {
  const user = await queryOne(
    "SELECT premium_expires FROM users WHERE id = $1",
    [userId]
  );
  return user ? user.premium_expires : null;
}

// ─── Download Operations ─────────────────────────────────────

/**
 * Log a download for a user.
 */
async function logDownload(userId, url, platform) {
  await execute(
    "INSERT INTO downloads (user_id, url, platform) VALUES ($1, $2, $3)",
    [userId, url, platform]
  );
}

/**
 * Get the number of downloads a user has made today (UTC).
 */
async function getDailyDownloadCount(userId) {
  const row = await queryOne(
    `SELECT COUNT(*) as count FROM downloads 
     WHERE user_id = $1 AND downloaded_at::date = CURRENT_DATE`,
    [userId]
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get the daily download limit for a user.
 */
async function getDailyLimit(userId) {
  const config = require("../config");
  if (await isPremiumActive(userId)) return Infinity;

  const user = await queryOne(
    "SELECT referral_count FROM users WHERE id = $1",
    [userId]
  );
  const referralCount = user ? user.referral_count : 0;
  const calculatedBonus = referralCount * config.referralBonus;
  const cappedBonus = Math.min(calculatedBonus, config.maxReferralBonusLimit);

  return config.dailyFreeLimit + cappedBonus;
}

/**
 * Get recent download history for a user.
 */
async function getDownloadHistory(userId, limit = 10) {
  return queryAll(
    `SELECT url, platform, downloaded_at FROM downloads 
     WHERE user_id = $1 ORDER BY downloaded_at DESC LIMIT $2`,
    [userId, limit]
  );
}

// ─── Admin / Stats Operations ────────────────────────────────

/**
 * Get total number of registered users.
 */
async function getTotalUsers() {
  const row = await queryOne("SELECT COUNT(*) as count FROM users");
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get active users today.
 */
async function getActiveUsersToday() {
  const row = await queryOne(
    `SELECT COUNT(DISTINCT user_id) as count FROM downloads 
     WHERE downloaded_at::date = CURRENT_DATE`
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get total downloads today.
 */
async function getDownloadsToday() {
  const row = await queryOne(
    `SELECT COUNT(*) as count FROM downloads 
     WHERE downloaded_at::date = CURRENT_DATE`
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get total downloads all time.
 */
async function getTotalDownloads() {
  const row = await queryOne("SELECT COUNT(*) as count FROM downloads");
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get premium users.
 */
async function getPremiumUserCount() {
  const row = await queryOne(
    `SELECT COUNT(*) as count FROM users 
     WHERE is_premium = 1 AND premium_expires > CURRENT_TIMESTAMP`
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Get all user IDs (for broadcast).
 */
async function getAllUserIds() {
  const rows = await queryAll("SELECT id FROM users WHERE is_banned = 0");
  return rows.map((r) => parseInt(r.id, 10));
}

/**
 * Get download stats by platform.
 */
async function getDownloadsByPlatform() {
  return queryAll(
    `SELECT platform, COUNT(*) as count FROM downloads 
     GROUP BY platform ORDER BY count DESC`
  );
}

/**
 * Add a diagnostic log entry.
 */
async function addLog(message) {
  await execute("INSERT INTO logs (message) VALUES ($1)", [message]);
}

/**
 * Add the latest 50 diagnostic logs.
 */
async function getLogs() {
  return queryAll("SELECT message, created_at FROM logs ORDER BY created_at DESC LIMIT 50");
}

/**
 * Track an analytics funnel event.
 */
async function trackEvent(userId, eventType, metadata = {}) {
  await execute(
    "INSERT INTO funnel_events (user_id, event_type, metadata) VALUES ($1, $2, $3)",
    [userId, eventType, JSON.stringify(metadata)]
  );
}

/**
 * Compute aggregate conversion funnel stats.
 */
async function getFunnelStats() {
  // Counts by event types
  const startsRow = await queryOne("SELECT COUNT(*) as count FROM funnel_events WHERE event_type = 'bot_start'");
  const wallShownRow = await queryOne("SELECT COUNT(*) as count FROM funnel_events WHERE event_type = 'join_wall_shown'");
  const wallPassedRow = await queryOne("SELECT COUNT(*) as count FROM funnel_events WHERE event_type = 'join_wall_passed'");
  const limitRow = await queryOne("SELECT COUNT(*) as count FROM funnel_events WHERE event_type = 'limit_reached'");
  const refRow = await queryOne("SELECT COUNT(*) as count FROM funnel_events WHERE event_type = 'referral_click'");
  const totalUsersRow = await queryOne("SELECT COUNT(*) as count FROM users");

  const botStarts = startsRow ? parseInt(startsRow.count, 10) : 0;
  const joinWallShown = wallShownRow ? parseInt(wallShownRow.count, 10) : 0;
  const joinWallPassed = wallPassedRow ? parseInt(wallPassedRow.count, 10) : 0;
  const limitReached = limitRow ? parseInt(limitRow.count, 10) : 0;
  const referralClicks = refRow ? parseInt(refRow.count, 10) : 0;
  const totalUsers = totalUsersRow ? parseInt(totalUsersRow.count, 10) : 0;

  // Conversion calculations
  const joinConversionRate = joinWallShown > 0 
    ? Math.round((joinWallPassed / joinWallShown) * 100) 
    : 0;

  const limitHitRate = botStarts > 0 
    ? Math.round((limitReached / botStarts) * 100) 
    : 0;

  // Simple Viral K-Factor calculation: referred users signup / total users
  const kFactor = totalUsers > 0 
    ? parseFloat((referralClicks / totalUsers).toFixed(2)) 
    : 0.0;

  return {
    botStarts,
    joinWallShown,
    joinWallPassed,
    joinConversionRate,
    limitReached,
    limitHitRate,
    referralClicks,
    kFactor
  };
}

/**
 * Retrieve session data for a user.
 */
async function getSession(userId) {
  const row = await queryOne("SELECT session_data FROM sessions WHERE user_id = $1", [userId]);
  return row ? row.session_data : null;
}

/**
 * Save session data for a user.
 */
async function saveSession(userId, sessionData) {
  await execute(
    `INSERT INTO sessions (user_id, session_data, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET session_data = EXCLUDED.session_data, updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(sessionData)]
  );
}

/**
 * Clear session data for a user.
 */
async function clearSession(userId) {
  await execute("DELETE FROM sessions WHERE user_id = $1", [userId]);
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
  addLog,
  getLogs,
  trackEvent,
  getFunnelStats,
  getSession,
  saveSession,
  clearSession,
};
