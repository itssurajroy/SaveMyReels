const { downloadVideo } = require("../services/downloader");
const { checkRateLimit } = require("../services/rateLimiter");
const { logDownload, getUser } = require("../database/queries");
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

    // Send processing starting message
    const progressMsg = await ctx.reply(
      messages.downloadStartMessage(getPlatformLabel(platform)),
      { parse_mode: "HTML" }
    );

    const startTime = Date.now();

    let result = null;
    try {
      // Download video locally using yt-dlp
      result = await downloadVideo(url, quality);
      
      // Update progress message - sending video
      await ctx.api.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        messages.uploadingMessage(),
        { parse_mode: "HTML" }
      );
 
      // Deliver video using grammy InputFile (local file upload)
      const botInfo = await bot.api.getMe();
      const { InputFile } = require("grammy");
      await ctx.replyWithVideo(new InputFile(result.filePath), {
        caption: messages.downloadCompleteMessage(
          getPlatformLabel(platform),
          rateLimit.used + 1,
          rateLimit.limit,
          formatDuration((Date.now() - startTime) / 1000)
        ),
        parse_mode: "HTML",
        reply_markup: postDownloadKeyboard(botInfo.username, url),
      });
 
      // Log download in cloud DB
      await logDownload(userId, url, platform);
 
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
      console.error(`Download error for ${url}:`, error.message);
      
      // Clean up local temp file if it was created
      try {
        const fs = require("fs");
        if (result && result.filePath && fs.existsSync(result.filePath)) {
          fs.unlinkSync(result.filePath);
        }
      } catch {}

      // Fallback if URL was successfully resolved but Telegram delivery failed
      if (result && result.filePath) {
        try {
          const directText = `⚠️ <b>Delivery Notice</b>\n` +
            `Telegram was unable to process the video for inline playback. You can download it directly:\n\n` +
            `📥 <a href="${result.filePath}"><b>Direct Download Link</b></a>\n\n` +
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
