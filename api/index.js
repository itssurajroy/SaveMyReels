const express = require("express");
const path = require("path");
const config = require("../src/config");
const { initDatabase } = require("../src/database/init");
const queries = require("../src/database/queries");

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
    const funnel = await queries.getFunnelStats();
    res.json({ success: true, stats, funnel });
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
        // We reference the bot username from configuration or default to get username
        referralLink: `https://t.me/savemyreeelsbot?start=ref_${user.id}`,
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

// View debug logs
app.get("/api/debug-logs", async (req, res) => {
  try {
    await ensureDbConnected();
    const logs = await queries.getLogs();
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve Privacy & Terms Policy pages
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/web/public/privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/web/public/terms.html"));
});

// Export Express App for Vercel Serverless Function
module.exports = app;
