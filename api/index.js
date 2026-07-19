const { Bot, webhookCallback } = require("grammy");
const express = require("express");
const path = require("path");
const config = require("../src/config");
const { initDatabase, closeDatabase } = require("../src/database/init");
const { authMiddleware } = require("../src/middleware/auth");
const { ensureDir } = require("../src/utils/helpers");

// Import handlers
const { registerStartHandler } = require("../src/handlers/start");
const { registerDownloadHandler } = require("../src/handlers/download");
const { registerPremiumHandler } = require("../src/handlers/premium");
const { registerReferralHandler } = require("../src/handlers/referral");
const { registerHelpHandler } = require("../src/handlers/help");
const { registerSettingsHandler } = require("../src/handlers/settings");
const { registerAdminHandler } = require("../src/handlers/admin");
const { registerInlineHandler } = require("../src/handlers/inline");

// Queries for API
const queries = require("../src/database/queries");
const { checkChannelMembership } = require("../src/services/channelCheck");
const { mainMenuKeyboard, joinChannelsKeyboard } = require("../src/utils/keyboards");
const messages = require("../src/utils/messages");

// 1. Create bot instance
const bot = new Bot(config.botToken);

// 2. Register middleware
bot.use(authMiddleware());

// 3. Register handlers
registerStartHandler(bot);
registerPremiumHandler(bot);
registerReferralHandler(bot);
registerHelpHandler(bot);
registerSettingsHandler(bot);
registerAdminHandler(bot);
registerInlineHandler(bot);

// 4. Register shared callback queries
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

// Set up Express
const app = express();
app.use(express.json());

// Database connection state
let dbInitialized = false;

async function ensureDbConnected() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

// ─── API Endpoints ─────────────────────────────────────────

// Public stats
app.get("/api/stats", async (req, res) => {
  try {
    await ensureDbConnected();
    const stats = {
      totalUsers: await queries.getTotalUsers(),
      totalDownloads: await queries.getTotalDownloads(),
      activeToday: await queries.getActiveUsersToday(),
      premiumUsers: await queries.getPremiumUserCount(),
    };
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Profile
app.get("/api/user/:id", async (req, res) => {
  try {
    await ensureDbConnected();
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const user = await queries.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isPremium = await queries.isPremiumActive(userId);
    const limit = await queries.getDailyLimit(userId);
    const used = await queries.getDailyDownloadCount(userId);

    res.json({
      success: true,
      user: {
        id: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        referralCount: user.referral_count,
        qualityPref: user.quality_pref || "hd",
        isPremium,
        premiumExpires: user.premium_expires,
        dailyLimit: limit === Infinity ? "Unlimited" : limit,
        dailyUsed: used,
        remaining: limit === Infinity ? "Unlimited" : Math.max(0, limit - used),
        referralLink: `https://t.me/${bot.botInfo?.username || "bot"}?start=ref_${user.id}`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Download History
app.get("/api/history/:id", async (req, res) => {
  try {
    await ensureDbConnected();
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const history = await queries.getDownloadHistory(userId, 30);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update settings
app.post("/api/settings/:id", async (req, res) => {
  try {
    await ensureDbConnected();
    const userId = parseInt(req.params.id, 10);
    const { quality } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    if (quality !== "sd" && quality !== "hd") {
      return res.status(400).json({ success: false, error: "Invalid quality" });
    }

    await queries.setQualityPref(userId, quality);
    res.json({ success: true, message: `Quality set to ${quality}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook endpoint
app.post("/api/bot", async (req, res, next) => {
  try {
    await ensureDbConnected();
    // Cache bot username on first webhook request
    if (!bot.botInfo) {
      await bot.init();
    }
    // Handle request with Grammy webhookCallback adapter
    return webhookCallback(bot, "express")(req, res, next);
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

// Export Express App for Vercel Serverless Function
module.exports = app;
