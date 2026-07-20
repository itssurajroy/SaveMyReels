const { formatNumber } = require("./helpers");

// ─── SaaS Aesthetic Helpers ─────────────────────────────────
const SAAS_HEADER = `⚡ <b>ＳＡＶＥＭＹＲＥＥＬＳ</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
const DECORATIVE_DIVIDER = `\n────────────────────\n`;

/**
 * Welcome message for new users.
 */
function welcomeMessage(firstName) {
  return (
    SAAS_HEADER +
    `🎬 <b>Welcome to the Premium Video Downloader, ${firstName}!</b>\n\n` +
    `I can download videos from:\n` +
    `┌ 📸 <b>Instagram Reels</b>\n` +
    `├ 🎵 <b>TikTok Videos</b>\n` +
    `└ ▶️ <b>YouTube Shorts</b>\n\n` +
    `<b>How to use:</b>\n` +
    `Simply paste any supported link in this chat! ⚡\n\n` +
    `<b>Your Daily Limits:</b>\n` +
    `┌ 📊 Free Tier: <b>5 downloads/day</b>\n` +
    `└ 👥 Referral: <b>+3 downloads/day</b> per friend\n` +
    `<i>⭐ Premium Pro: <b>Unlimited downloads</b></i>`
  );
}

/**
 * Welcome back message for returning users.
 */
function welcomeBackMessage(firstName) {
  return (
    SAAS_HEADER +
    `👋 <b>Welcome back, ${firstName}!</b>\n\n` +
    `Ready to download? Paste a video link to start! ⚡`
  );
}

/**
 * Must-join channels message.
 */
function joinChannelsMessage(channels) {
  const channelList = channels
    .map((ch) => `  📢 <b>${ch}</b>`)
    .join("\n");
  return (
    SAAS_HEADER +
    `🔒 <b>Verification Required</b>\n\n` +
    `To proceed, you must join our partner channels:\n\n` +
    `${channelList}\n\n` +
    `After joining, tap <b>"✅ I've Joined"</b> to unlock the bot.`
  );
}

/**
 * Channel verification success message.
 */
function channelVerifiedMessage() {
  return (
    SAAS_HEADER +
    `✅ <b>Access Granted!</b>\n\n` +
    `You've successfully joined all required channels.\n` +
    `Send me a video link to begin downloading! 🎬`
  );
}

/**
 * Channel verification failed message.
 */
function channelNotJoinedMessage(missingChannels) {
  const list = missingChannels.map((ch) => `  ❌ <b>${ch}</b>`).join("\n");
  return (
    SAAS_HEADER +
    `⚠️ <b>Verification Failed</b>\n\n` +
    `It looks like you are still missing these channels:\n\n` +
    `${list}\n\n` +
    `Please join them and tap "✅ I've Joined" again.`
  );
}

/**
 * Helper to build visual progress bar.
 */
function getProgressBar(percent) {
  const totalBlocks = 10;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
}

/**
 * Download progress — started.
 */
function downloadStartMessage(platform) {
  return (
    SAAS_HEADER +
    `⬇️ <b>Processing: ${platform}</b>\n\n` +
    `<code>[░░░░░░░░░░] 0%</code>\n\n` +
    `⏳ Fetching video payload... please hold on.`
  );
}

/**
 * Download progress — uploading to Telegram.
 */
function uploadingMessage() {
  return (
    SAAS_HEADER +
    `📤 <b>Uploading Video Payload</b>\n\n` +
    `<code>[██████████] 100%</code>\n\n` +
    `⚡ Sending file directly to your Telegram chat...`
  );
}

/**
 * Download complete message with stats.
 */
function downloadCompleteMessage(platform, used, limit, downloadTime) {
  const limitText = limit === Infinity ? "Unlimited" : limit;
  const quotaRatioText = limit === Infinity ? `${used} / ∞` : `${used} / ${limit}`;
  
  return (
    `✅ <b>Video Successfully Exported!</b>\n\n` +
    `┌ 📸 Platform: <b>${platform}</b>\n` +
    `├ ⏱️ Speed: <b>${downloadTime}</b>\n` +
    `└ 📊 Daily Quota: <b>${quotaRatioText}</b>\n\n` +
    `<i>⚡ Share the bot with your friends to increase your quota!</i>`
  );
}

/**
 * Daily limit reached message.
 */
function limitReachedMessage(limit) {
  return (
    SAAS_HEADER +
    `🚫 <b>Daily Quota Exceeded</b>\n\n` +
    `You have reached your free tier limit of <b>${limit} downloads</b> today.\n\n` +
    `<b>Unlock full power:</b>\n` +
    `┌ ⭐ <b>Premium Pro</b> → <b>Unlimited</b> downloads/day + HD!\n` +
    `└ 👥 <b>Invite Friends</b> → Earn <b>+3 extra</b> downloads/day per invite!\n\n` +
    `<i>Your quota resets daily at 00:00 UTC.</i>`
  );
}

