const path = require("path");
const fs = require("fs");
const config = require("../config");

/**
 * Download / Resolve a video URL using the Cobalt.tools public API.
 * Bypasses need for local yt-dlp binaries on Vercel.
 * Returns the direct CDN URL so Telegram can download it directly.
 * 
 * @param {string} url - The video URL
 * @param {string} quality - 'hd' or 'sd'
 * @returns {Promise<{ filePath: string, title: string, fileSize: number, isDirectUrl: boolean }>}
 */
async function downloadVideo(url, quality = "hd") {
  const isSd = quality === "sd";

  // Cobalt.tools API Request payload (Supports both v6 and v7 parameter formats)
  const payload = {
    url: url,
    videoQuality: isSd ? "360" : "720", // Limit quality on free tier to prevent file size overflow
    audioFormat: "mp3",
    filenamePattern: "basic",
    isAudioOnly: false,
    downloadMode: "video", // v7 parameter
    isNoTTWatermark: true,
    removeWatermark: true, // v7 parameter
  };

  const cobaltInstances = [
    "https://api.cobalt.tools/api/json",
    "https://cobalt.tools/api/json",
    "https://co.wuk.sh/api/json",
  ];

  let lastError = null;

  for (const instance of cobaltInstances) {
    try {
      const response = await fetch(instance, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "SaveMyReelsBot/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Instance ${instance} returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.text || "API returned error status");
      }

      // Cobalt returns status: "stream" or "redirect" with a direct url
      if (data.url) {
        return {
          filePath: data.url, // Return direct URL as 'filePath'
          title: data.filename || "video",
          fileSize: 0, // Not locally downloaded, size is unknown
          isDirectUrl: true, // Marker to indicate this is a URL, not a local file path
        };
      }

      if (data.status === "picker") {
        // Multi-image post, pick the first slide link
        if (data.picker && data.picker.length > 0) {
          const firstSlide = data.picker[0];
          return {
            filePath: firstSlide.url,
            title: "slide_1",
            fileSize: 0,
            isDirectUrl: true,
          };
        }
      }

      throw new Error("No stream URL returned in JSON response");
    } catch (err) {
      console.warn(`⚠️ Failed using Cobalt instance ${instance}:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`DOWNLOAD_FAILED: ${lastError ? lastError.message : "All API instances failed"}`);
}

/**
 * Check if downloader is ready. Always true on API-mode.
 */
async function isYtDlpInstalled() {
  return true;
}

module.exports = { downloadVideo, isYtDlpInstalled };
