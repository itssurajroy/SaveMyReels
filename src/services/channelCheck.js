const config = require("../config");

/**
 * Check if a user is a member of the required channels.
 * @param {import("grammy").Bot} bot - The bot instance
 * @param {number} userId - Telegram user ID
 * @returns {Promise<{allJoined: boolean, channels: Array<{username: string, joined: boolean}>}>}
 */
async function checkChannelMembership(bot, userId) {
  if (config.forceChannels.length === 0) {
    return { allJoined: true, channels: [] };
  }

  const channels = [];
  let allJoined = true;

  for (const channelUsername of config.forceChannels) {
    try {
      const member = await bot.api.getChatMember(channelUsername, userId);
      const joined = ["member", "administrator", "creator"].includes(
        member.status
      );
      channels.push({ username: channelUsername, joined });
      if (!joined) allJoined = false;
    } catch (error) {
      // If we can't check (bot not admin in channel), assume not joined
      console.error(
        `⚠️ Cannot check membership for ${channelUsername}:`,
        error.message
      );
      channels.push({ username: channelUsername, joined: false });
      allJoined = false;
    }
  }

  return { allJoined, channels };
}

/**
 * Get list of channels the user hasn't joined yet.
 */
async function getMissingChannels(bot, userId) {
  const { channels } = await checkChannelMembership(bot, userId);
  return channels.filter((ch) => !ch.joined).map((ch) => ch.username);
}

module.exports = { checkChannelMembership, getMissingChannels };
