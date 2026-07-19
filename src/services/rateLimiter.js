const { getDailyDownloadCount, getDailyLimit } = require("../database/queries");

/**
 * Check if a user is under their daily download limit.
 * @param {number} userId - Telegram user ID
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, remaining: number }>}
 */
async function checkRateLimit(userId) {
  const used = await getDailyDownloadCount(userId);
  const limit = await getDailyLimit(userId);

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
