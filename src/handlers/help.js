const { backKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");

/**
 * Register the /help command handler.
 */
function registerHelpHandler(bot) {
  // /help command
  bot.command("help", async (ctx) => {
    await ctx.reply(messages.helpMessage(), {
      parse_mode: "HTML",
      reply_markup: backKeyboard(),
    });
  });

  // Callback: help button
  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageText(messages.helpMessage(), {
        parse_mode: "HTML",
        reply_markup: backKeyboard(),
      });
    } catch {
      await ctx.reply(messages.helpMessage(), {
        parse_mode: "HTML",
        reply_markup: backKeyboard(),
      });
    }
  });
}

module.exports = { registerHelpHandler };
