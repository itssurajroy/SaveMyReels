const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const config = require("../config");
const { detectPlatform } = require("../utils/helpers");

/**
 * Download a video using a custom downloader depending on the platform.
 * @param {string} url - The video URL
 * @param {string} quality - 'hd' or 'sd'
 * @param {Function} onProgress - Callback function: (percent, speed, eta) => {}
 * @returns {Promise<{ filePath: string, title: string, fileSize: number, fileSizeMB: string, caption: string }>}
 */
async function downloadVideo(url, quality = "hd", onProgress = null, signal = null) {
  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : null;

  if (platform === "instagram") {
    return await downloadInstagram(url, quality, onProgress, signal);
  }

  throw new Error("UNSUPPORTED_PLATFORM");
}

/**
 * Download helper using axios that writes to a temporary file.
 */
async function downloadFileFromUrl(url, destPath, onProgress, signal = null) {
  const response = await axios({
    method: "get",
    url: url,
    responseType: "stream",
    timeout: 30000,
    signal: signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    }
  });

  const totalLength = parseInt(response.headers["content-length"], 10) || 0;
  let downloadedLength = 0;
  const writer = fs.createWriteStream(destPath);

  response.data.on("data", (chunk) => {
    downloadedLength += chunk.length;
    if (onProgress && totalLength > 0) {
      const percent = (downloadedLength / totalLength) * 100;
      onProgress(percent, "N/A", "N/A");
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      resolve({ filePath: destPath, fileSize: downloadedLength });
    });
    writer.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Instagram-specific downloader with multiple fallback APIs.
 * Fallback chain: JerryCoder → ultra-igdl → vxinstagram
 */
async function downloadInstagram(url, quality, onProgress, signal = null) {
  const tempDir = os.tmpdir();
  let videoUrl = null;
  let caption = "";
  let mediaType = "video";

  // Try 1: Cobalt API (Primary on Vercel for H.264 compatibility)
  try {
    if (onProgress) onProgress(15, "N/A", "N/A");
    const cobaltResponse = await axios.post("https://api.cobalt.tools/api/json", {
      url: url,
      videoQuality: quality === "sd" ? "480" : "720",
      videoCodec: "h264", // Force H.264 format compatibility for Telegram inline player
      filenamePattern: "basic"
    }, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      timeout: 15000
    });
    if (cobaltResponse.data && cobaltResponse.data.url) {
      videoUrl = cobaltResponse.data.url;
    }
  } catch (err) {
    console.log(`Cobalt Instagram resolve failed: ${err.message}`);
  }

  // Try 2: JerryCoder API
  if (!videoUrl) {
    try {
      if (onProgress) onProgress(35, "N/A", "N/A");
      const { instagram } = require("@jerrycoder/instagram-api");
      const data = await Promise.race([
        instagram(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
      ]);
      if (data && data.url) {
        videoUrl = data.url;
        caption = data.caption || "";
      }
    } catch (err) {
      console.log(`JerryCoder API failed: ${err.message}`);
    }
  }

  // Try 3: ultra-igdl
  if (!videoUrl) {
    try {
      if (onProgress) onProgress(50, "N/A", "N/A");
      const { extractMedia } = require("ultra-igdl");
      const result = await Promise.race([
        extractMedia(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
      ]);
      
      if (result && result.media && result.media.length > 0) {
        // Get the first video media item
        const videoMedia = result.media.find(m => m.type === "video") || result.media[0];
        if (videoMedia && videoMedia.url) {
          videoUrl = videoMedia.url;
          caption = result.caption || "";
          mediaType = result.media.length > 1 ? "carousel" : "video";
        }
      }
    } catch (err) {
      console.log(`ultra-igdl failed: ${err.message}`);
    }
  }

  // Try 4: vxinstagram.com scraping
  if (!videoUrl) {
    try {
      if (onProgress) onProgress(65, "N/A", "N/A");
      const shortcodeMatch = url.match(/(?:reel|reels|p)\/([\w-]+)/);
      if (shortcodeMatch) {
        const shortcode = shortcodeMatch[1];
        const vxUrl = `https://vxinstagram.com/reel/${shortcode}/`;
        const res = await axios.get(vxUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          },
          timeout: 10000
        });
        const videoMatch = res.data.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                           res.data.match(/<meta\s+content="([^"]+)"\s+property="og:video"/i);
        if (videoMatch) {
          videoUrl = videoMatch[1];
        }
      }
    } catch (err) {
      console.log(`vxinstagram scraping failed: ${err.message}`);
    }
  }

  if (!videoUrl) {
    throw new Error("INSTAGRAM_RESOLVE_FAILED");
  }

  if (onProgress) onProgress(70, "N/A", "N/A");

  const destPath = path.join(tempDir, `insta_${Date.now()}.mp4`);
  const { filePath, fileSize } = await downloadFileFromUrl(videoUrl, destPath, onProgress, signal);
  const fileSizeMB = fileSize / (1024 * 1024);

  if (fileSizeMB > config.maxFileSizeMB) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new Error("FILE_TOO_LARGE");
  }

  if (onProgress) onProgress(100, "N/A", "N/A");

  return {
    filePath,
    videoUrl,
    title: "Instagram Reel",
    fileSize,
    fileSizeMB: fileSizeMB.toFixed(2),
    caption,
    mediaType
  };
}

