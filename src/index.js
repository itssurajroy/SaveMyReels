const { Bot } = require("grammy");
const config = require("./config");
const { initDatabase, closeDatabase } = require("./database/init");
const { authMiddleware } = require("./middleware/auth");
const { isYtDlpInstalled } = require("./services/downloader");
const { ensureDir } = require("./utils/helpers");
const { startWebServer } = require("./web/server");

// Import handlers
const { registerStartHandler } = require("./handlers/start");
const { registerDownloadHandler } = require("./handlers/download");
const { registerPremiumHandler } = require("./handlers/premium");
const { registerReferralHandler } = require("./handlers/referral");
const { registerHelpHandler } = require("./handlers/help");
const { registerSettingsHandler } = require("./handlers/settings");
const { registerAdminHandler } = require("./handlers/admin");
const { registerInlineHandler } = require("./handlers/inline");

// Keyboards & messages for callback queries
const { mainMenuKeyboard, joinChannelsKeyboard } = require("./utils/keyboards");
const messages = require("./utils/messages");
const { checkChannelMembership } = require("./services/channelCheck");

async function main() {
  console.log("🎬 SaveMyReels Bot starting...\n");

  // 1. Check yt-dlp installation
  const ytdlpReady = await isYtDlpInstalled();
  if (!ytdlpReady) {
    console.error(
      "❌ yt-dlp is not installed!\n" +
        "   Install it from: https://github.com/yt-dlp/yt-dlp\n" +
        "   Or run: pip install yt-dlp"
    );
    process.exit(1);
  }

  // 2. Initialize database
  await initDatabase();

  // 3. Ensure downloads directory exists
  ensureDir(config.downloadDir);

  // 4. Create bot instance
  const bot = new Bot(config.botToken);

  // 5. Register middleware
  bot.use(authMiddleware());

  // 6. Register command handlers
  registerStartHandler(bot);
  registerPremiumHandler(bot);
  registerReferralHandler(bot);
  registerHelpHandler(bot);
  registerSettingsHandler(bot);
  registerAdminHandler(bot);

  // 7. Register shared callback queries
  // Back to menu button
  bot.callbackQuery("back_to_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    const firstName = ctx.from.first_name || "User";
    await ctx.reply(messages.welcomeBackMessage(firstName), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    });
  });

  // Verify channel join button
  bot.callbackQuery("verify_join", async (ctx) => {
    const userId = ctx.from.id;
    const { allJoined, channels } = await checkChannelMembership(
      ctx.api,
      userId
    );

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

  // Retry download button
  bot.callbackQuery(/^retry_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const encoded = ctx.callbackQuery.data.replace("retry_", "");
    try {
      const url = Buffer.from(encoded, "base64").toString("utf-8");
      // Simulate sending the URL as a message by editing the current message
      await ctx.editMessageText(`🔄 Retrying download...`, {
        parse_mode: "HTML",
      });
      // Send the URL to trigger the download handler
      // We'll just prompt the user to resend
      await ctx.reply(
        `🔄 Please send the link again to retry:\n<code>${url}</code>`,
        { parse_mode: "HTML" }
      );
    } catch {
      await ctx.reply("⚠️ Please send the link again to retry.");
    }
  });

  // 7.5 Register inline query handler
  registerInlineHandler(bot);

  // 8. Register download handler (must be LAST — catches all text messages)
  registerDownloadHandler(bot);

  // 9. Error handler
  bot.catch((err) => {
    console.error("❌ Bot error:", err.message);
  });

  // 10. Start the bot and Web Server
  let webServer = null;
  bot.start({
    onStart: async (botInfo) => {
      console.log(`✅ Logged in as @${botInfo.username}`);
      console.log(`📊 Admin IDs: ${config.adminIds.join(", ") || "None"}`);
      console.log(
        `📢 Force channels: ${config.forceChannels.join(", ") || "None"}`
      );
      console.log(`📦 Daily free limit: ${config.dailyFreeLimit}`);
      console.log(`👥 Referral bonus: +${config.referralBonus}/referral`);
      console.log(`⭐ Premium price: ${config.premiumPriceStars} Stars\n`);

      // Set bot command registry menu in Telegram
      try {
        await bot.api.setMyCommands([
          { command: "start", description: "Open welcome dashboard" },
          { command: "settings", description: "Default video quality" },
          { command: "premium", description: "Unlock Premium Pro privileges" },
          { command: "referral", description: "Get invite link & stats" },
          { command: "help", description: "View documentation & FAQs" }
        ]);
        console.log("📝 Bot commands registered successfully");
      } catch (err) {
        console.warn("⚠️ Failed to register bot commands:", err.message);
      }

      // Start the Express web server
      webServer = startWebServer(bot);
      console.log("🚀 Bot is running! Press Ctrl+C to stop.\n");
    },
  });

  // 11. Graceful shutdown
  const shutdown = () => {
    console.log("\n🛑 Shutting down...");
    bot.stop();
    closeDatabase();
    // Clean up downloads directory
    const fs = require("fs");
    try {
      const files = fs.readdirSync(config.downloadDir);
      for (const file of files) {
        fs.unlinkSync(`${config.downloadDir}/${file}`);
      }
      console.log("🧹 Cleaned up temporary files");
    } catch {
      // Directory might not exist, ignore
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
