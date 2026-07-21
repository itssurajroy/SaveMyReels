const { Bot } = require("grammy");
const config = require("./config");
const { initDatabase } = require("./database/init");
const { authMiddleware } = require("./middleware/auth");

// Import handlers
const { registerStartHandler } = require("./handlers/start");
const { registerDownloadHandler } = require("./handlers/download");
const { registerPremiumHandler } = require("./handlers/premium");
const { registerReferralHandler } = require("./handlers/referral");
const { registerHelpHandler } = require("./handlers/help");
const { registerSettingsHandler } = require("./handlers/settings");
const { registerAdminHandler } = require("./handlers/admin");
const { registerInlineHandler } = require("./handlers/inline");
const { registerHistoryHandler } = require("./handlers/history");

// Utilities
const { mainMenuKeyboard, joinChannelsKeyboard } = require("./utils/keyboards");
const messages = require("./utils/messages");
const { checkChannelMembership } = require("./services/channelCheck");

async function main() {
  console.log("🚀 Starting SaveMyReels bot in polling mode...");

  // Initialize database
  try {
    await initDatabase();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("   Set DATABASE_URL in your .env file");
    process.exit(1);
  }

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
registerHistoryHandler(bot);

  // Shared callbacks
  bot.callbackQuery("back_to_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    const firstName = ctx.from.first_name || "User";
    try {
      await ctx.editMessageText(messages.welcomeBackMessage(firstName), {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard(),
      });
    } catch {
      await ctx.reply(messages.welcomeBackMessage(firstName), {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard(),
      });
    }
  });

  bot.callbackQuery("verify_join", async (ctx) => {
    const userId = ctx.from.id;
    const { allJoined, channels } = await checkChannelMembership(ctx.api, userId);

    if (allJoined) {
      const { trackEvent } = require("./database/queries");
      await trackEvent(userId, "join_wall_passed");
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

  // Error handler
  bot.catch((err) => {
    console.error("❌ Bot error:", err.message);
  });

  // Start polling
  await bot.start({
    onStart: () => {
      console.log(`✅ Bot started: @${bot.botInfo.username}`);
      console.log("   Press Ctrl+C to stop.");
    },
  });
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
