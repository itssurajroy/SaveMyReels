const fs = require("fs");
const path = require("path");
const https = require("https");
const { ensureDir } = require("./utils/helpers");

// Binaries directory
const binDir = path.join(__dirname, "../bin");
ensureDir(binDir);

// Determine yt-dlp download URL based on platform
const isWin = process.platform === "win32";
const filename = isWin ? "yt-dlp.exe" : "yt-dlp";
const targetPath = path.join(binDir, filename);

const YTDLP_URL = isWin
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

/**
 * Downloads a file with redirect support.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(
          new Error(`Failed to download: Status Code ${response.statusCode}`)
        );
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on("finish", () => {
        file.close(() => {
          console.log(`✅ Downloaded: ${path.basename(destPath)}`);
          resolve();
        });
      });

      file.on("error", (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log(`🎬 Downloading yt-dlp for ${process.platform}...`);
  try {
    await downloadFile(YTDLP_URL, targetPath);

    // Set execute permissions on Linux/Mac
    if (!isWin) {
      fs.chmodSync(targetPath, "755");
      console.log("🔓 Set execution permissions (chmod 755)");
    }
    console.log("🚀 yt-dlp setup complete!\n");
  } catch (err) {
    console.error("❌ Failed to download yt-dlp:", err.message);
    process.exit(1);
  }
}

main();
