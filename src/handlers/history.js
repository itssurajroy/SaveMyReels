const { InlineKeyboard } = require("grammy");
const { getDownloadHistory, getDownloadById } = require("../database/queries");
const { backKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");
const { getPlatformLabel } = require("../utils/helpers");

/**
 * Register the /history command handler.
 */
function registerHistoryHandler(bot) {
  // /history command
  bot.command("history", async (ctx) => {
    await showHistory(ctx);
  });

  // Callback: history button
  bot.callbackQuery("history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showHistory(ctx);
  });

  // Callback: re-download from history (by download ID)
  bot.callbackQuery(/^redownload_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const downloadId = parseInt(ctx.match[1], 10);
    try {
      const record = await getDownloadById(downloadId);
      if (!record) {
        await ctx.reply("⚠️ Download record not found. It may have been cleared.");
        return;
      }
      const url = record.url;
      await ctx.reply(
        `📥 <b>Re-downloading...</b>\n\n<code>${url}</code>\n\nSend this link to the bot to download again, or tap below:`,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().url(
            "📥 Open in Bot",
            `https://t.me/${ctx.botInfo.username}?start=redownload`
          ),
        }
      );
    } catch {
      await ctx.reply("⚠️ Could not retrieve URL. Please send the link manually.");
    }
  });
}

/**
 * Show download history with re-download buttons.
 */
async function showHistory(ctx) {
  const userId = ctx.from.id;
  const history = await getDownloadHistory(userId, 10);

  if (!history || history.length === 0) {
    const text = messages.emptyHistoryMessage();
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: backKeyboard(),
        });
      } catch {
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: backKeyboard() });
      }
    } else {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: backKeyboard() });
    }
    return;
  }

  const lines = [`📂 <b>Your Recent Downloads</b>\n`];
  const kb = new InlineKeyboard();

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const platform = getPlatformLabel(item.platform);
    const date = new Date(item.downloaded_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const time = new Date(item.downloaded_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    lines.push(`${i + 1}. ${platform} • ${date} ${time}`);
    kb.text(`${i + 1}. Re-download`, `redownload_${item.id}`).row();
  }

  kb.row();
  kb.text("🔙 Back to Menu", "back_to_menu");

  const text = lines.join("\n");

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
    } catch {
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  }
}

module.exports = { registerHistoryHandler };
