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
let cachedInstances = null;
let cacheTime = 0;

/**
 * Get active community Cobalt instances for the target platform.
 * Fetches dynamic list from cobalt.directory to bypass Vercel/AWS IP blocking.
 */
async function getWorkingInstances(platform = "instagram") {
  const now = Date.now();
  
  // Cache for 10 minutes to prevent API spamming
  if (cachedInstances && (now - cacheTime < 600000)) {
    return cachedInstances[platform] || cachedInstances["instagram"] || [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const res = await fetch("https://cobalt.directory/api/working?type=api", {
      signal: controller.signal,
      headers: { "User-Agent": "SaveMyReelsBot/1.0" }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const body = await res.json();
      if (body && body.data) {
        cachedInstances = body.data;
        cacheTime = now;
        const list = cachedInstances[platform] || cachedInstances["instagram"] || [];
        if (list.length > 0) return list;
      }
    }
  } catch (err) {
    console.warn("⚠️ Failed to fetch live Cobalt directory:", err.message);
  }

  // Robust static fallback list
  return [
    "https://rue-cobalt.xenon.zone",
    "https://cobalt.omega.wolfy.love",
    "https://nuko-c.meowing.de",
    "https://api.cobalt.liubquanti.click",
    "https://melon.clxxped.lol",
    "https://grapefruit.clxxped.lol",
    "https://cobalt.alpha.wolfy.love",
    "https://lime.clxxped.lol",
    "https://api-cobalt.eversiege.network",
    "https://api.qwkuns.me"
  ];
}

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

  // Determine platform for optimized instance lookup
  let platform = "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
  } else if (url.includes("tiktok.com")) {
    platform = "tiktok";
  }

  // Fetch dynamic, working community mirrors
  const instances = await getWorkingInstances(platform);

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

  let lastError = null;

  for (const instance of instances) {
    try {
      const apiUrl = instance.endsWith("/api/json") ? instance : `${instance.replace(/\/$/, "")}/api/json`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "SaveMyReelsBot/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Instance returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.text || "API returned error status");
      }

      // Cobalt returns status: "stream" or "redirect" with a direct url
      if (data.url) {
        return {
          filePath: data.url,
          title: data.filename || "video",
          fileSize: 0,
          isDirectUrl: true,
        };
      }

      if (data.status === "picker") {
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
