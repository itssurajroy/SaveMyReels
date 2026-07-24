const { InlineKeyboard } = require("grammy");
const config = require("../config");
const { getUser, setQualityPref, setCaptionPref, setNotifyPref } = require("../database/queries");
const { getPlatformLabel } = require("../utils/helpers");

const SAAS_HEADER = `⚡ <b>ＳＡＶＥＭＹＲＥＥＬＳ   ＷＩＺＡＲＤ</b>\n━━━━━━━━━━━━━━━━━━━━\n`;

/**
 * Register the interactive setup wizard handlers.
 */
function registerWizardHandler(bot) {
  // /wizard command
  bot.command("wizard", async (ctx) => {
    await showWizardStep1(ctx);
  });

  // Callback: start wizard
  bot.callbackQuery("start_wizard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWizardStep1(ctx);
  });

  // Step 1: Quality Selection
  bot.callbackQuery("wizard_step_1", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWizardStep1(ctx);
  });

  bot.callbackQuery(/^wizard_set_quality_(hd|sd)$/, async (ctx) => {
    const quality = ctx.match[1];
    const userId = ctx.from.id;
    await setQualityPref(userId, quality);
    await ctx.answerCallbackQuery({ text: `✅ Quality set to ${quality.toUpperCase()}` });
    await showWizardStep2(ctx);
  });

  // Step 2: Caption Formatting
  bot.callbackQuery("wizard_step_2", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWizardStep2(ctx);
  });

  bot.callbackQuery(/^wizard_set_caption_(full|clean|hashtags)$/, async (ctx) => {
    const captionPref = ctx.match[1];
    const userId = ctx.from.id;
    await setCaptionPref(userId, captionPref);
    await ctx.answerCallbackQuery({ text: `✅ Caption style updated!` });
    await showWizardStep3(ctx);
  });

  // Step 3: Notification Preference
  bot.callbackQuery("wizard_step_3", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWizardStep3(ctx);
  });

  bot.callbackQuery(/^wizard_set_notify_(instant|silent)$/, async (ctx) => {
    const notifyPref = ctx.match[1];
    const userId = ctx.from.id;
    await setNotifyPref(userId, notifyPref);
    await ctx.answerCallbackQuery({ text: `✅ Notification setting updated!` });
    await showWizardStep4(ctx);
  });

  // Step 4: Finish Summary
  bot.callbackQuery("wizard_finish", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWizardStep4(ctx);
  });
}

/**
 * Step 1: Video Quality Preference
 */
async function showWizardStep1(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const quality = user ? user.quality_pref || "hd" : "hd";

  const text =
    SAAS_HEADER +
    `🧙‍♂️ <b>Interactive Setup Wizard — Step 1 of 4</b>\n\n` +
    `🎬 <b>Choose Preferred Video Resolution:</b>\n\n` +
    `┌ 💎 <b>HD (Best Quality)</b>: Maximum resolution & sharpest audio.\n` +
    `└ ⚡ <b>SD (Data Saver)</b>: Compressed format for slower connections.\n\n` +
    `<i>Current setting: <b>${quality.toUpperCase()}</b></i>`;

  const kb = new InlineKeyboard()
    .text(quality === "hd" ? "✅ 💎 HD (1080p)" : "💎 HD (1080p)", "wizard_set_quality_hd")
    .text(quality === "sd" ? "✅ ⚡ SD (480p)" : "⚡ SD (480p)", "wizard_set_quality_sd")
    .row()
    .text("➡️ Skip to Step 2", "wizard_step_2");

  await sendOrEditMessage(ctx, text, kb);
}

/**
 * Step 2: Caption & Hashtag Preference
 */
