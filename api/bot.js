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
const { registerHistoryHandler } = require("../src/handlers/history");

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
registerHistoryHandler(bot);

// Register shared callbacks
bot.callbackQuery("back_to_menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const firstName = ctx.from.first_name || "User";
  try {
    await ctx.editMessageText(messages.welcomeBackMessage(firstName), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    });
  } catch (err) {
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
    const { trackEvent } = require("../src/database/queries");
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

bot.catch((err) => {
  console.error("❌ Bot error:", err.message);
});

let dbInitialized = false;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(200).send("OK");
      return;
    }

    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    await bot.init();

    const update = await parseBody(req);
    await bot.handleUpdate(update);

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Vercel Webhook error:", err.message);
    try {
      const queries = require("../src/database/queries");
      await queries.addLog(`[ERROR] ${err.message}\nStack: ${err.stack}`);
    } catch {}
    res.status(200).send("OK");
  }
};
