const express = require("express");
const path = require("path");
const queries = require("../database/queries");
const config = require("../config");

/**
 * Start the Express web server to serve the SaaS dashboard and API.
 * @param {import("grammy").Bot} bot - The bot instance
 * @returns {express.Application}
 */
function startWebServer(bot) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // ─── API Endpoints ─────────────────────────────────────────

  // Public system stats for the landing page
  app.get("/api/stats", (req, res) => {
    try {
      const stats = {
        totalUsers: queries.getTotalUsers(),
        totalDownloads: queries.getTotalDownloads(),
        activeToday: queries.getActiveUsersToday(),
        premiumUsers: queries.getPremiumUserCount(),
      };
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get user profile detail
  app.get("/api/user/:id", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const user = queries.getUser(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const isPremium = queries.isPremiumActive(userId);
      const limit = queries.getDailyLimit(userId);
      const used = queries.getDailyDownloadCount(userId);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          referralCount: user.referral_count,
          qualityPref: user.quality_pref || "hd",
          isPremium,
          premiumExpires: user.premium_expires,
          dailyLimit: limit === Infinity ? "Unlimited" : limit,
          dailyUsed: used,
          remaining: limit === Infinity ? "Unlimited" : Math.max(0, limit - used),
          referralLink: `https://t.me/${bot.botInfo.username}?start=ref_${user.id}`,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get user's download history
  app.get("/api/history/:id", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const history = queries.getDownloadHistory(userId, 30);
      res.json({ success: true, history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update user's settings (quality preference)
  app.post("/api/settings/:id", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { quality } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      if (quality !== "sd" && quality !== "hd") {
        return res.status(400).json({ success: false, error: "Invalid quality preference" });
      }

      queries.setQualityPref(userId, quality);
      res.json({ success: true, message: `Quality set to ${quality}` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve landing page at root
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  // Serve Mini App at /app
  app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "app.html"));
  });

  // Serve Privacy Policy
  app.get("/privacy", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "privacy.html"));
  });

  // Start listening
  const server = app.listen(PORT, () => {
    console.log(`🌐 SaaS Web Server running on port ${PORT}`);
    console.log(`🔗 Landing Page: http://localhost:${PORT}/`);
    console.log(`📱 Telegram Mini App: http://localhost:${PORT}/app\n`);
  });

  return server;
}

module.exports = { startWebServer };
