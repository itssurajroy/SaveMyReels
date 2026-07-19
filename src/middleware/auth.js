const { createUser, getUser, updateUserInfo } = require("../database/queries");
const { checkChannelMembership } = require("../services/channelCheck");
const { joinChannelsKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");
const config = require("../config");

/**
 * Middleware that:
 * 1. Auto-registers new users in the database
 * 2. Blocks banned users
 * 3. Checks forced channel membership
 */
function authMiddleware() {
  return async (ctx, next) => {
    if (!ctx.from) return next();

    const userId = ctx.from.id;
    const username = ctx.from.username || null;
    const firstName = ctx.from.first_name || "User";

    // 1. Auto-register or update user info
    const existingUser = await getUser(userId);
    if (!existingUser) {
      await createUser(userId, username, firstName);
    } else {
      await updateUserInfo(userId, username, firstName);
    }

    // 2. Check if user is banned
    const user = await getUser(userId);
    if (user && user.is_banned) {
      if (ctx.message) {
        await ctx.reply(messages.bannedMessage(), { parse_mode: "HTML" });
      } else if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "🚫 You are banned.", show_alert: true });
      }
      return; // Stop processing
    }

    // 3. Check forced channel membership
    const isAdmin = config.adminIds.includes(userId);
    const isVerifyCallback =
      ctx.callbackQuery && ctx.callbackQuery.data === "verify_join";

    if (!isAdmin && !isVerifyCallback && config.forceChannels.length > 0) {
      const { allJoined, channels } = await checkChannelMembership(
        ctx.api,
        userId
      );

      if (!allJoined) {
        const notJoinedChannels = channels
          .filter((ch) => !ch.joined)
          .map((ch) => ch.username);

        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: "⚠️ Please join the required channels first!",
            show_alert: true,
          });
        }

        const { trackEvent } = require("../database/queries");
        await trackEvent(userId, "join_wall_shown", { missing: notJoinedChannels });

        await ctx.reply(messages.joinChannelsMessage(notJoinedChannels), {
          parse_mode: "HTML",
          reply_markup: joinChannelsKeyboard(channels),
        });
        return; // Stop processing
      }
    }

    return next();
  };
}

module.exports = { authMiddleware };
