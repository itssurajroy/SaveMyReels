const { Bot, webhookCallback } = require("grammy");
const config = require("../src/config");
const { initDatabase } = require("../src/database/init");
const { authMiddleware } = require("../src/middleware/auth");

// Import handlers
const { registerStartHandler } = require("../src/handlers/start");
const { registerDownloadHandler } = require("../src/handlers/download");
const { registerPremiumHandler } = require("../src/handlers/premium");
const { registerReferralHandler } = require("../src/handlers/referral");
const { registerHelpHandler } = require("../src/handlers/help");
const { registerSettingsHandler } = require("../src/handlers/settings");
const { registerAdminHandler } = require("../src/handlers/admin");
const { registerInlineHandler } = require("../src/handlers/inline");

// Utilities
const { mainMenuKeyboard, joinChannelsKeyboard } = require("../src/utils/keyboards");
const messages = require("../src/utils/messages");
const { checkChannelMembership } = require("../src/services/channelCheck");

// Initialize bot
const bot = new Bot(config.botToken);

// Register middleware
bot.use(authMiddleware());

// Register handlers
registerStartHandler(bot);
registerPremiumHandler(bot);
registerReferralHandler(bot);
registerHelpHandler(bot);
registerSettingsHandler(bot);
registerAdminHandler(bot);
registerInlineHandler(bot);

// Register shared callbacks
bot.callbackQuery("back_to_menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const firstName = ctx.from.first_name || "User";
  await ctx.reply(messages.welcomeBackMessage(firstName), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  });
});

bot.callbackQuery("verify_join", async (ctx) => {
  const userId = ctx.from.id;
  const { allJoined, channels } = await checkChannelMembership(ctx.api, userId);

  if (allJoined) {
    await ctx.answerCallbackQuery({ text: "✅ Verified!" });
    await ctx.editMessageText(messages.channelVerifiedMessage(), {
      parse_mode: "HTML",
    });
  } else {
    const missingChannels = channels
      .filter((ch) => !ch.joined)
      .map((ch) => ch.username);
    await ctx.answerCallbackQuery({
      text: "❌ You haven't joined all channels yet!",
      show_alert: true,
    });
    await ctx.editMessageText(
      messages.channelNotJoinedMessage(missingChannels),
      {
        parse_mode: "HTML",
        reply_markup: joinChannelsKeyboard(channels),
      }
    );
  }
});

// Download handler must be LAST
registerDownloadHandler(bot);

bot.catch((err) => {
  console.error("❌ Bot error:", err.message);
});

let dbInitialized = false;

// Create the webhook callback handler using Grammy's next-js adapter (native Vercel)
const handleWebhook = webhookCallback(bot, "next-js");

module.exports = async (req, res) => {
  try {
    // 1. Ensure cloud Postgres is connected
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    // 2. Cache bot info on first request
    if (!bot.botInfo) {
      await bot.init();
    }

    // 3. Process webhook update
    return await handleWebhook(req, res);
  } catch (err) {
    console.error("❌ Vercel Webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