async function showWizardStep2(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const captionPref = user ? user.caption_pref || "full" : "full";

  const text =
    SAAS_HEADER +
    `🧙‍♂️ <b>Interactive Setup Wizard — Step 2 of 4</b>\n\n` +
    `📝 <b>How would you like video captions formatted?</b>\n\n` +
    `┌ 📜 <b>Full Caption</b>: Include original text description & hashtags.\n` +
    `├ 🎬 <b>Clean Video</b>: Deliver video only without text payload.\n` +
    `└ #️⃣ <b>Hashtags Only</b>: Extract tags for easy reposting.\n\n` +
    `<i>Current setting: <b>${captionPref.toUpperCase()}</b></i>`;

  const kb = new InlineKeyboard()
    .text(captionPref === "full" ? "✅ 📜 Full Caption" : "📜 Full Caption", "wizard_set_caption_full")
    .row()
    .text(captionPref === "clean" ? "✅ 🎬 Clean Video Only" : "🎬 Clean Video Only", "wizard_set_caption_clean")
    .row()
    .text(captionPref === "hashtags" ? "✅ #️⃣ Hashtags Only" : "#️⃣ Hashtags Only", "wizard_set_caption_hashtags")
    .row()
    .text("⬅️ Back", "wizard_step_1")
    .text("➡️ Next", "wizard_step_3");

  await sendOrEditMessage(ctx, text, kb);
}

/**
 * Step 3: Delivery Notification Preference
 */
async function showWizardStep3(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const notifyPref = user ? user.notify_pref || "instant" : "instant";

  const text =
    SAAS_HEADER +
    `🧙‍♂️ <b>Interactive Setup Wizard — Step 3 of 4</b>\n\n` +
    `🔔 <b>Choose Delivery Notification Mode:</b>\n\n` +
    `┌ ⚡ <b>Instant Alert</b>: Loud notification with sound when ready.\n` +
    `└ 🔕 <b>Silent Delivery</b>: Muted notification to avoid distraction.\n\n` +
    `<i>Current setting: <b>${notifyPref.toUpperCase()}</b></i>`;

  const kb = new InlineKeyboard()
    .text(notifyPref === "instant" ? "✅ ⚡ Instant Alert" : "⚡ Instant Alert", "wizard_set_notify_instant")
    .text(notifyPref === "silent" ? "✅ 🔕 Silent Delivery" : "🔕 Silent Delivery", "wizard_set_notify_silent")
    .row()
    .text("⬅️ Back", "wizard_step_2")
    .text("➡️ Next", "wizard_step_4");

  await sendOrEditMessage(ctx, text, kb);
}

/**
 * Step 4: Summary Card & Instant Link Tester
 */
async function showWizardStep4(ctx) {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  const quality = user ? (user.quality_pref || "hd").toUpperCase() : "HD";
  const captionPref = user ? (user.caption_pref || "full").toUpperCase() : "FULL";
  const notifyPref = user ? (user.notify_pref || "instant").toUpperCase() : "INSTANT";

  const { sendActivityLog, formatUserLog } = require("../services/activityLogger");
  sendActivityLog(
    ctx.api,
    `🧙‍♂️ <b>Setup Wizard Configured</b>\n\n` +
    `${formatUserLog(ctx.from, userId)}\n` +
    `💎 Quality: <b>${quality}</b> | 📝 Caption: <b>${captionPref}</b> | 🔔 Notify: <b>${notifyPref}</b>`
  ).catch(() => {});

  let webappUrl = config.webappUrl || "";
  if (webappUrl && !webappUrl.startsWith("http")) {
    webappUrl = `https://${webappUrl}`;
  }

  const text =
    SAAS_HEADER +
    `🎉 <b>Wizard Setup Complete!</b>\n\n` +
    `Your personal Instagram downloader configuration:\n\n` +
    `┌ 💎 Resolution: <b>${quality}</b>\n` +
    `├ 📝 Caption Style: <b>${captionPref}</b>\n` +
    `├ 🔔 Notifications: <b>${notifyPref}</b>\n` +
    `└ 📸 Target Platform: <b>Instagram Reels & Posts</b>\n\n` +
    `🚀 <b>Ready to Download!</b>\n` +
    `Paste any Instagram link directly in this chat to test your setup! ⚡`;

  const kb = new InlineKeyboard();
  if (webappUrl) {
    kb.webApp("🚀 Open Web Dashboard", `${webappUrl}/app`).row();
  }
  kb.text("🔙 Return to Main Menu", "back_to_menu");

  await sendOrEditMessage(ctx, text, kb);
}

/**
 * Helper to edit existing message or send a new one.
 */
async function sendOrEditMessage(ctx, text, replyMarkup) {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return;
    } catch {}
  }
  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

module.exports = { registerWizardHandler };
