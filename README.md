# 🎬 SaveMyReels — Instagram Video Downloader Telegram Bot

A feature-rich Telegram bot that downloads videos from **Instagram (Reels, Posts, Carousels)** — with a complete monetization system built in.

## 💰 Revenue Streams

1. **Freemium Model** — 5 free downloads/day, unlimited with premium (50 Telegram Stars/month)
2. **Forced Channel Joins** — Grow your audience for sponsored posts
3. **Multi-Channel Slots** — Charge others to add their channel to the required list
4. **Referral System** — Viral loop with +3 downloads/referral incentive

## ✨ Features

- 📸 **Instagram Reels, Posts & Carousels** download
- ⭐ **Telegram Stars** payment integration
- 👥 **Referral system** with stacking bonus downloads
- 📢 **Forced channel joins** (multiple channels supported)
- ⚙️ **Quality selection** (SD/HD)
- 📊 **Admin dashboard** (/stats, /broadcast, /ban)
- 🔄 **Progress messages** and retry on failure
- 🧹 **Auto-cleanup** of temporary files

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 18+ installed
2. **yt-dlp** installed ([download here](https://github.com/yt-dlp/yt-dlp))
3. **ffmpeg** installed ([download here](https://ffmpeg.org/download.html))
4. A **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd SaveMyReels

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env

# 4. Edit .env with your values
# BOT_TOKEN=your_token_here
# ADMIN_IDS=your_telegram_id
# FORCE_CHANNELS=@yourchannel

# 5. Run the bot
npm run dev
```

### Getting Your Telegram User ID

Send `/start` to [@userinfobot](https://t.me/userinfobot) to get your Telegram user ID for the `ADMIN_IDS` field.

## 📝 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | ✅ Yes | — | Bot token from @BotFather |
| `ADMIN_IDS` | ✅ Yes | — | Comma-separated admin Telegram IDs |
| `FORCE_CHANNELS` | No | — | Channels users must join (e.g., `@channel1,@channel2`) |
| `DAILY_FREE_LIMIT` | No | `5` | Free downloads per day |
| `REFERRAL_BONUS` | No | `3` | Extra downloads per referral |
| `PREMIUM_PRICE_STARS` | No | `50` | Premium price in Telegram Stars |
| `PREMIUM_DURATION_DAYS` | No | `30` | Premium duration in days |
| `MAX_FILE_SIZE_MB` | No | `50` | Max video file size (Telegram limit) |
| `DEFAULT_QUALITY` | No | `hd` | Default quality (`hd` or `sd`) |

## 📋 Bot Commands

### User Commands
- `/start` — Welcome message + main menu
- `/premium` — Premium info + purchase
- `/referral` — Your referral link + stats
- `/settings` — Video quality preference
- `/help` — Usage instructions

### Admin Commands
- `/stats` — Bot statistics (users, downloads, revenue)
- `/broadcast <message>` — Send message to all users
- `/ban <user_id>` — Ban a user
- `/unban <user_id>` — Unban a user

## 🚀 Deploy to Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway auto-installs `yt-dlp` and `ffmpeg` via `nixpacks.toml`
5. Bot starts automatically!

## 📁 Project Structure

```
SaveMyReels/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Environment config
│   ├── database/
│   │   ├── init.js           # SQLite schema
│   │   └── queries.js        # Database queries
│   ├── handlers/
│   │   ├── start.js          # /start + referral tracking
│   │   ├── download.js       # URL → download → send video
│   │   ├── premium.js        # Premium + Telegram Stars
│   │   ├── referral.js       # Referral link + stats
│   │   ├── help.js           # Help message
│   │   ├── settings.js       # Quality preference
│   │   └── admin.js          # /stats, /broadcast, /ban
│   ├── services/
│   │   ├── downloader.js     # yt-dlp wrapper
│   │   ├── channelCheck.js   # Channel membership check
│   │   └── rateLimiter.js    # Daily download limits
│   ├── middleware/
│   │   └── auth.js           # User reg + ban + channel check
│   └── utils/
│       ├── keyboards.js      # Inline keyboard builders
│       ├── messages.js       # Message templates
│       └── helpers.js        # URL detection + utilities
├── .env.example
├── .gitignore
├── package.json
├── Procfile
├── railway.json
├── nixpacks.toml
└── README.md
```

## 📈 Growth Tips

1. **Post bot link** in Instagram Reels comments and related subreddits
2. **Create content** about the bot on TikTok/YouTube
3. **Leverage the referral system** — users naturally share for bonus downloads
4. **Sell channel slots** — once you hit 10K+ users, charge others for forced-join placement
5. **Engage your channel** — post memes, updates, and sponsored content

## 📄 License

MIT
