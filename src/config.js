require("dotenv").config();

const config = {
  // Bot
  botToken: process.env.BOT_TOKEN,

  // Admin IDs (array of numbers)
  adminIds: (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter(Boolean),

  // Forced join channels (array of strings like "@channel")
  forceChannels: (process.env.FORCE_CHANNELS || "")
    .split(",")
    .map((ch) => ch.trim())
    .filter(Boolean),

  // Rate limits
  dailyFreeLimit: parseInt(process.env.DAILY_FREE_LIMIT, 10) || 5,
  referralBonus: parseInt(process.env.REFERRAL_BONUS, 10) || 3,

  // Premium
  premiumPriceStars: parseInt(process.env.PREMIUM_PRICE_STARS, 10) || 50,
  premiumDurationDays:
    parseInt(process.env.PREMIUM_DURATION_DAYS, 10) || 30,

  // Video
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50,
  defaultQuality: process.env.DEFAULT_QUALITY || "hd",

  // Cloud Database (Neon / Supabase Postgres Connection String)
  databaseUrl: process.env.DATABASE_URL || "",

  // Web App
  webappUrl: process.env.WEBAPP_URL || "",
};

// Validate required config
if (!config.botToken) {
  console.error("❌ BOT_TOKEN is required! Set it in your environment.");
}

if (!config.databaseUrl) {
  console.warn(
    "⚠️  DATABASE_URL is not set! Set it in your environment to connect to Cloud Postgres."
  );
}

module.exports = config;
