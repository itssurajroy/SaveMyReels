const { getDailyDownloadCount, getDailyLimit } = require("../database/queries");

/**
 * Check if a user is under their daily download limit.
 * @param {number} userId - Telegram user ID
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
function checkRateLimit(userId) {
  const used = getDailyDownloadCount(userId);
  const limit = getDailyLimit(userId);

  if (limit === Infinity) {
    return { allowed: true, used, limit: Infinity, remaining: Infinity };
  }

  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
  };
}

module.exports = { checkRateLimit };
