const { InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");
const { downloadVideo } = require("../services/downloader");
const { checkRateLimit } = require("../services/rateLimiter");
const { logDownload, getUser } = require("../database/queries");
const { extractAudio, trimVideo } = require("../services/mediaProcessor");
const {
  postDownloadKeyboard,
  limitReachedKeyboard,
  retryKeyboard,
  trimMenuKeyboard,
  ratingKeyboard,
} = require("../utils/keyboards");
const messages = require("../utils/messages");
const {
  detectPlatform,
  getPlatformLabel,
  formatDuration,
  cleanupFile,
} = require("../utils/helpers");

// Keep track of downloaded file paths temporarily so users can extract audio/trim them.
// In a production app, we cache these for 1 hour or clean them up via schedule.
const activeVideoCache = new Map();

/**
 * Helper to render dynamic progress bars.
 */
function getProgressBar(percent) {
  const totalBlocks = 10;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
}

/**
 * Register the download handler and callbacks.
 */
function registerDownloadHandler(bot) {
  // Listen for text messages with URLs
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith("/")) return;

    const detected = detectPlatform(text);
    if (!detected) {
      await ctx.reply(messages.unsupportedUrlMessage(), {
        parse_mode: "HTML",
      });
      return;
    }

    const { platform, url } = detected;
    const userId = ctx.from.id;

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      await ctx.reply(messages.limitReachedMessage(rateLimit.limit), {
        parse_mode: "HTML",
        reply_markup: limitReachedKeyboard(),
      });
      return;
    }

    const user = getUser(userId);
    const quality = user ? user.quality_pref || "hd" : "hd";

    // Progress bar throttling setup
    const progressMsg = await ctx.reply(
      messages.downloadStartMessage(getPlatformLabel(platform)),
      { parse_mode: "HTML" }
    );

    let lastEditTime = 0;
    const EDIT_INTERVAL = 2500; // 2.5 seconds throttle

    let filePath = null;

    try {
      const result = await downloadVideo(url, quality, async (percent, speed, eta) => {
        const now = Date.now();
        if (now - lastEditTime > EDIT_INTERVAL) {
          lastEditTime = now;
          const bar = getProgressBar(percent);
          const progressText =
            `⚡ <b>ＳＡＶＥＭＹＲＥＥＬＳ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
            `⬇️ <b>Processing: ${getPlatformLabel(platform)}</b>\n\n` +
            `<code>[${bar}] ${percent.toFixed(1)}%</code>\n` +
            `┌ 📈 Speed: <b>${speed}</b>\n` +
            `└ ⏳ Est. Time: <b>${eta}</b>\n\n` +
            `<i>Fetching video payload... please hold on.</i>`;

          try {
            await ctx.api.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              progressText,
              { parse_mode: "HTML" }
            );
          } catch {}
        }
      });

      filePath = result.filePath;
      const fileKey = Buffer.from(url).toString("base64").slice(0, 50);

      // Save to cache so they can perform quick actions (trim/extract audio)
      // We schedule automatic cleanup of the cached file after 15 minutes to save storage
      activeVideoCache.set(fileKey, {
        filePath,
        title: result.title,
        userId,
      });

      setTimeout(() => {
        const cached = activeVideoCache.get(fileKey);
        if (cached && cached.filePath === filePath) {
          activeVideoCache.delete(fileKey);
          cleanupFile(filePath);
        }
      }, 15 * 60 * 1000); // 15 mins

      // Update progress — uploading
      await ctx.api.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        messages.uploadingMessage(),
        { parse_mode: "HTML" }
      );

      // Send the video
      const botInfo = await bot.api.getMe();
      await ctx.replyWithVideo(new InputFile(filePath), {
        caption: messages.downloadCompleteMessage(
          getPlatformLabel(platform),
          rateLimit.used + 1,
          rateLimit.limit,
          formatDuration((Date.now() - nowStart) / 1000)
        ),
        parse_mode: "HTML",
        reply_markup: postDownloadKeyboard(botInfo.username, url),
      });

      // Log download
      logDownload(userId, url, platform);

      // Delete progress message
      try {
        await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
      } catch {}
    } catch (error) {
      console.error(`Download error for ${url}:`, error.message);
      let errorMsg =
        error.message === "FILE_TOO_LARGE"
          ? messages.fileTooLargeMessage()
          : messages.downloadErrorMessage();

      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          progressMsg.message_id,
          errorMsg,
          {
            parse_mode: "HTML",
            reply_markup: retryKeyboard(url),
          }
        );
      } catch {
        await ctx.reply(errorMsg, {
          parse_mode: "HTML",
          reply_markup: retryKeyboard(url),
        });
      }

      if (filePath) {
        await cleanupFile(filePath);
      }
    }
  });

  const nowStart = Date.now();

  // ─── CALLBACK QUERY HANDLERS ─────────────────────────────────

  // Callback: Extract Audio
  bot.callbackQuery(/^audio_(.+)$/, async (ctx) => {
    const fileKey = ctx.match[1];
    const cached = activeVideoCache.get(fileKey);

    if (!cached || !fs.existsSync(cached.filePath)) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Source file expired. Send the link again to extract audio.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: "🎵 Extracting audio..." });
    const infoMsg = await ctx.reply("🎵 <b>Extracting audio stream...</b>", {
      parse_mode: "HTML",
    });

    let audioPath = null;
    try {
      const result = await extractAudio(cached.filePath, cached.title);
      audioPath = result.filePath;

      await ctx.api.editMessageText(
        ctx.chat.id,
        infoMsg.message_id,
        "📤 <b>Sending audio file...</b>",
        { parse_mode: "HTML" }
      );

      await ctx.replyWithAudio(new InputFile(audioPath), {
        title: cached.title,
        performer: "SaveMyReels Bot",
      });

      try {
        await ctx.api.deleteMessage(ctx.chat.id, infoMsg.message_id);
      } catch {}
    } catch (err) {
      console.error(err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        infoMsg.message_id,
        "❌ <b>Audio extraction failed.</b>",
        { parse_mode: "HTML" }
      );
    } finally {
      if (audioPath) {
        await cleanupFile(audioPath);
      }
    }
  });

  // Callback: Trim Menu
  bot.callbackQuery(/^trim_(.+)$/, async (ctx) => {
    const fileKey = ctx.match[1];
    const cached = activeVideoCache.get(fileKey);

    if (!cached || !fs.existsSync(cached.filePath)) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Source file expired. Send the link again to trim.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply("✂️ <b>Select Trim duration:</b>", {
      parse_mode: "HTML",
      reply_markup: trimMenuKeyboard(fileKey),
    });
  });

  // Callback: Do Cut (15s or 30s)
  bot.callbackQuery(/^docut_(\d+)_(.+)$/, async (ctx) => {
    const duration = parseInt(ctx.match[1], 10);
    const fileKey = ctx.match[2];
    const cached = activeVideoCache.get(fileKey);

    if (!cached || !fs.existsSync(cached.filePath)) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Source file expired.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: `✂️ Trimming first ${duration}s...` });
    const infoMsg = await ctx.reply(`✂️ <b>Slicing first ${duration} seconds...</b>`, {
      parse_mode: "HTML",
    });

    let trimmedPath = null;
    try {
      const result = await trimVideo(cached.filePath, 0, duration);
      trimmedPath = result.filePath;

      await ctx.api.editMessageText(
        ctx.chat.id,
        infoMsg.message_id,
        "📤 <b>Sending trimmed clip...</b>",
        { parse_mode: "HTML" }
      );

      await ctx.replyWithVideo(new InputFile(trimmedPath), {
        caption: `✂️ Trimmed: First ${duration}s`,
      });

      try {
        await ctx.api.deleteMessage(ctx.chat.id, infoMsg.message_id);
      } catch {}
    } catch (err) {
      console.error(err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        infoMsg.message_id,
        "❌ <b>Trimming failed.</b>",
        { parse_mode: "HTML" }
      );
    } finally {
      if (trimmedPath) {
        await cleanupFile(trimmedPath);
      }
    }
  });

  // Callback: Custom Trim request
  bot.callbackQuery(/^docut_custom_(.+)$/, async (ctx) => {
    const fileKey = ctx.match[1];
    const cached = activeVideoCache.get(fileKey);

    if (!cached || !fs.existsSync(cached.filePath)) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Source file expired.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `✂️ <b>Custom Trim Interface</b>\n\n` +
      `Reply to this message with your desired duration in this format:\n` +
      `<code>00:05 - 00:20</code> (Start time - End time)\n\n` +
      `<i>Format: MM:SS - MM:SS or seconds (e.g. 5 - 20)</i>`,
      { parse_mode: "HTML" }
    );
  });

  // Callback: Rate Bot Keyboard
  bot.callbackQuery(/^rate_(.+)$/, async (ctx) => {
    const fileKey = ctx.match[1];
    await ctx.answerCallbackQuery();
    await ctx.reply("🌟 <b>Rate your experience:</b>", {
      parse_mode: "HTML",
      reply_markup: ratingKeyboard(fileKey),
    });
  });

  // Callback: Save Rating value
  bot.callbackQuery(/^rateval_(\d+)_(.+)$/, async (ctx) => {
    const score = parseInt(ctx.match[1], 10);
    await ctx.answerCallbackQuery({ text: "❤️ Thanks for rating!" });
    await ctx.editMessageText(`🌟 <b>Thank you!</b> You rated us ${"★".repeat(score)}${"☆".repeat(5-score)}`, {
      parse_mode: "HTML",
    });
  });
}

module.exports = { registerDownloadHandler };
