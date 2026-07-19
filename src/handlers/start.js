const { InputFile } = require("grammy");
const path = require("path");
const fs = require("fs");
const { createUser, getUser } = require("../database/queries");
const { mainMenuKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");
const { parseReferralCode } = require("../utils/helpers");

/**
 * Register the /start command handler with a visual welcome banner.
 */
function registerStartHandler(bot) {
  bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || "User";
    const username = ctx.from.username || null;

    // Check for referral deep link (/start ref_123456)
    const payload = ctx.match;
    const referrerId = parseReferralCode(payload);

    // Check if user is new
    const existingUser = getUser(userId);
    const isNewUser = !existingUser;

    if (isNewUser) {
      const validReferrer = referrerId && referrerId !== userId ? referrerId : null;
      createUser(userId, username, firstName, validReferrer);

      if (validReferrer) {
        try {
          await ctx.api.sendMessage(
            validReferrer,
            messages.newReferralMessage(firstName),
            { parse_mode: "HTML" }
          );
        } catch {}
      }
    }

    // Resolve welcome banner file path
    const bannerPath = path.join(__dirname, "../../assets/banner.png");
    const welcomeText = isNewUser ? messages.welcomeMessage(firstName) : messages.welcomeBackMessage(firstName);

    try {
      if (fs.existsSync(bannerPath)) {
        // Send banner with caption
        await ctx.replyWithPhoto(new InputFile(bannerPath), {
          caption: welcomeText,
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(),
        });
      } else {
        // Fallback to text message if banner file missing
        await ctx.reply(welcomeText, {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(),
        });
      }
    } catch (err) {
      console.error("⚠️ Failed to send start banner:", err.message);
      // Fallback
      await ctx.reply(welcomeText, {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard(),
      });
    }
  });
}

module.exports = { registerStartHandler };