/**
 * Download error message.
 */
function downloadErrorMessage(errorCode = "ERR_UNKNOWN") {
  const config = require("../config");
  return (
    SAAS_HEADER +
    `❌ <b>Download System Error</b>\n\n` +
    `We could not process this video. Common reasons:\n` +
    `┌ • The user's account is <b>private</b>\n` +
    `├ • The link has <b>expired or is invalid</b>\n` +
    `└ • The video is <b>region-blocked</b>\n\n` +
    `⚙️ Error Code: <code>${errorCode}</code>\n` +
    `💬 Support: ${config.supportUsername}\n\n` +
    `Try another URL or click below to retry.`
  );
}

/**
 * File too large message.
 */
function fileTooLargeMessage() {
  return (
    SAAS_HEADER +
    `⚠️ <b>File Size Limit Reached</b>\n\n` +
    `This video exceeds the 50MB Telegram file delivery limit.\n\n` +
    `<b>How to fix:</b>\n` +
    `Change your video quality settings to <b>SD</b> in /settings to compress the download size.`
  );
}

/**
 * Unsupported URL message.
 */
function unsupportedUrlMessage() {
  return (
    SAAS_HEADER +
    `❓ <b>Unsupported Video Source</b>\n\n` +
    `Please send a link from one of these platforms:\n` +
    `┌ 📸 Instagram (Reels, Posts)\n` +
    `├ 🎵 TikTok (Videos)\n` +
    `└ ▶️ YouTube (Shorts, Videos)\n\n` +
    `Example: <code>https://www.instagram.com/reel/...</code>`
  );
}

/**
 * Premium info message.
 */
function premiumInfoMessage(priceStars) {
  return (
    SAAS_HEADER +
    `⭐ <b>S A V E M Y R E E L S   P R O</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Upgrade your account to unlock premium privileges:\n\n` +
    `┌ 🚀 <b>Unlimited Daily Downloads</b>\n` +
    `├ 💎 <b>HD Quality Priority</b> (Best available resolution)\n` +
    `├ ⚡ <b>No Processing Queues</b>\n` +
    `└ ❤️ <b>Support Independent Developers</b>\n\n` +
    `💰 Price: <b>${priceStars} ⭐ Stars / month</b>\n` +
    `<i>No subscription required, pay as you go securely!</i>`
  );
}

/**
 * Premium activated message.
 */
function premiumActivatedMessage(expiryDate) {
  return (
    SAAS_HEADER +
    `🎉 <b>Premium Pro Activated!</b>\n\n` +
    `Thank you for upgrading! Your premium features are active.\n\n` +
    `┌ 👑 Account Tier: <b>PRO</b>\n` +
    `├ 📊 Quota: <b>Unlimited</b>\n` +
    `└ 📅 Expiry Date: <b>${expiryDate}</b>\n\n` +
    `Go ahead and paste any video link to test your new speed! 🚀`
  );
}

/**
 * Already premium message.
 */
function alreadyPremiumMessage(expiryDate) {
  return (
    SAAS_HEADER +
    `👑 <b>Premium Pro Member</b>\n\n` +
    `You have active premium privileges.\n\n` +
    `┌ 📊 Status: <b>Active</b>\n` +
    `├ 📈 Quota: <b>Unlimited</b>\n` +
    `└ 📅 Expiry Date: <b>${expiryDate}</b>\n\n` +
    `Enjoy high-speed downloads! 🎬`
  );
}

/**
 * Referral info message.
 */
function referralInfoMessage(referralLink, referralCount, bonusDownloads, totalLimit) {
  const totalText = totalLimit === Infinity ? "Unlimited" : `${totalLimit} downloads/day`;
  return (
    SAAS_HEADER +
    `👥 <b>Affiliate & Referral Dashboard</b>\n\n` +
    `Earn extra daily download credits by inviting friends!\n\n` +
    `┌ 🔗 Your Unique Invite Link:\n` +
    `│  <code>${referralLink}</code>\n` +
    `├ 👥 Friends Invited: <b>${referralCount}</b>\n` +
    `├ 🎁 Earned Bonus Credits: <b>+${bonusDownloads} / day</b>\n` +
    `└ 📊 Total Daily Quota: <b>${totalText}</b>\n\n` +
    `<i>Copy and share your link. When a friend joins, your limit increases immediately!</i>`
  );
}

/**
 * New referral notification for the referrer.
 */
