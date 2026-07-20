const { spawn, execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const config = require("../config");

// Resolve local yt-dlp binary path if available
const localYtdlpPath = path.join(__dirname, "../../bin/yt-dlp");
const localYtdlpWinPath = path.join(__dirname, "../../bin/yt-dlp.exe");
const ytdlpCmd = fs.existsSync(localYtdlpPath)
  ? localYtdlpPath
  : fs.existsSync(localYtdlpWinPath)
  ? localYtdlpWinPath
  : "yt-dlp";

/**
 * Download a video using yt-dlp with real-time progress callbacks.
 * @param {string} url - The video URL
 * @param {string} quality - 'hd' or 'sd'
 * @param {Function} onProgress - Callback function: (percent, speed, eta) => {}
 * @returns {Promise<{ filePath: string, title: string, fileSize: number }>}
 */
async function downloadVideo(url, quality = "hd", onProgress = null) {
  const downloadDir = path.join(__dirname, "../../downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const outputTemplate = path.join(
    downloadDir,
    `%(id)s_${Date.now()}.%(ext)s`
  );

  const args = [
    url,
    "-o",
    outputTemplate,
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificates",
    "--max-filesize",
    `${config.maxFileSizeMB}m`,
    "--merge-output-format",
    "mp4",
    "--restrict-filenames",
    "--newline", // Output progress details line by line
  ];

  if (quality === "sd") {
    args.push("-f", "worst[ext=mp4]/worst");
  } else {
    args.push(
      "-f",
      "best[ext=mp4][filesize<50M]/best[ext=mp4]/best[filesize<50M]/best"
    );
  }

  return new Promise((resolve, reject) => {
    const process = spawn(ytdlpCmd, args);
    let lastStdoutLine = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        lastStdoutLine = line;

        // Parse progress details (e.g., "[download]  35.2% of 12.44MiB at  2.12MiB/s ETA 00:03")
        if (onProgress && line.includes("[download]") && line.includes("%")) {
          const percentMatch = line.match(/(\d+\.\d+)%/);
          const speedMatch = line.match(/at\s+(\S+\/s)/);
          const etaMatch = line.match(/ETA\s+(\S+)/);

          if (percentMatch) {
            const percent = parseFloat(percentMatch[1]);
            const speed = speedMatch ? speedMatch[1] : "N/A";
            const eta = etaMatch ? etaMatch[1] : "N/A";
            onProgress(percent, speed, eta);
          }
        }
      }
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        if (errorOutput.includes("Private") || errorOutput.includes("login")) {
          return reject(new Error("PRIVATE_ACCOUNT"));
        }
        if (errorOutput.includes("not a valid URL") || errorOutput.includes("Unsupported URL")) {
          return reject(new Error("INVALID_URL"));
        }
        if (errorOutput.includes("File is larger than max-filesize")) {
          return reject(new Error("FILE_TOO_LARGE"));
        }
        if (errorOutput.includes("geo") || errorOutput.includes("not available")) {
          return reject(new Error("GEO_RESTRICTED"));
        }
        return reject(new Error(`DOWNLOAD_FAILED: ${errorOutput || "Unknown exit error"}`));
      }

      try {
        const files = fs.readdirSync(downloadDir);
        let newestFile = null;
        let newestTime = 0;

        for (const file of files) {
          const fullPath = path.join(downloadDir, file);
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && stats.mtimeMs > newestTime) {
            newestFile = fullPath;
            newestTime = stats.mtimeMs;
          }
        }

        if (!newestFile) {
          return reject(new Error("DOWNLOAD_FAILED: Output file not resolved"));
        }

        const stats = fs.statSync(newestFile);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > config.maxFileSizeMB) {
          try { fs.unlinkSync(newestFile); } catch {}
          return reject(new Error("FILE_TOO_LARGE"));
        }

        resolve({
          filePath: newestFile,
          title: path.basename(newestFile, path.extname(newestFile)),
          fileSize: stats.size,
          fileSizeMB: fileSizeMB.toFixed(2),
        });
      } catch (err) {
        reject(new Error(`DOWNLOAD_RESOLVE_FAILED: ${err.message}`));
      }
    });
  });
}

/**
 * Check if yt-dlp is installed and accessible.
 */
async function isYtDlpInstalled() {
  return new Promise((resolve) => {
    execFile(ytdlpCmd, ["--version"], (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        console.log(`✅ yt-dlp version: ${stdout.trim()}`);
        resolve(true);
      }
    });
  });
}

module.exports = { downloadVideo, isYtDlpInstalled };
