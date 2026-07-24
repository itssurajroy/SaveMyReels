const express = require("express");
const path = require("path");
const config = require("../src/config");
const { initDatabase } = require("../src/database/init");
const queries = require("../src/database/queries");
const { downloadVideo, getVideoInfo } = require("../src/services/downloader");

// Set up Express
const app = express();
app.use(express.json());

// CORS for webapp
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

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

// ─── WebApp Download Endpoints ─────────────────────────────

// Download Instagram video
app.post("/api/download", async (req, res) => {
  try {
    const { url, quality = "hd" } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL and detect platform
    const { detectPlatform } = require("../src/utils/helpers");
    const detected = detectPlatform(url);
    if (!detected || detected.platform !== "instagram") {
      return res.status(400).json({ error: "Invalid or unsupported URL. Please send a valid Instagram link." });
    }

    const { platform } = detected;

    // Get video info
    let info;
    try {
      info = await getVideoInfo(url);
    } catch (err) {
      info = { title: "Instagram Video", caption: "" };
    }

    // Download the video
    const result = await downloadVideo(url, quality);

    return res.status(200).json({
      success: true,
      title: info.title || "Instagram Video",
      caption: info.caption || result.caption || "",
      downloadUrl: result.filePath,
      mediaType: result.mediaType || "video",
      fileSize: result.fileSizeMB,
    });
  } catch (error) {
    console.error("Download API error:", error.message);

    let errorMessage = "Download failed";
    let statusCode = 500;

    if (error.message === "INSTAGRAM_RESOLVE_FAILED") {
      errorMessage = "Could not resolve Instagram URL. The post may be private or deleted.";
      statusCode = 404;
    } else if (error.message === "FILE_TOO_LARGE") {
      errorMessage = "Video is too large (max 50MB)";
      statusCode = 413;
    } else if (error.message === "UNSUPPORTED_PLATFORM") {
      errorMessage = "Unsupported platform. Only Instagram is supported.";
      statusCode = 400;
    }

    return res.status(statusCode).json({ error: errorMessage });
  }
});

// Get user download history (for webapp)
app.get("/api/downloads/:userId", async (req, res) => {
  try {
    await ensureDbConnected();
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const history = await queries.getDownloadHistory(userId, 50);
    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("History API error:", error.message);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Download queue (in-memory, per-server)
const downloadQueue = new Map();

app.get("/api/queue/:userId", (req, res) => {
  const { userId } = req.params;
  const userQueue = downloadQueue.get(userId) || [];
  return res.status(200).json({ success: true, queue: userQueue });
});

app.post("/api/queue/:userId", (req, res) => {
  const { userId } = req.params;
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const userQueue = downloadQueue.get(userId) || [];
  const newItem = {
    id: Date.now().toString(),
    url,
    status: "pending",
    position: userQueue.length + 1,
    progress: 0,
    created_at: new Date().toISOString(),
  };

  userQueue.push(newItem);
  downloadQueue.set(userId, userQueue);

  return res.status(201).json({ success: true, item: newItem });
});

app.delete("/api/queue/:userId", (req, res) => {
  const { userId } = req.params;
  downloadQueue.delete(userId);
  return res.status(200).json({ success: true });
});

// Endpoint to proxy video streams directly to Telegram (bypassing hotlinking restrictions)
app.get("/api/video-proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const axios = require("axios");
    const response = await axios({
      method: "get",
      url: decodeURIComponent(url),
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
      }
    });

    if (response.headers["content-type"]) {
      res.setHeader("content-type", response.headers["content-type"]);
    } else {
      res.setHeader("content-type", "video/mp4");
    }
    if (response.headers["content-length"]) {
      res.setHeader("content-length", response.headers["content-length"]);
    }
    res.setHeader("accept-ranges", "bytes");

    response.data.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("Proxy error: " + err.message);
  }
});

// Endpoint to stream local temp downloads to the user
app.get("/api/download-file", (req, res) => {
  const fs = require("fs");
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send("File not found or expired.");
  }
  
  // Ensure we only serve temporary files for safety
  const resolvedPath = path.resolve(filePath);
  const tempDir = path.resolve(require("os").tmpdir());
  if (!resolvedPath.startsWith(tempDir) && !resolvedPath.includes("temp") && !resolvedPath.includes("tmp")) {
    return res.status(403).send("Forbidden access.");
  }

  res.download(resolvedPath);
});

// ─── Static Pages ──────────────────────────────────────────

// Serve Privacy & Terms Policy pages
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/web/public/privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/web/public/terms.html"));
});

// Serve landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/web/public/index.html"));
});

// Start server locally if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  ensureDbConnected()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 SaveMyReels local API server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ Failed to initialize database connection for local server:", err.message);
    });
}

// Export Express App for Vercel Serverless Function
module.exports = app;