function newReferralMessage(firstName) {
  return (
    SAAS_HEADER +
    `🎉 <b>Affiliate Credit Earned!</b>\n\n` +
    `<b>${firstName}</b> just registered using your link.\n` +
    `🎁 Your daily quota has been increased by <b>+3 downloads/day</b>!`
  );
}

/**
 * Help message.
 */
function helpMessage() {
  return (
    SAAS_HEADER +
    `❓ <b>Documentation & Help Center</b>\n\n` +
    `<b>Quick Start:</b>\n` +
    `Copy a Reels, TikTok, or Shorts link, paste it in this chat, and we will handle the rest.\n\n` +
    `<b>📌 Bot Command Registry:</b>\n` +
    `┌ /start — Open welcome deck & main dashboard\n` +
    `├ /settings — Adjust your download quality settings\n` +
    `├ /premium — Buy Premium Pro via Telegram Stars\n` +
    `├ /referral — Generate invite link and review stats\n` +
    `└ /help — Open this guide\n\n` +
    `<b>📈 Quota Metrics:</b>\n` +
    `• Free tier users start with 5 downloads per day.\n` +
    `• Referrals grant +3 daily downloads per active user.\n` +
    `• Pro tier gets completely unlimited downloads.`
  );
}

/**
 * Settings message.
 */
function settingsMessage(currentQuality) {
  const qualityLabel = currentQuality === "hd" ? "HD (Best Quality)" : "SD (480p — Smaller Files)";
  return (
    SAAS_HEADER +
    `⚙️ <b>SaaS Configuration Panel</b>\n\n` +
    `Configure your defaults:\n` +
    `┌ 🎥 Video Quality: <b>${qualityLabel}</b>\n` +
    `└ 📂 Temp Folder: Auto-cleanup enabled\n\n` +
    `Select your desired export profile below:`
  );
}

/**
 * Settings updated message.
 */
function settingsUpdatedMessage(newQuality) {
  const qualityLabel = newQuality === "hd" ? "HD (Best Quality)" : "SD (480p)";
  return `✅ Configuration saved. New quality standard: <b>${qualityLabel}</b>`;
}

/**
 * Banned user message.
 */
function bannedMessage() {
  return `🚫 <b>Account Terminated</b>\n\nYour account has been blacklisted for violating our Terms of Service.`;
}

/**
 * Admin stats message.
 */
function adminStatsMessage(stats) {
  return (
    `📊 <b>SaveMyReels Analytics Panel</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `┌ 👥 Total Users: <b>${formatNumber(stats.totalUsers)}</b>\n` +
    `├ 📈 Active Today: <b>${formatNumber(stats.activeToday)}</b>\n` +
    `├ 📥 Downloads Today: <b>${formatNumber(stats.downloadsToday)}</b>\n` +
    `├ 📂 Total Downloads: <b>${formatNumber(stats.totalDownloads)}</b>\n` +
    `└ ⭐ Premium Users: <b>${formatNumber(stats.premiumUsers)}</b>\n\n` +
    `<b>📈 Platform Share:</b>\n` +
    stats.byPlatform
      .map((p) => `  • ${p.platform.toUpperCase()}: <b>${formatNumber(p.count)}</b>`)
      .join("\n")
  );
}

/**
 * Broadcast preview message.
 */
function broadcastPreviewMessage(text, userCount) {
  return (
    SAAS_HEADER +
    `📢 <b>Administrative Broadcast</b>\n\n` +
    `<b>Message Content:</b>\n` +
    `<blockquote>${text}</blockquote>\n\n" +
    "┌ 👥 Total Recipients: <b>${formatNumber(userCount)} users</b>\n` +
    `└ ⏳ Confirm dispatch?`
  );
}

/**
 * Broadcast complete message.
 */
function broadcastCompleteMessage(sent, failed) {
  return (
    `✅ <b>Broadcast Dispatched</b>\n\n` +
    `┌ 📤 Successfully Sent: <b>${formatNumber(sent)}</b>\n` +
    `└ ❌ Failed: <b>${formatNumber(failed)}</b>`
  );
}

module.exports = {
  welcomeMessage,
  welcomeBackMessage,
  joinChannelsMessage,
  channelVerifiedMessage,
  channelNotJoinedMessage,
  downloadStartMessage,
  uploadingMessage,
  downloadCompleteMessage,
  limitReachedMessage,
  downloadErrorMessage,
  fileTooLargeMessage,
  unsupportedUrlMessage,
  premiumInfoMessage,
  premiumActivatedMessage,
  alreadyPremiumMessage,
  referralInfoMessage,
  newReferralMessage,
  helpMessage,
  settingsMessage,
  settingsUpdatedMessage,
  bannedMessage,
  adminStatsMessage,
  broadcastPreviewMessage,
  broadcastCompleteMessage,
};
