const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const config = require("../config");
const { ensureDir } = require("../utils/helpers");

/**
 * Extract audio (MP3) from video using ffmpeg.
 * @param {string} videoPath - Absolute path to the source video
 * @param {string} title - Title for the audio metadata
 * @returns {Promise<{ filePath: string, duration: number }>}
 */
async function extractAudio(videoPath, title = "Audio Extract") {
  ensureDir(config.downloadDir);
  const outputPath = path.join(
    config.downloadDir,
    `audio_${path.basename(videoPath, path.extname(videoPath))}.mp3`
  );

  const args = [
    "-y", // Overwrite output files
    "-i",
    videoPath,
    "-vn", // Disable video
    "-acodec",
    "libmp3lame",
    "-ab",
    "192k", // Quality
    "-metadata",
    `title=${title}`,
    "-metadata",
    "artist=SaveMyReels Bot",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 60000 }, (error) => {
      if (error) {
        return reject(new Error(`AUDIO_EXTRACTION_FAILED: ${error.message}`));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error("AUDIO_EXTRACTION_FAILED: File not created"));
      }

      resolve({
        filePath: outputPath,
        title,
      });
    });
  });
}

/**
 * Trim video using ffmpeg.
 * @param {string} videoPath - Absolute path to source video
 * @param {string} startTime - Format "HH:MM:SS" or seconds (e.g. "0" or "00:00:00")
 * @param {string|number} duration - Duration in seconds or format
 * @returns {Promise<{ filePath: string }>}
 */
async function trimVideo(videoPath, startTime, duration) {
  ensureDir(config.downloadDir);
  const ext = path.extname(videoPath) || ".mp4";
  const outputPath = path.join(
    config.downloadDir,
    `trimmed_${Date.now()}${ext}`
  );

  const args = [
    "-y",
    "-ss",
    startTime.toString(),
    "-i",
    videoPath,
    "-t",
    duration.toString(),
    "-c",
    "copy", // Direct stream copy (extremely fast, no re-encoding)
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 60000 }, (error) => {
      if (error) {
        // If stream copy fails (due to keyframe alignment), try re-encoding
        console.warn("⚠️ Stream copy failed. Retrying with encoding...");
        const fallbackArgs = [
          "-y",
          "-ss",
          startTime.toString(),
          "-i",
          videoPath,
          "-t",
          duration.toString(),
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          outputPath,
        ];

        execFile(ffmpegPath, fallbackArgs, { timeout: 60000 }, (fallbackError) => {
          if (fallbackError) {
            return reject(new Error(`TRIM_FAILED: ${fallbackError.message}`));
          }
          if (!fs.existsSync(outputPath)) {
            return reject(new Error("TRIM_FAILED: Output file not found"));
          }
          resolve({ filePath: outputPath });
        });
      } else {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("TRIM_FAILED: Output file not found"));
        }
        resolve({ filePath: outputPath });
      }
    });
  });
}

module.exports = { extractAudio, trimVideo };
