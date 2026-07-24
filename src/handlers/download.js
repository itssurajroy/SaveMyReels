const { InlineKeyboard } = require("grammy");
const { downloadVideo, resolveVideoUrl } = require("../services/downloader");
const { checkRateLimit } = require("../services/rateLimiter");
const { logDownload, getUser, getCachedFile, addLog } = require("../database/queries");

// Track active downloads by user ID to allow aborting them
const activeControllers = new Map();
const {
  postDownloadKeyboard,
  limitReachedKeyboard,
  retryKeyboard,
} = require("../utils/keyboards");
const messages = require("../utils/messages");
const {
  detectPlatform,
  getPlatformLabel,
  formatDuration,
} = require("../utils/helpers");
const { sendActivityLog, formatUserLog } = require("../services/activityLogger");

/**
 * Register the download handler.
 */
function registerDownloadHandler(bot) {
  // Listen for text messages with URLs
  bot.on("message:text", async (ctx, next) => {
    // Bypass if in the middle of a wizard flow
    if (ctx.session && ctx.session.step) {
      return next();
    }

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

    // Process supported platforms
    if (platform !== "instagram") {
      await ctx.reply(messages.unsupportedUrlMessage(), {
        parse_mode: "HTML",
      });
      return;
    }

    const userId = ctx.from.id;

    // Check rate limit (must await since queries are async now!)
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      const { trackEvent } = require("../database/queries");
      await trackEvent(userId, "limit_reached", { limit: rateLimit.limit });

      await ctx.reply(messages.limitReachedMessage(rateLimit.limit), {
        parse_mode: "HTML",
        reply_markup: limitReachedKeyboard(),
      });
      return;
    }

    const user = await getUser(userId);
    const quality = user ? user.quality_pref || "hd" : "hd";

    // Send processing starting message with Cancel button
    const progressMsg = await ctx.reply(
      messages.downloadStartMessage(getPlatformLabel(platform)),
      { 
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("❌ Cancel Download", "cancel_download")
      }
    );

    // Try sending from cache first to make downloads instant
    const cachedFileId = await getCachedFile(url);
    if (cachedFileId) {
      try {
        ctx.api.sendChatAction(ctx.chat.id, "upload_video").catch(() => {});
        const botInfo = await bot.api.getMe();
        const caption = messages.downloadCompleteMessage(
          getPlatformLabel(platform),
          rateLimit.used + 1,
          rateLimit.limit,
          "Instant ⚡"
        );

        const sentMessage = await ctx.replyWithVideo(cachedFileId, {
          caption,
          parse_mode: "HTML",
          reply_markup: postDownloadKeyboard(botInfo.username, url),
        });

        await logDownload(userId, url, platform, cachedFileId);

        sendActivityLog(
          ctx.api,
          `📥 <b>Instagram Export Activity</b>\n\n` +
          `${formatUserLog(ctx.from, userId)}\n` +
          `🔗 <b>URL:</b> ${url}\n` +
          `⚡ <b>Type:</b> Instant Cache Delivery`
        ).catch(() => {});

        if (sentMessage && sentMessage.message_id) {
          setTimeout(() => {
            ctx.api.deleteMessage(ctx.chat.id, sentMessage.message_id).catch(() => {});
          }, 60 * 60 * 1000);
        }

        try {
          await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
        } catch {}
        return;
      } catch (err) {
        console.log(`Failed to send cached file_id, falling back to download: ${err.message}`);
      }
    }

    // Try sending by URL first (takes <1s, 0 server resources/bandwidth)
    try {
      const resolved = await resolveVideoUrl(url, quality);
      if (resolved && resolved.videoUrl) {
        ctx.api.sendChatAction(ctx.chat.id, "upload_video").catch(() => {});
        const botInfo = await bot.api.getMe();
        const captionSuffix = messages.downloadCompleteMessage(
          getPlatformLabel(platform),
          rateLimit.used + 1,
          rateLimit.limit,
          "Instant ⚡"
        );
        const captionText = resolved.title ? `🎥 <b>${resolved.title}</b>\n\n${captionSuffix}` : captionSuffix;

        // Route stream through Vercel proxy to bypass Telegram IP/hotlink blocks
        const proxyUrl = `https://save-my-reels.vercel.app/api/video-proxy?url=${encodeURIComponent(resolved.videoUrl)}`;
        const sentMessage = await ctx.replyWithVideo(proxyUrl, {
          caption: captionText,
          parse_mode: "HTML",
          reply_markup: postDownloadKeyboard(botInfo.username, url),
        });

        const fileId = sentMessage?.video?.file_id || null;
        await logDownload(userId, url, platform, fileId);

        if (sentMessage && sentMessage.message_id) {
          setTimeout(() => {
            ctx.api.deleteMessage(ctx.chat.id, sentMessage.message_id).catch(() => {});
          }, 60 * 60 * 1000);
        }

        try {
          await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
        } catch {}
        return;
      }
    } catch (urlSendError) {
      console.log(`Failed to send by direct URL, falling back to download: ${urlSendError.message}`);
    }

    // Show typing indicator
    ctx.api.sendChatAction(ctx.chat.id, "upload_video").catch(() => {});

    const startTime = Date.now();

    let result = null;
    try {
      // Progress callback — update the message with real-time download progress
      let lastUpdate = 0;
      const onProgress = (percent, speed, eta) => {
        // Throttle edits to max once per 3 seconds to avoid Telegram rate limits
        const now = Date.now();
        if (now - lastUpdate < 3000) return;
        lastUpdate = now;

        // Refresh typing indicator every update
        ctx.api.sendChatAction(ctx.chat.id, "upload_video").catch(() => {});

        const bar = "█".repeat(Math.round(percent / 10)) + "░".repeat(10 - Math.round(percent / 10));
        const text =
          `⬇️ <b>Downloading...</b>\n\n` +
          `<code>[${bar}] ${percent.toFixed(1)}%</code>\n\n` +
          `⚡ Speed: <b>${speed}</b>  •  ETA: <b>${eta}</b>`;

        ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, text, {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("❌ Cancel Download", "cancel_download")
        }).catch(() => {});
      };

      // Set abort controller for this download
      const controller = new AbortController();
      activeControllers.set(userId, controller);

      // Download video locally
      result = await downloadVideo(url, quality, onProgress, controller.signal);
      
      // Clear controller
      activeControllers.delete(userId);
      
      // Update progress message - sending video
      await ctx.api.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        messages.uploadingMessage(),
        { parse_mode: "HTML" }
      );
 
      // Build caption with post caption if available
      const botInfo = await bot.api.getMe();
      const { InputFile } = require("grammy");
      let caption = messages.downloadCompleteMessage(
        getPlatformLabel(platform),
        rateLimit.used + 1,
        rateLimit.limit,
        formatDuration((Date.now() - startTime) / 1000)
      );
      
      // Append post caption if available
      if (result.caption) {
        const truncatedCaption = result.caption.length > 200 
          ? result.caption.substring(0, 200) + "..." 
          : result.caption;
        caption = `${caption}\n\n📝 <b>Caption:</b>\n<blockquote>${truncatedCaption}</blockquote>`;
      }
 
      // Deliver video using grammy InputFile (local file upload)
      const sentMessage = await ctx.replyWithVideo(new InputFile(result.filePath), {
        caption,
        parse_mode: "HTML",
        reply_markup: postDownloadKeyboard(botInfo.username, url),
      });
      result.sentMessage = sentMessage;
      
      const fileId = sentMessage?.video?.file_id || null;
 
      // Log download in cloud DB
      await logDownload(userId, url, platform, fileId);

      // Schedule auto-delete of the video message after 1 hour
      const videoMsg = result.sentMessage;
      if (videoMsg && videoMsg.message_id) {
        setTimeout(() => {
          ctx.api.deleteMessage(ctx.chat.id, videoMsg.message_id).catch(() => {});
        }, 60 * 60 * 1000); // 1 hour
      }

      // Clean up progress message
      try {
        await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
      } catch {}

      // Clean up local temp file
      try {
        const fs = require("fs");
        if (result && result.filePath && fs.existsSync(result.filePath)) {
          fs.unlinkSync(result.filePath);
        }
      } catch (unlinkErr) {
        console.error("Temp file deletion failed:", unlinkErr.message);
      }
    } catch (error) {
      activeControllers.delete(userId);

      // Check if download was aborted/cancelled by user
      if (
        error.message === "ABORTED" || 
        error.code === "ERR_CANCELED" || 
        error.name === "AbortError" || 
        error.message.includes("canceled")
      ) {
        console.log(`Download for ${url} was aborted by user.`);
        return;
      }

      console.error(`Download error for ${url}:`, error.message);
      await addLog(`[ERROR] Download error for ${url}: ${error.message} - Stack: ${error.stack}`);
      
      // Schedule cleaning up local temp file after 5 minutes to allow user to download it
      if (result && result.filePath) {
        setTimeout(() => {
          try {
            const fs = require("fs");
            if (fs.existsSync(result.filePath)) {
              fs.unlinkSync(result.filePath);
            }
          } catch (err) {
            console.error("Delayed cleanup failed:", err.message);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }

      // Fallback if URL was successfully resolved but Telegram delivery failed
      if (result) {
        try {
          const downloadLink = result.videoUrl || `https://save-my-reels.vercel.app/api/download-file?path=${encodeURIComponent(result.filePath)}`;
          const directText = `⚠️ <b>Delivery Notice</b>\n` +
            `Telegram was unable to process the video for inline playback. You can download it directly:\n\n` +
            `📥 <a href="${downloadLink}"><b>Direct Download Link</b></a>\n\n` +
            `<i>(This link expires soon. Tap to open and save the media.)</i>`;
          
          await ctx.api.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            directText,
            {
              parse_mode: "HTML",
              disable_web_page_preview: true
            }
          );
          // Log download in cloud DB
          await logDownload(userId, url, platform);
          return;
        } catch (fallbackErr) {
          console.error("Fallback edit failed:", fallbackErr.message);
        }
      }


      let errorCode = "ERR_DOWNLOAD_FAILED";
      if (error.message.includes("status 403") || error.message.includes("403")) {
        errorCode = "ERR_PRIVATE_PROFILE";
      } else if (error.message.includes("status 404") || error.message.includes("404")) {
        errorCode = "ERR_NOT_FOUND";
      } else if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        errorCode = "ERR_GATEWAY_TIMEOUT";
      }

      let errorMsg = messages.downloadErrorMessage(errorCode);
 
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
    }
  });

  // Callback: Cancel download
  bot.callbackQuery("cancel_download", async (ctx) => {
    const userId = ctx.from.id;
    const controller = activeControllers.get(userId);
    if (controller) {
      controller.abort();
      activeControllers.delete(userId);
      await ctx.answerCallbackQuery({ text: "🛑 Download cancelled." });
      try {
        await ctx.editMessageText("❌ <b>Download cancelled by user.</b>", {
          parse_mode: "HTML",
        });
      } catch {}
    } else {
      await ctx.answerCallbackQuery({ text: "⚠️ No active download to cancel." });
      try {
        await ctx.editMessageText("❌ <b>Download expired or already completed.</b>", {
          parse_mode: "HTML",
        });
      } catch {}
    }
  });

  // Callback: Retry download
  bot.callbackQuery(/^retry_/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const encoded = ctx.callbackQuery.data.replace("retry_", "");
    try {
      const url = Buffer.from(encoded, "base64").toString("utf-8");
      await ctx.reply(
        `🔄 Please send the link again to retry:\n<code>${url}</code>`,
        { parse_mode: "HTML" }
      );
    } catch {
      await ctx.reply("⚠️ Please send the link again to retry.");
    }
  });

  // Callback: Rate Bot Keyboard (stub)
  bot.callbackQuery(/^rateval_(\d+)_(.+)$/, async (ctx) => {
    const score = parseInt(ctx.match[1], 10);
    await ctx.answerCallbackQuery({ text: "❤️ Thanks for rating!" });
    await ctx.editMessageText(`🌟 <b>Thank you!</b> You rated us ${"★".repeat(score)}${"☆".repeat(5-score)}`, {
      parse_mode: "HTML",
    });
  });
}

module.exports = { registerDownloadHandler };
