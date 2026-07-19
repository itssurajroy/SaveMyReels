const { InlineKeyboard } = require("grammy");
const config = require("../config");

// Helper to check if WebApp URL is secure (Telegram requirement)
const hasSecureWebApp = config.webappUrl && config.webappUrl.startsWith("https://");

/**
 * Main menu keyboard (shown after /start and in help).
 */
function mainMenuKeyboard() {
  const kb = new InlineKeyboard();

  if (hasSecureWebApp) {
    kb.webApp("🚀 Open Web Dashboard", `${config.webappUrl}/app`).row();
  }

  kb.text("⭐ Go Premium", "premium_info")
    .text("👥 Refer Friends", "referral_info")
    .row()
    .text("⚙️ Settings", "settings")
    .text("❓ Help", "help");

  return kb;
}

/**
 * Keyboard to prompt users to join required channels.
 * @param {Array<{username: string, joined: boolean}>} channels
 */
function joinChannelsKeyboard(channels) {
  const kb = new InlineKeyboard();

  for (const ch of channels) {
    if (!ch.joined) {
      kb.url(`📢 Join ${ch.username}`, `https://t.me/${ch.username.replace("@", "")}`);
      kb.row();
    }
  }

  kb.text("✅ I've Joined", "verify_join");
  return kb;
}

/**
 * Premium SaaS contextual keyboard shown after a successful download.
 * @param {string} botUsername - Username of the bot
 * @param {string} originalUrl - The URL of the video (base64 encoded for queries)
 */
function postDownloadKeyboard(botUsername, originalUrl) {
  const encodedUrl = Buffer.from(originalUrl).toString("base64").slice(0, 50);
  const kb = new InlineKeyboard();

  // Media Utilities
  kb.text("🎵 Extract Audio", `audio_${encodedUrl}`)
    .text("✂️ Trim Video", `trim_${encodedUrl}`)
    .row();

  // SaaS engagement
  kb.text("🌟 Rate Bot", `rate_${encodedUrl}`);
  if (hasSecureWebApp) {
    kb.webApp("📊 View Web Portal", `${config.webappUrl}/app`);
  } else {
    kb.text("⭐ Go Premium", "premium_info");
  }
  kb.row();

  // Viral Sharing
  kb.url(
    "📤 Share Bot",
    `https://t.me/share/url?url=https://t.me/${botUsername}&text=Download%20Instagram%20Reels,%20YouTube%20Shorts%20%26%20TikTok%20videos%20for%20free!`
  );

  return kb;
}

/**
 * Video Trimming Options keyboard.
 */
function trimMenuKeyboard(encodedUrl) {
  return new InlineKeyboard()
    .text("✂️ First 15 seconds", `docut_15_${encodedUrl}`)
    .text("✂️ First 30 seconds", `docut_30_${encodedUrl}`)
    .row()
    .text("✂️ Custom Range", `docut_custom_${encodedUrl}`)
    .row()
    .text("🔙 Back to Menu", "back_to_menu");
}

/**
 * Feedback rating keyboard.
 */
function ratingKeyboard(encodedUrl) {
  return new InlineKeyboard()
    .text("⭐ 1", `rateval_1_${encodedUrl}`)
    .text("⭐ 2", `rateval_2_${encodedUrl}`)
    .text("⭐ 3", `rateval_3_${encodedUrl}`)
    .text("⭐ 4", `rateval_4_${encodedUrl}`)
    .text("⭐ 5", `rateval_5_${encodedUrl}`)
    .row()
    .text("🔙 Back to Menu", "back_to_menu");
}

/**
 * Premium purchase keyboard.
 */
function premiumKeyboard() {
  return new InlineKeyboard()
    .text("💎 Buy Premium ⭐", "buy_premium")
    .row()
    .text("🔙 Back", "back_to_menu");
}

/**
 * Quality selection keyboard.
 * @param {string} currentPref - Current quality preference ('sd' or 'hd')
 */
function qualityKeyboard(currentPref) {
  const sdLabel = currentPref === "sd" ? "✅ SD (480p)" : "SD (480p)";
  const hdLabel = currentPref === "hd" ? "✅ HD (Best)" : "HD (Best)";

  return new InlineKeyboard()
    .text(sdLabel, "set_quality_sd")
    .text(hdLabel, "set_quality_hd")
    .row()
    .text("🔙 Back", "back_to_menu");
}

/**
 * Retry download keyboard.
 * @param {string} url - The URL that failed to download
 */
function retryKeyboard(url) {
  return new InlineKeyboard()
    .text("🔄 Retry", `retry_${Buffer.from(url).toString("base64").slice(0, 60)}`)
    .text("❓ Help", "help");
}

/**
 * Limit reached keyboard — prompts user to upgrade or refer friends.
 */
function limitReachedKeyboard() {
  return new InlineKeyboard()
    .text("⭐ Go Premium — Unlimited!", "premium_info")
    .row()
    .text("👥 Refer Friends (+3/friend)", "referral_info");
}

/**
 * Admin broadcast confirmation keyboard.
 */
function broadcastConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Send to All", "broadcast_confirm")
    .text("❌ Cancel", "broadcast_cancel");
}

/**
 * Back to menu keyboard.
 */
function backKeyboard() {
  return new InlineKeyboard().text("🔙 Back to Menu", "back_to_menu");
}

module.exports = {
  mainMenuKeyboard,
  joinChannelsKeyboard,
  postDownloadKeyboard,
  trimMenuKeyboard,
  ratingKeyboard,
  premiumKeyboard,
  qualityKeyboard,
  retryKeyboard,
  limitReachedKeyboard,
  broadcastConfirmKeyboard,
  backKeyboard,
};
