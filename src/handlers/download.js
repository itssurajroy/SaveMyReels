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

    try {
      // Fetch the direct CDN URL from Cobalt API
      const result = await downloadVideo(url, quality);
      
      // Update progress message - sending video
      await ctx.api.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        messages.uploadingMessage(),
        { parse_mode: "HTML" }
      );

      // Deliver video using direct CDN URL (Telegram downloads it directly)
      const botInfo = await bot.api.getMe();
      await ctx.replyWithVideo(result.filePath, {
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
    } catch (error) {
      console.error(`Download error for ${url}:`, error.message);
      let errorMsg = messages.downloadErrorMessage();

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
