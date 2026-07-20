const { InlineKeyboard } = require("grammy");
const config = require("../config");

// Check if WebApp URL is configured
const hasWebApp = !!config.webappUrl;

/**
 * Main menu keyboard (shown after /start and in help).
 */
function mainMenuKeyboard() {
  const kb = new InlineKeyboard();

  if (hasWebApp) {
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
      let url = ch.username;
      if (!url.startsWith("http")) {
        if (url.startsWith("-")) {
          // Fallback if private chat ID is specified without invite URL
          url = "https://t.me/telegram";
        } else {
          url = `https://t.me/${ch.username.replace("@", "")}`;
        }
      }
      kb.url(`📢 Join Channel`, url);
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
  const kb = new InlineKeyboard();

  if (hasWebApp) {
    kb.webApp("📊 View Web Dashboard", `${config.webappUrl}/app`);
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
  premiumKeyboard,
  qualityKeyboard,
  retryKeyboard,
  limitReachedKeyboard,
  broadcastConfirmKeyboard,
  backKeyboard,
};
