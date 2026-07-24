const config = require("../config");
const { isPremiumActive, getPremiumExpiry, activatePremium } = require("../database/queries");
const { premiumKeyboard, backKeyboard } = require("../utils/keyboards");
const messages = require("../utils/messages");

/**
 * Register premium handlers.
 */
function registerPremiumHandler(bot) {
  // /premium command
  bot.command("premium", async (ctx) => {
    await showPremiumInfo(ctx);
  });

  // Callback: premium_info button
  bot.callbackQuery("premium_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showPremiumInfo(ctx);
  });

  // Callback: buy_premium button — send Telegram Stars invoice
  bot.callbackQuery("buy_premium", async (ctx) => {
    await ctx.answerCallbackQuery();

    const userId = ctx.from.id;

    // Check if already premium
    if (await isPremiumActive(userId)) {
      const expiry = await getPremiumExpiry(userId);
      const expiryDate = expiry
        ? new Date(expiry).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "Unknown";
      await ctx.reply(messages.alreadyPremiumMessage(expiryDate), {
        parse_mode: "HTML",
      });
      return;
    }

    // Send Telegram Stars invoice
    await ctx.replyWithInvoice(
      "⭐ SaveMyReels Premium",
      "Unlimited Instagram video downloads for 30 days!",
      "premium_30d", // payload
      "XTR", // Telegram Stars currency code
      [{ label: "Premium (30 days)", amount: config.premiumPriceStars }]
    );
  });

  // Handle pre-checkout query
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // Handle successful payment
  bot.on("message:successful_payment", async (ctx) => {
    const userId = ctx.from.id;
    const payment = ctx.message.successful_payment;

    if (payment.invoice_payload === "premium_30d") {
      // Activate premium for 30 days
      await activatePremium(userId, config.premiumDurationDays);

      const expiry = await getPremiumExpiry(userId);
      const expiryDate = expiry
        ? new Date(expiry).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "30 days from now";

      await ctx.reply(messages.premiumActivatedMessage(expiryDate), {
        parse_mode: "HTML",
      });

      const { sendActivityLog, formatUserLog } = require("../services/activityLogger");
      sendActivityLog(
        ctx.api,
        `💎 <b>PREMIUM PURCHASE ALERT</b>\n\n` +
        `${formatUserLog(ctx.from, userId)}\n` +
        `💰 <b>Amount:</b> ${config.premiumPriceStars} Telegram Stars\n` +
        `📅 <b>Expires:</b> ${expiryDate}`
      ).catch(() => {});

      console.log(
        `💎 Premium activated for user ${userId} (${ctx.from.username || "no username"})`
      );
    }
  });
}

/**
 * Show premium info message.
 */
async function showPremiumInfo(ctx) {
  const userId = ctx.from.id;
  const isPremium = await isPremiumActive(userId);

  let text, replyMarkup;
  if (isPremium) {
    const expiry = await getPremiumExpiry(userId);
    const expiryDate = expiry
      ? new Date(expiry).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Unknown";
    text = messages.alreadyPremiumMessage(expiryDate);
    replyMarkup = backKeyboard();
  } else {
    text = messages.premiumInfoMessage(config.premiumPriceStars);
    replyMarkup = premiumKeyboard();
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } catch (err) {
      // Fallback to sending new message if edit fails
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    }
  } else {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  }
}

module.exports = { registerPremiumHandler };
