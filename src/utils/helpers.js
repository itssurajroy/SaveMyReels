/**
 * URL validation and platform detection utilities.
 */

const PLATFORM_PATTERNS = {
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|stories)\/[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[\w.]+\/(?:reel|reels|p|stories)\/[\w-]+/i,
  ],
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
    /(?:https?:\/\/)?youtu\.be\/[\w-]+/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/i,
    /(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/[\w]+/i,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/[\w]+/i,
  ],
};

/**
 * Detect which platform a URL belongs to.
 * Extracts URLs from messages with surrounding text (e.g. "hey check this out https://instagram.com/reel/xyz nice").
 * @param {string} text - Message text that may contain a URL
 * @returns {{ platform: string, url: string } | null}
 */
function detectPlatform(text) {
  // First, try to extract all URLs from the message
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const urls = text.match(urlRegex) || [];

  // Also check bare domain patterns (without https://)
  const bareRegex = /(?:www\.)?instagram\.com\/[^\s<>"')\]]+/gi;
  const bareUrls = text.match(bareRegex) || [];

  const allCandidates = [...urls, ...bareUrls];

  for (const candidate of allCandidates) {
    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(candidate)) {
          return { platform, url: candidate };
        }
      }
    }
  }

  // Fallback: try matching directly on full text (original behavior)
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { platform, url: match[0] };
      }
    }
  }

  return null;
}

/**
 * Check if a string contains a valid supported URL.
 */
function containsSupportedUrl(text) {
  return detectPlatform(text) !== null;
}

/**
 * Get a human-readable platform name with emoji.
 */
function getPlatformLabel(platform) {
  const labels = {
    instagram: "📸 Instagram",
  };
  return labels[platform] || platform;
}

/**
 * Format seconds into a human-readable duration.
 */
function formatDuration(seconds) {
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Generate a referral deep link for a user.
 */
function generateReferralLink(botUsername, userId) {
  return `https://t.me/${botUsername}?start=ref_${userId}`;
}

/**
 * Parse a referral code from /start payload.
 * @returns {number|null} The referrer's user ID or null.
 */
function parseReferralCode(payload) {
  if (!payload) return null;
  const match = payload.match(/^ref_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Safely delete a file (async, ignores errors).
 */
async function cleanupFile(filePath) {
  try {
    const fs = require("fs").promises;
    await fs.unlink(filePath);
  } catch {
    // File may already be deleted, ignore
  }
}

/**
 * Ensure a directory exists, create if not.
 */
function ensureDir(dirPath) {
  const fs = require("fs");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format a number with commas (e.g., 1234 → "1,234").
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Escape HTML special characters for Telegram HTML parse mode.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  detectPlatform,
  containsSupportedUrl,
  getPlatformLabel,
  formatDuration,
  generateReferralLink,
  parseReferralCode,
  cleanupFile,
  ensureDir,
  formatNumber,
  escapeHtml,
};
