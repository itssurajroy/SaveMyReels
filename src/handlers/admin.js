const config = require("../config");
const queries = require("../database/queries");
const messages = require("../utils/messages");
const { broadcastConfirmKeyboard } = require("../utils/keyboards");

// Temporary storage for pending broadcasts
const pendingBroadcasts = new Map();

/**
 * Register admin-only command handlers.
 */
function registerAdminHandler(bot) {
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