/**
 * Get video metadata (title, thumbnail, duration) without downloading.
 * @param {string} url - The video URL
 * @returns {Promise<{title: string, thumbnail: string, duration: number, uploader: string, caption: string}>}
 */
async function getVideoInfo(url) {
  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : null;

  if (platform === "instagram") {
    // Try ultra-igdl first for better metadata
    try {
      const { extractMedia } = require("ultra-igdl");
      const result = await extractMedia(url);
      if (result) {
        return {
          title: result.caption || "Instagram Post",
          thumbnail: result.thumbnail || null,
          duration: result.duration || 0,
          uploader: result.owner?.username || "Instagram",
          caption: result.caption || "",
        };
      }
    } catch (err) {
      console.log(`ultra-igdl info failed: ${err.message}`);
    }

    // Fallback to JerryCoder
    try {
      const { instagram } = require("@jerrycoder/instagram-api");
      const data = await instagram(url);
      return {
        title: "Instagram Reel",
        thumbnail: data.thumbnail || null,
        duration: 0,
        uploader: "Instagram",
        caption: data.caption || "",
      };
    } catch {
      return {
        title: "Instagram Reel",
        thumbnail: null,
        duration: 0,
        uploader: "Instagram",
        caption: "",
      };
    }
  }

  throw new Error("INFO_FETCH_FAILED");
}

/**
 * Resolve direct video URL without downloading the file locally.
 */
async function resolveVideoUrl(url, quality = "hd") {
  const detected = detectPlatform(url);
  const platform = detected ? detected.platform : null;

  if (platform === "instagram") {
    // Try Cobalt API (Primary on Vercel for H.264 compatibility)
    try {
      const cobaltResponse = await axios.post("https://api.cobalt.tools/api/json", {
        url: url,
        videoQuality: quality === "sd" ? "480" : "720",
        videoCodec: "h264", // Force H.264 format compatibility for Telegram inline player
        filenamePattern: "basic"
      }, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        timeout: 12000
      });
      if (cobaltResponse.data && cobaltResponse.data.url) {
        return { videoUrl: cobaltResponse.data.url, title: "Instagram Reel", caption: "" };
      }
    } catch {}

    // Try JerryCoder
    try {
      const { instagram } = require("@jerrycoder/instagram-api");
      const data = await instagram(url);
      if (data && data.url) {
        return { videoUrl: data.url, title: "Instagram Reel", caption: data.caption || "" };
      }
    } catch {}

    // Try ultra-igdl
    try {
      const { extractMedia } = require("ultra-igdl");
      const result = await extractMedia(url);
      if (result && result.media && result.media.length > 0) {
        const videoMedia = result.media.find(m => m.type === "video") || result.media[0];
        if (videoMedia && videoMedia.url) {
          return { videoUrl: videoMedia.url, title: "Instagram Reel", caption: result.caption || "" };
        }
      }
    } catch {}

    // Try vxinstagram
    try {
      const shortcodeMatch = url.match(/(?:reel|reels|p)\/([\w-]+)/);
      if (shortcodeMatch) {
        const shortcode = shortcodeMatch[1];
        const res = await axios.get(`https://vxinstagram.com/reel/${shortcode}/`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          },
          timeout: 10000
        });
        const videoMatch = res.data.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                           res.data.match(/<meta\s+content="([^"]+)"\s+property="og:video"/i);
        if (videoMatch) {
          return { videoUrl: videoMatch[1], title: "Instagram Reel", caption: "" };
        }
      }
    } catch {}
  }
  return null;
}

module.exports = { downloadVideo, getVideoInfo, resolveVideoUrl };
