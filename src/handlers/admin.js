const { InlineKeyboard } = require("grammy");
const config = require("../config");
const queries = require("../database/queries");
const messages = require("../utils/messages");
const { broadcastConfirmKeyboard } = require("../utils/keyboards");
const { buildAffiliateLink } = require("../services/cuelinks");

// Temporary storage for pending broadcasts
const pendingBroadcasts = new Map();

/**
 * Register admin-only command handlers.
 */
function registerAdminHandler(bot) {
  // /deal command — start deal posting wizard
  bot.command("deal", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    // Start deal wizard session
    const session = { step: "awaiting_network" };
    await queries.saveSession(ctx.from.id, session);

    const keyboard = new InlineKeyboard()
      .text("🔗 Cuelinks", "deal_network_cuelinks")
      .text("📲 ExtraPe", "deal_network_extrape")
      .row()
      .text("❌ Cancel", "deal_cancel");

    await ctx.reply(
      "<b>🛍️ New Deal Poster</b>\nSelect the Affiliate Program for this deal:",
      { parse_mode: "HTML", reply_markup: keyboard }
    );
  });

  // Callback: select affiliate network
  bot.callbackQuery(/^deal_network_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCallbackQuery();

    const network = ctx.match[1];
    const session = ctx.session || {};
    
    session.step = "awaiting_url";
    session.network = network;
    await queries.saveSession(ctx.from.id, session);

    const keyboard = new InlineKeyboard().text("❌ Cancel", "deal_cancel");

    await ctx.editMessageText(
      `🔗 <b>Step 1: Product Link (${network === "cuelinks" ? "Cuelinks" : "ExtraPe"})</b>\n` +
      `Please paste the original Amazon or Flipkart product URL:`,
      { parse_mode: "HTML", reply_markup: keyboard }
    );
  });

  // Callback: cancel deal wizard
  bot.callbackQuery("deal_cancel", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCallbackQuery({ text: "Deal cancelled" });
    await queries.clearSession(ctx.from.id);
    await ctx.editMessageText("❌ <b>Deal poster cancelled.</b>", { parse_mode: "HTML" });
  });

  // Callback: move to media attachment step
  bot.callbackQuery("deal_media", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCallbackQuery();

    const session = ctx.session || {};
    session.step = "awaiting_media";
    await queries.saveSession(ctx.from.id, session);

    const keyboard = new InlineKeyboard().text("❌ Cancel", "deal_cancel");

    await ctx.editMessageText(
      "🎥 <b>Send Media</b>\nPlease send a video or photo to attach to this deal:",
      { parse_mode: "HTML", reply_markup: keyboard }
    );
  });

  // Callback: publish deal
  bot.callbackQuery("deal_publish", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    if (!config.forceChannels || config.forceChannels.length === 0) {
      await ctx.answerCallbackQuery({ text: "⚠️ No target channel configured!", show_alert: true });
      return;
    }

    const targetChannelEntry = config.forceChannels[0];
    const targetChannel = targetChannelEntry.split("#")[0].trim();
    const session = ctx.session || {};

    if (session.step !== "preview") {
      await ctx.answerCallbackQuery({ text: "⚠️ Wizard is not in preview state.", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: "🚀 Publishing..." });

    try {
      if (session.fileId) {
        if (session.mediaType === "photo") {
          await ctx.api.sendPhoto(targetChannel, session.fileId, {
            caption: session.caption,
            parse_mode: "HTML"
          });
        } else if (session.mediaType === "video") {
          await ctx.api.sendVideo(targetChannel, session.fileId, {
            caption: session.caption,
            parse_mode: "HTML"
          });
        }
      } else {
        await ctx.api.sendMessage(targetChannel, session.caption, {
          parse_mode: "HTML"
        });
      }

      await queries.clearSession(ctx.from.id);
      await ctx.editMessageText(`🚀 <b>Deal published successfully to ${targetChannel}!</b>`, {
        parse_mode: "HTML"
      });
    } catch (err) {
      console.error("❌ Deal publishing failed:", err);
      await ctx.reply(`❌ <b>Publishing failed:</b> ${err.message}`, { parse_mode: "HTML" });
    }
  });

  // Listen to step-by-step text inputs for deal poster wizard
  bot.on("message:text", async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) return next();
    
    const session = ctx.session || {};
    if (!session.step) return next();

    const text = ctx.message.text;

    // Awaiting URL step
    if (session.step === "awaiting_url") {
      session.originalUrl = text;

      if (session.network === "cuelinks") {
        await ctx.reply("🔄 Converting link via Cuelinks...");
        const affiliateUrl = await buildAffiliateLink(text);
        if (affiliateUrl && affiliateUrl !== text) {
          session.affiliateUrl = affiliateUrl;
          session.step = "awaiting_title";
          await queries.saveSession(ctx.from.id, session);
          await ctx.reply(
            `✅ Link auto-converted!\n\n` +
            `📝 <b>Step 2: Product Title</b>\n` +
            `Please send the product title (e.g. <i>Smart Bedside Lamp with Speaker</i>):`,
            { parse_mode: "HTML" }
          );
          return;
        } else {
          // Fallback to manual pasting
          session.step = "awaiting_affiliate_url";
          await queries.saveSession(ctx.from.id, session);
          await ctx.reply(
            `⚠️ Cuelinks conversion returned original link.\n\n` +
            `📲 Please paste your converted Cuelinks affiliate link manually:`,
            { parse_mode: "HTML" }
          );
          return;
        }
      } else {
        // ExtraPe requires manual pasting
        session.step = "awaiting_affiliate_url";
        await queries.saveSession(ctx.from.id, session);
        await ctx.reply(
          `📲 <b>ExtraPe Link Needed</b>\n` +
          `Please convert the product link using your ExtraPe app/bot, then paste your affiliate link here:`,
          { parse_mode: "HTML" }
        );
        return;
      }
    }

    // Awaiting manually pasted affiliate URL
    if (session.step === "awaiting_affiliate_url") {
      session.affiliateUrl = text;
      session.step = "awaiting_title";
      await queries.saveSession(ctx.from.id, session);
      await ctx.reply(
        `📝 <b>Step 2: Product Title</b>\n` +
        `Please send the product title (e.g. <i>Smart Bedside Lamp with Speaker</i>):`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Awaiting Product Title
    if (session.step === "awaiting_title") {
      session.title = text;
      session.step = "awaiting_mrp";
      await queries.saveSession(ctx.from.id, session);
      await ctx.reply(
        `❌ <b>Step 3: MRP (Original Price)</b>\n` +
        `Please send the original MRP (numbers only, e.g. <code>2499</code>):`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Awaiting MRP
    if (session.step === "awaiting_mrp") {
      const mrp = parseInt(text.replace(/[^\d]/g, ""), 10);
      if (isNaN(mrp) || mrp <= 0) {
        await ctx.reply("⚠️ Invalid MRP. Please send numbers only (e.g. <code>2499</code>):", { parse_mode: "HTML" });
        return;
      }
      session.mrp = mrp;
      session.step = "awaiting_deal_price";
      await queries.saveSession(ctx.from.id, session);
      await ctx.reply(
        `✅ <b>Step 4: Deal Price</b>\n` +
        `Please send the deal price (numbers only, e.g. <code>799</code>):`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Awaiting Deal Price
    if (session.step === "awaiting_deal_price") {
      const dealPrice = parseInt(text.replace(/[^\d]/g, ""), 10);
      if (isNaN(dealPrice) || dealPrice <= 0) {
        await ctx.reply("⚠️ Invalid deal price. Please send numbers only (e.g. <code>799</code>):", { parse_mode: "HTML" });
        return;
      }
      if (dealPrice >= session.mrp) {
        await ctx.reply("⚠️ Deal price must be lower than the MRP! Please enter a lower deal price:", { parse_mode: "HTML" });
        return;
      }
      session.dealPrice = dealPrice;
      
      // Calculate discount percentage
      const discount = Math.round(((session.mrp - dealPrice) / session.mrp) * 100);

      // Format caption
      const caption = 
        `🎬 <b>Cool Smart Gadget alert!</b>\n` +
        `🔥 <b>${session.title}</b>\n\n` +
        `❌ MRP: <del>₹${session.mrp.toLocaleString("en-IN")}</del>\n` +
        `✅ Deal Price: <b>₹${dealPrice.toLocaleString("en-IN")}</b> (${discount}% OFF!)\n\n` +
        `👉 <b>BUY NOW:</b> ${session.affiliateUrl}`;

      session.caption = caption;
      session.step = "preview";
      await queries.saveSession(ctx.from.id, session);

      const keyboard = new InlineKeyboard()
        .text("🎥 Attach Video/Photo", "deal_media")
        .row()
        .text("📤 Publish to Channel", "deal_publish")
        .text("❌ Cancel", "deal_cancel");

      await ctx.reply(
        `<b>✨ Deal Preview</b>\n\n` +
        `--------------------\n` +
        `${caption}\n` +
        `--------------------\n\n` +
        `Would you like to attach media or publish it directly?`,
        { parse_mode: "HTML", reply_markup: keyboard }
      );
      return;
    }

    // Awaiting text in media or preview state (unexpected)
    if (session.step === "awaiting_media" || session.step === "preview") {
      await ctx.reply("⚠️ Please use the preview/media buttons or cancel the flow.");
      return;
    }
  });

  // Listen to media (photo/video) inputs for the wizard
  bot.on(["message:photo", "message:video"], async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) return next();

    const session = ctx.session || {};
    if (session.step !== "awaiting_media") return next();

    let fileId, mediaType;
    if (ctx.message.photo) {
      const photoArray = ctx.message.photo;
      fileId = photoArray[photoArray.length - 1].file_id;
      mediaType = "photo";
    } else if (ctx.message.video) {
      fileId = ctx.message.video.file_id;
      mediaType = "video";
    }

    session.fileId = fileId;
    session.mediaType = mediaType;
    session.step = "preview";
    await queries.saveSession(ctx.from.id, session);

    const keyboard = new InlineKeyboard()
      .text("📤 Publish to Channel", "deal_publish")
      .row()
      .text("❌ Cancel", "deal_cancel");

    await ctx.reply("<b>✨ Deal Preview (with media attached)</b>", { parse_mode: "HTML" });

    if (mediaType === "photo") {
      await ctx.replyWithPhoto(fileId, {
        caption: session.caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    } else {
      await ctx.replyWithVideo(fileId, {
        caption: session.caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    }
  });
  // /stats command — show bot statistics
  bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    try {
      const stats = {
        totalUsers: await queries.getTotalUsers(),
        activeToday: await queries.getActiveUsersToday(),
        downloadsToday: await queries.getDownloadsToday(),
        totalDownloads: await queries.getTotalDownloads(),
        premiumUsers: await queries.getPremiumUserCount(),
        byPlatform: await queries.getDownloadsByPlatform(),
      };

      await ctx.reply(messages.adminStatsMessage(stats), {
        parse_mode: "HTML",
      });
    } catch (err) {
      console.error(err);
      await ctx.reply(`❌ Stats failed: ${err.message}`);
    }
  });

  // /broadcast <message> — send message to all users
  bot.command("broadcast", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const text = ctx.match;
    if (!text || text.trim() === "") {
      await ctx.reply(
        "⚠️ Usage: <code>/broadcast Your message here</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    try {
      const userIds = await queries.getAllUserIds();
      const userCount = userIds.length;

      // Store pending broadcast
      pendingBroadcasts.set(ctx.from.id, text.trim());

      await ctx.reply(
        messages.broadcastPreviewMessage(text.trim(), userCount),
        {
          parse_mode: "HTML",
          reply_markup: broadcastConfirmKeyboard(),
        }
      );
    } catch (err) {
      await ctx.reply(`❌ Broadcast check failed: ${err.message}`);
    }
  });

  // Callback: confirm broadcast
  bot.callbackQuery("broadcast_confirm", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCallbackQuery();

    const broadcastText = pendingBroadcasts.get(ctx.from.id);
    if (!broadcastText) {
      await ctx.reply("⚠️ No pending broadcast found. Use /broadcast again.");
      return;
    }

    pendingBroadcasts.delete(ctx.from.id);

    try {
      const userIds = await queries.getAllUserIds();
      let sent = 0;
      let failed = 0;

      // Edit message to show progress
      await ctx.editMessageText("📢 <b>Broadcasting...</b> (0%)", {
        parse_mode: "HTML",
      });

      for (let i = 0; i < userIds.length; i++) {
        try {
          await bot.api.sendMessage(userIds[i], broadcastText, {
            parse_mode: "HTML",
          });
          sent++;
        } catch {
          failed++;
        }

        // Update progress every 50 users
        if ((i + 1) % 50 === 0 || i === userIds.length - 1) {
          const percent = Math.round(((i + 1) / userIds.length) * 100);
          try {
            await ctx.api.editMessageText(
              ctx.chat.id,
              ctx.callbackQuery.message.message_id,
              `📢 <b>Broadcasting...</b> (${percent}%)\n📤 Sent: ${sent} | ❌ Failed: ${failed}`,
              { parse_mode: "HTML" }
            );
          } catch {}
        }

        // Rate limiting — Telegram allows ~30 messages/second
        if ((i + 1) % 25 === 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      await ctx.reply(messages.broadcastCompleteMessage(sent, failed), {
        parse_mode: "HTML",
      });
    } catch (err) {
      await ctx.reply(`❌ Broadcast failed: ${err.message}`);
    }
  });

  // Callback: cancel broadcast
  bot.callbackQuery("broadcast_cancel", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    pendingBroadcasts.delete(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "❌ Broadcast cancelled" });
    await ctx.editMessageText("❌ <b>Broadcast cancelled.</b>", {
      parse_mode: "HTML",
    });
  });

  // /ban <user_id> — ban a user
  bot.command("ban", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const targetId = parseInt(ctx.match, 10);
    if (!targetId) {
      await ctx.reply("⚠️ Usage: <code>/ban 123456789</code>", {
        parse_mode: "HTML",
      });
      return;
    }

    const user = await queries.getUser(targetId);
    if (!user) {
      await ctx.reply("⚠️ User not found in database.");
      return;
    }

    await queries.banUser(targetId);
    await ctx.reply(
      `🚫 <b>User banned:</b> ${targetId} (${user.first_name || "Unknown"})`,
      { parse_mode: "HTML" }
    );
  });

  // /unban <user_id> — unban a user
  bot.command("unban", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const targetId = parseInt(ctx.match, 10);
    if (!targetId) {
      await ctx.reply("⚠️ Usage: <code>/unban 123456789</code>", {
        parse_mode: "HTML",
      });
      return;
    }

    await queries.unbanUser(targetId);
    await ctx.reply(`✅ <b>User unbanned:</b> ${targetId}`, {
      parse_mode: "HTML",
    });
  });
}

function isAdmin(userId) {
  return config.adminIds.includes(userId);
}

module.exports = { registerAdminHandler };
