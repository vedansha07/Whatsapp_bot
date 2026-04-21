# WhatsApp HR Support Bot

A WhatsApp-based conversational support bot for recruitment teams. It runs on your own WhatsApp account, silently listens to every message in the configured group, auto-detects candidate issues using Groq AI, stores them in SQLite — and when tagged, responds intelligently to both HR admin queries and individual candidate support conversations.

> **Bot name is fully configurable** — set `BOT_NAME` in your `.env` file to any name you want. All `@BOT_NAME` references in this guide refer to whatever name you configure.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Feature 1 — Passive Issue Listener](#feature-1--passive-issue-listener)
- [Feature 2 — HR Admin Commands](#feature-2--hr-admin-commands)
- [Feature 3 — Conversational Support Bot](#feature-3--conversational-support-bot)
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
2. **HR Admin Mode** — when tagged with `@BOT_NAME <command>`, returns data from the issue database.
3. **Candidate Support Mode** — when tagged via the operator's WhatsApp JID, starts a guided multi-step support conversation.

---

## Feature 1 — Passive Issue Listener

The bot **hears every conversation** in the monitored group. It doesn't need to be tagged. For every message, it:

1. Sends the message text to Groq AI (`llama-3.1-8b-instant`) for issue detection.
2. If an issue is identified, saves it to the `issues` table with category, summary, and frequency tracking.
3. Logs all messages (issue or not) to `message_log`.

This means the HR team gets a live database of all candidate problems — even ones never explicitly reported to the bot.

---

## Feature 2 — HR Admin Commands

Tag the bot with `@BOT_NAME <command>` in the monitored group to query the issue database.

> **`BOT_NAME` is set in your `.env` file.** For example, if you set `BOT_NAME=shekhar`, the trigger is `@shekhar`. Change it to any name by updating `.env`.

### Available Commands

| Command | Description |
|---|---|
| `@BOT_NAME help` | Lists all available commands |
| `@BOT_NAME show all issues` | All tracked issues with frequency and last seen date |
| `@BOT_NAME top issues` | Top 5 most frequently reported issues |
| `@BOT_NAME new issues` | Issues reported in the last 7 days |
| `@BOT_NAME issues this month` | Issues from the last 30 days |
| `@BOT_NAME interview issues` | Issues filtered by Interview category |
| `@BOT_NAME onboarding issues` | Issues filtered by Onboarding category |
| `@BOT_NAME payment issues` | Issues filtered by Payment/Stipend category |
| `@BOT_NAME repeated problems` | Issues seen 3 or more times |
| `@BOT_NAME test summary` | Daily snapshot: total issues, new today, top repeated |

### Screenshots

> **`@BOT_NAME help`** — lists all commands; **`@BOT_NAME show all issues`** — returns logged issues from the database

![Help command and show all issues command in the HR group](screenshots/help_command.jpg)

![Show all issues displaying multiple logged candidate issues](screenshots/show_all_issues.jpg)

---

## Feature 3 — Conversational Support Bot

This is the candidate-facing support system. It is triggered using the **operator's WhatsApp JID** — i.e., your actual WhatsApp mention (e.g. `@Vedansha Srivastava`), not a keyword.

### How Tagging via WhatsApp JID Works

When someone types `@` in a WhatsApp group, their contacts appear as suggestions. The bot operator's phone number (set as `BOT_NAME` in `.env`) corresponds to a real WhatsApp account, so when a candidate selects the operator's contact from the suggestion list, it creates a JID-based mention that triggers the support flow.

### Full Conversation Flow

**Step 1 — Candidate tags the bot with their JID**

```
@Vedansha Srivastava help
```

Bot responds with the issue category menu:

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

> *Screenshot: JID trigger → category menu → candidate selects Assessment*

![Candidate tags the bot via WhatsApp JID, category menu appears, then sub-category menu for Assessment](screenshots/jid_trigger_full_flow.jpg)

---

**Step 2 — Sub-category selection**

After picking a category (e.g. `1` for Assessment / Test link), the bot shows specific issue options:

```
You selected: Assessment / Test link

What exactly is the issue? Reply with a number:

1. I did not receive the test link
2. Test link has expired
3. Test link is not opening
4. I submitted the test but got no confirmation
5. Other (type your issue briefly)

Reply with a number or type your issue.
```

Candidate picks a number → bot returns a pre-built or AI-generated step-by-step solution.

> *Screenshot: Sub-category selection → solution → resolution prompt*

![Sub-category selection showing Test link not opening solution](screenshots/subcategory_solution.jpg)

---

**Step 3 — "Other" / Free-text path (Option 7)**

If the candidate picks `7` at the category level:

```
Please describe your issue briefly in one message.
```

Candidate types their issue freely (e.g. `Assessment not submitting`).  
Bot sends it to **Groq AI** and returns a custom step-by-step solution.

> *Screenshot: "Other" flow — free-text input → AI-generated solution*

![Other flow showing free text input and Groq AI generated solution](screenshots/other_flow_solution.jpg)

---

**Step 4 — Resolution confirmation**

After every solution, the bot asks:

```
Did this help?
Reply YES if resolved or NO if you still need help.
```

- **YES** → Issue marked resolved. Bot sends a closing message:

```
Great! Glad your issue is resolved.
If you face any other issue, feel free to tag me anytime.
```

> *Screenshot: Candidate replies YES → resolved*

![Candidate replies YES and bot confirms resolution](screenshots/resolved_confirmation.jpg)

---

**Step 5 — Escalation on NO**

If the candidate replies **NO**:

```
I understand, let me escalate this to the HR team.
Someone will get back to you shortly.

Your issue has been flagged as: Test link not opening
Reference: #13
```

A **private WhatsApp alert** is simultaneously sent to the `BOT_ADMIN_NUMBER` configured in `.env`:

```
Escalation alert
Reference: #13
Sender: 1231066664382575@lid
Issue: Test link not opening
```

> *Screenshot: Escalation message in group → admin receives private alert*

![Candidate replies NO and bot sends escalation message with reference number](screenshots/escalation_message.jpg)

![Admin's private chat showing multiple escalation alerts with reference numbers and issue details](screenshots/escalation_admin_alerts.jpg)

---

## Folder Structure

```text
Whatsapp_bot/
  index.js                # Entry point — WhatsApp client, message routing
  conversationManager.js  # Guided support conversation state machine
  db.js                   # SQLite database layer (issues, conversations, message log)
  extractor.js            # Groq-powered passive issue extraction
  commands.js             # HR admin query commands
  formatter.js            # Text formatting helpers
  scheduler.js            # Stale conversation cleanup scheduler
  screenshots/            # README demo screenshots
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
| `GROUP_NAME` | Exact WhatsApp group title — copy from Group Info (case and emoji sensitive) |
| `BOT_NAME` | The name used as the command trigger (`@BOT_NAME`). Set to your preferred name without `@` |
| `GROQ_API_KEY` | Your Groq API key from [console.groq.com](https://console.groq.com/keys) |
| `BOT_ADMIN_NUMBER` | Phone number (with country code, no `+`) to receive private escalation alerts |
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
- Fix: Set the exact mention name (no `@`) in `.env` and restart.

**3. Bot ignores all group messages**
- Cause: `GROUP_NAME` mismatch.
- Fix: Copy exact group title from Group Info (including spaces, case, emojis), restart.

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
