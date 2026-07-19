const { getReferralStats, getDailyLimit } = require("../database/queries");
const { backKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");
const { generateReferralLink } = require("../utils/helpers");

/**
 * Register referral-related handlers.
 */
function registerReferralHandler(bot) {
  // /referral command
  bot.command("referral", async (ctx) => {
    await showReferralInfo(ctx, bot);
  });

  // Callback: referral_info button
  bot.callbackQuery("referral_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showReferralInfo(ctx, bot);
  });
}

/**
 * Show referral info.
 */
async function showReferralInfo(ctx, bot) {
  const userId = ctx.from.id;
  const botInfo = await bot.api.getMe();

  const referralLink = generateReferralLink(botInfo.username, userId);
  const stats = await getReferralStats(userId);
  const totalLimit = await getDailyLimit(userId);

  await ctx.reply(
    messages.referralInfoMessage(
      referralLink,
      stats.count,
      stats.bonusDownloads,
      totalLimit
    ),
    {
      parse_mode: "HTML",
      reply_markup: backKeyboard(),
    }
  );
}

module.exports = { registerReferralHandler };
