# WhatsApp HR Bot

WhatsApp-based HR issue tracker for recruitment teams.

The bot runs on your own WhatsApp account, listens to one configured group, extracts candidate-related issues using Groq AI, stores them in SQLite, and responds to `@BOT_NAME` commands.

## Features

- Connects through `whatsapp-web.js` with `LocalAuth` (session persists after first QR login).
- Monitors only one configured group (`GROUP_NAME`).
- Logs all monitored-group messages to `message_log` table.
- Extracts issues from normal messages using Groq model `llama-3.1-8b-instant`.
- Upserts issues in SQLite with frequency tracking (`issues` table).
- Handles `@BOT_NAME` commands and replies in plain WhatsApp text.
- Supports 24/7 run using PM2.

## Folder Structure

```text
hr-bot/
  index.js
  db.js
  extractor.js
  commands.js
  formatter.js
  .env
  .env.example
  package.json
  README.md
```

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm
- WhatsApp on your phone
- Groq API key

## Installation

```bash
cd "/Users/shekharnarayanmishra/Desktop/Whatsapp bot/hr-bot"
npm install
```

## Environment Setup

Create `.env` from `.env.example`:

```env
GROUP_NAME=HR Hiring Team
BOT_NAME=Shekhar
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
```

How to get values:
- `GROUP_NAME`: exact WhatsApp group title from Group Info.
- `BOT_NAME`: exact name used when someone mentions you in the group, without `@`.
- `GROQ_API_KEY`: create at https://console.groq.com/keys.

## First Run

```bash
npm start
```

On first run:
1. QR appears in terminal.
2. WhatsApp on phone -> Linked Devices -> Link a Device.
3. Scan QR.
4. Wait for `Bot is ready`.

## Commands (use in monitored group)

Send these as mentions:

- `@BOT_NAME help`
- `@BOT_NAME show all issues`
- `@BOT_NAME top issues`
- `@BOT_NAME new issues`
- `@BOT_NAME issues this month`
- `@BOT_NAME interview issues`
- `@BOT_NAME onboarding issues`
- `@BOT_NAME payment issues`
- `@BOT_NAME repeated problems`

## Database

Auto-created file: `hr_bot.db`

Tables:
- `issues`: stores normalized issue records with `frequency`, `first_seen`, `last_seen`
- `message_log`: stores incoming monitored-group messages and whether issue was detected

## Run with PM2 (24/7)

```bash
pm2 start index.js --name hr-bot
pm2 save
pm2 startup
```

Useful commands:

```bash
pm2 status hr-bot
pm2 logs hr-bot
pm2 restart hr-bot
pm2 stop hr-bot
```

Important: if PM2 is running, do not run `npm start` in another terminal simultaneously.

## Common Issues

1. `The browser is already running for .../.wwebjs_auth/session`
   - Cause: bot started twice (PM2 + npm start).
   - Fix: keep only one process running (`pm2 stop hr-bot` or close duplicate process).

2. Bot does not respond to commands
   - Cause: `BOT_NAME` mismatch.
   - Fix: set exact mention name without `@` in `.env`, then restart bot.

3. Bot ignores messages
   - Cause: `GROUP_NAME` mismatch.
   - Fix: copy exact group title including spaces/case/emojis, then restart.

## Security Notes

- Never commit `.env`.
- Rotate `GROQ_API_KEY` immediately if shared accidentally.
- Keep `.wwebjs_auth` private (it contains WhatsApp session data).
