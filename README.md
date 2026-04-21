# WhatsApp HR Support Bot

A WhatsApp-based conversational support bot for recruitment teams. It runs on your own WhatsApp account, silently listens to every message in the configured group, auto-detects candidate issues using Groq AI, stores them in SQLite — and when tagged, responds intelligently to both HR admin queries and individual candidate support conversations.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Feature 1 — Passive Issue Listener](#feature-1--passive-issue-listener)
- [Feature 2 — HR Admin Commands (@shekhar)](#feature-2--hr-admin-commands-shekhar)
- [Feature 3 — Conversational Support Bot (@WhatsApp JID)](#feature-3--conversational-support-bot-whatsapp-jid)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [First Run](#first-run)
- [Database](#database)
- [Run with PM2](#run-with-pm2-247)
- [Common Issues](#common-issues)
- [Security Notes](#security-notes)

---

## How It Works

The bot operates in **three modes simultaneously**:

1. **Passive Listener** — reads every group message and extracts issues silently using AI.
2. **HR Admin Mode** — when tagged with `@shekhar <command>`, returns data from the issue database.
3. **Candidate Support Mode** — when tagged with the operator's WhatsApp JID, starts a guided support conversation with the candidate.

---

## Feature 1 — Passive Issue Listener

The bot **hears every conversation** in the monitored WhatsApp group. It doesn't need to be tagged. For every message, it:

1. Sends the message to Groq AI (`llama-3.1-8b-instant`) for issue detection.
2. If an issue is identified, saves it to the `issues` table with category, summary, and frequency tracking.
3. Logs all messages (issue or not) to the `message_log` table.

This means the HR team gets a live database of all candidate problems — even ones never explicitly reported to the bot.

---

## Feature 2 — HR Admin Commands (`@shekhar`)

HR team members can query the issue database at any time by tagging the bot with `@shekhar <command>` in the group.

### Available Commands

| Command | Description |
|---|---|
| `@shekhar help` | Lists all available commands |
| `@shekhar show all issues` | All tracked issues with frequency and last seen date |
| `@shekhar top issues` | Top 5 most frequently reported issues |
| `@shekhar new issues` | Issues reported in the last 7 days |
| `@shekhar issues this month` | Issues from the last 30 days |
| `@shekhar interview issues` | Issues filtered by Interview category |
| `@shekhar onboarding issues` | Issues filtered by Onboarding category |
| `@shekhar payment issues` | Issues filtered by Payment/Stipend category |
| `@shekhar repeated problems` | Issues seen 3 or more times |
| `@shekhar test summary` | Daily snapshot: total issues, new today, top repeated |

### Screenshots

> **`@shekhar help`** — command menu

![Help command showing available commands list](screenshots/help_command.jpg)

> **`@shekhar show all issues`** — querying the issue database

![Show all issues command displaying logged candidate issues](screenshots/show_all_issues.jpg)

---

## Feature 3 — Conversational Support Bot (WhatsApp JID)

This is the candidate-facing support system. It's triggered using the **operator's WhatsApp JID** — not a keyword like `@shekhar`, but your actual WhatsApp mention (e.g. `@Vedansha Srivastava`).

### How Tagging via JID Works

In WhatsApp, when you type `@` in a group chat, your contacts pop up. The operator's phone number is set in `.env` as `BOT_NAME`, and when someone selects the operator's contact from that list, it creates a JID-based mention. This is how `@Vedansha Srivastava` in the screenshot triggers the support flow.

### Full Conversation Flow

**Step 1 — Candidate tags the bot**

```
@Vedansha Srivastava help
```

Bot responds with the category menu:

```
Hi! I'm here to help.

I noticed you're facing an issue. Let me help you quickly.

Please select your issue category by replying with a number:

1. Assessment / Test link
2. Portal / Login
3. Interview
4. Onboarding
5. Payment / Stipend
6. Document / Offer letter
7. Other (describe your issue)

Reply with just the number.
```

**Step 2 — Category selection**

Candidate replies with a number (e.g. `3` for Interview).  
Bot shows sub-issues for that category:

```
You selected: Interview

What exactly is the issue? Reply with a number:

1. Link not received
2. Technical issue during interview
3. Unable to join interview room
4. No interviewer joined
5. Other (type your issue briefly)
```

**Step 3 — Issue selection**

Candidate picks a sub-issue. Bot replies with a pre-built or AI-generated step-by-step solution.

**Step 4 — "Other" / Free-text path (Option 7)**

If the candidate picks `7. Other` at the category level:

```
Please describe your issue briefly in one message.
```

Candidate types their issue freely (e.g. `Assessment not submitting`).  
Bot sends it to **Groq AI** and responds with a custom step-by-step solution.

**Step 5 — Resolution confirmation**

After every solution:

```
Did this help?
Reply YES if resolved or NO if you still need help.
```

- **YES** → Issue marked resolved. Bot sends a closing message.
- **NO** → Issue is escalated to the admin number configured in `.env`.

**Step 6 — Escalation (if unresolved)**

```
I understand, let me escalate this to the HR team.
Someone will get back to you shortly.

Your issue has been flagged as: Assessment not submitting
Reference: #14
```

A private WhatsApp message is also sent to `BOT_ADMIN_NUMBER` with the sender details and issue summary, so a human can follow up directly.

### Screenshots

> **Triggering the support flow** — `@Vedansha Srivastava help` opens the category menu

![Tagging with WhatsApp JID triggering the category selection menu](screenshots/jid_trigger_category.jpg)

> **"Other" flow** — candidate types a custom issue, Groq AI generates a solution

![Other category flow showing free text input and AI-generated solution](screenshots/other_flow_solution.jpg)

> **Resolution confirmed** — candidate replies YES, bot closes the conversation

![Candidate replies YES and bot sends resolved confirmation message](screenshots/resolved_confirmation.jpg)

---

## Folder Structure

```text
Whatsapp_bot/
  index.js                # Entry point — WhatsApp client, message routing
  conversationManager.js  # Guided support conversation state machine
  db.js                   # SQLite database layer (issues, conversations, message log)
  extractor.js            # Groq-powered passive issue extraction
  commands.js             # HR admin query commands (@shekhar)
  formatter.js            # Text formatting helpers
  scheduler.js            # Stale conversation cleanup scheduler
  screenshots/            # README screenshots
  .env                    # Your environment variables (not committed)
  .env.example            # Environment variable template
  package.json
  README.md
```

---

## Prerequisites

- Node.js 18+ (latest LTS recommended)
- npm
- WhatsApp on your phone (for QR login)
- Groq API key — free at [https://console.groq.com/keys](https://console.groq.com/keys)

---

## Installation

```bash
git clone https://github.com/vedansha07/Whatsapp_bot.git
cd Whatsapp_bot
npm install
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
GROUP_NAME=HR Hiring Team
BOT_NAME=YourBotName
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
BOT_ADMIN_NUMBER=919XXXXXXXXXX
HR_MEMBER_NUMBERS=919111111111,919222222222
```

| Variable | Description |
|---|---|
| `GROUP_NAME` | Exact WhatsApp group title (copy from Group Info — case and emoji sensitive) |
| `BOT_NAME` | The name used to mention the bot in the group with `@`, **without** the `@` symbol |
| `GROQ_API_KEY` | Your Groq API key from [console.groq.com](https://console.groq.com/keys) |
| `BOT_ADMIN_NUMBER` | Phone number (with country code, no `+`) to receive escalation alerts privately |
| `HR_MEMBER_NUMBERS` | Comma-separated HR staff numbers — bot distinguishes them from candidates |

---

## First Run

```bash
npm start
```

On first run:
1. A QR code appears in the terminal.
2. On your phone: **WhatsApp → Linked Devices → Link a Device**.
3. Scan the QR code.
4. Wait for `Bot is ready`.

The session is saved locally in `.wwebjs_auth/` — you won't need to scan again on restart.

---

## Database

Auto-created SQLite file: `hr_bot.db`

| Table | Contents |
|---|---|
| `issues` | Normalized issues with `category`, `issue_summary`, `frequency`, `first_seen`, `last_seen`, `resolved` |
| `conversations` | Active candidate conversation state — current step, selected category, issue description |
| `message_log` | All group messages with sender, timestamp, and whether an issue was detected |

---

## Run with PM2 (24/7)

```bash
npm install -g pm2
pm2 start index.js --name hr-bot
pm2 save
pm2 startup
```

Useful PM2 commands:

```bash
pm2 status hr-bot
pm2 logs hr-bot
pm2 restart hr-bot
pm2 stop hr-bot
```

> **Important:** Do not run `npm start` while PM2 is already running the bot — this causes a WhatsApp session conflict.

---

## Common Issues

**1. `The browser is already running for .../.wwebjs_auth/session`**
- Cause: Bot started twice (PM2 + `npm start`).
- Fix: Stop one process — run `pm2 stop hr-bot` before using `npm start`.

**2. Bot doesn't respond to `@BOT_NAME` commands**
- Cause: `BOT_NAME` mismatch between `.env` and how members actually mention the contact.
- Fix: Set the exact name without `@` in `.env` and restart.

**3. Bot ignores all group messages**
- Cause: `GROUP_NAME` mismatch.
- Fix: Copy the exact group title from Group Info (including spaces, case, and emojis), restart.

**4. Escalation alert not sent to admin**
- Cause: `BOT_ADMIN_NUMBER` missing or incorrectly formatted.
- Fix: Use full number with country code but without `+` (e.g. `919580134022`).

**5. Groq AI solution not generating**
- Cause: `GROQ_API_KEY` missing or invalid.
- Fix: Check your key at [console.groq.com](https://console.groq.com/keys) and update `.env`.

---

## Security Notes

- Never commit `.env` — it is already in `.gitignore`.
- Rotate `GROQ_API_KEY` immediately if accidentally shared.
- Keep `.wwebjs_auth/` private — it contains your active WhatsApp session credentials.
