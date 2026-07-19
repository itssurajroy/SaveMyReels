const { getUser, setQualityPref } = require("../database/queries");
const { qualityKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");

/**
 * Register settings handlers.
 */
function registerSettingsHandler(bot) {
  // /settings command
  bot.command("settings", async (ctx) => {
    await showSettings(ctx);
  });

  // Callback: settings button
  bot.callbackQuery("settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showSettings(ctx);
  });

  // Callback: set quality to SD
  bot.callbackQuery("set_quality_sd", async (ctx) => {
    const userId = ctx.from.id;
    await setQualityPref(userId, "sd");
    await ctx.answerCallbackQuery({ text: "✅ Quality set to SD (480p)" });
    await showSettings(ctx);
  });

  // Callback: set quality to HD
  bot.callbackQuery("set_quality_hd", async (ctx) => {
    const userId = ctx.from.id;
    await setQualityPref(userId, "hd");
    await ctx.answerCallbackQuery({ text: "✅ Quality set to HD (Best)" });
    await showSettings(ctx);
  });
}

/**
 * Show settings layout. Updates the existing message inline if triggered by a callback query.
 */
async function showSettings(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const quality = user ? user.quality_pref || "hd" : "hd";

  const text = messages.settingsMessage(quality);
  const replyMarkup = qualityKeyboard(quality);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } catch (err) {
      // Avoid crash if trying to edit with same content
    }
  } else {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  }
}

module.exports = { registerSettingsHandler };
