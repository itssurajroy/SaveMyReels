const { detectPlatform, getPlatformLabel } = require("../utils/helpers");
const { downloadVideo } = require("../services/downloader");
const { checkRateLimit } = require("../services/rateLimiter");
const { logDownload, getUser } = require("../database/queries");
const config = require("../config");
const path = require("path");

/**
 * Register Telegram Inline Query Mode handler.
 * Users can type: @botname <video_url> in any chat to share downloads.
 */
function registerInlineHandler(bot) {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim();

    if (!query) {
      // Return empty response or instructions card if query is empty
      await ctx.answerInlineQuery([], {
        switch_pm_text: "💡 Paste video link to download...",
        switch_pm_parameter: "help",
      });
      return;
    }

    // Detect supported URL
    const detected = detectPlatform(query);
    if (!detected) {
      await ctx.answerInlineQuery([], {
        switch_pm_text: "❌ Unsupported URL. Copy an Instagram link.",
        switch_pm_parameter: "help",
      });
      return;
    }

    const { platform, url } = detected;

    // Redirect YouTube/TikTok
    if (platform === "youtube" || platform === "tiktok") {
      await ctx.answerInlineQuery([], {
        switch_pm_text: `🚫 ${platform === "youtube" ? "YouTube" : "TikTok"} not supported. Instagram only.`,
        switch_pm_parameter: "help",
      });
      return;
    }

    // Only process Instagram
    if (platform !== "instagram") {
      await ctx.answerInlineQuery([], {
        switch_pm_text: "❌ Unsupported URL. Copy an Instagram link.",
        switch_pm_parameter: "help",
      });
      return;
    }

    const userId = ctx.from.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      await ctx.answerInlineQuery([], {
        switch_pm_text: "🚫 Daily limit reached! Tap to upgrade.",
        switch_pm_parameter: "premium",
      });
      return;
    }

    // Prepare response card
    const resultId = Buffer.from(url).toString("base64").slice(0, 60);

    // Telegram inline query results can be articles with descriptions.
    // When the user clicks the card, we'll download and deliver it.
    // Note: To send files directly from inline query, they must be pre-uploaded.
    // Since we download dynamically, the best approach is to return an article card.
    // When clicked, it sends the video details as text, or redirects them to bot's PM.
    // Let's create an article that redirects to start downloading.
    await ctx.answerInlineQuery([
      {
        type: "article",
        id: resultId,
        title: `📥 Download ${getPlatformLabel(platform)} Video`,
        description: `Link: ${url}\nTap to send video downloader card in this chat.`,
        input_message_content: {
          message_text: `🎬 <b>Processing download via SaveMyReels...</b>\n\n🔗 Source: ${url}`,
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⚡ Click to Download & Send",
                url: `https://t.me/${bot.botInfo.username}?start=${resultId}`,
              },
            ],
          ],
        },
      },
    ], {
      cache_time: 0,
    });
  });
}

module.exports = { registerInlineHandler };
