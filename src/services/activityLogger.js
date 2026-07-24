const config = require("../config");

/**
 * Dispatch real-time user activity alerts to Telegram log channel.
 * @param {import("grammy").Api} api - Telegram bot Api instance
 * @param {string} logText - HTML formatted log message
 */
async function sendActivityLog(api, logText) {
  if (!config.logChannelId || !api) return;

  try {
    await api.sendMessage(config.logChannelId, logText, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error(`⚠️ Failed to send activity log to channel ${config.logChannelId}:`, err.message);
  }
}

/**
 * Format user identity string for log alerts.
 */
function formatUserLog(user, userId) {
  const username = user?.username ? `@${user.username}` : "No username";
  const firstName = user?.first_name || user?.first_name || "User";
  return `👤 <b>User:</b> ${firstName} (${username}) [<code>${userId}</code>]`;
}

module.exports = {
  sendActivityLog,
  formatUserLog,
};
