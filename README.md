# HR Bot - WhatsApp Connection Setup

This is the first setup piece only: connect to WhatsApp Web, persist session with `LocalAuth`, print QR on first run, and log incoming messages.

## Project structure

```
hr-bot/
  index.js
  .env
  .env.example
  package.json
  README.md
```

## Environment variable

Create `.env` from `.env.example` and set:

```
GROUP_NAME=HR Hiring Team
```

## What this code does

- Uses `whatsapp-web.js` with `LocalAuth` so login session is saved.
- Shows QR in terminal on first run using `qrcode-terminal`.
- Logs `Bot is ready` when connected.
- Listens to all incoming messages and logs sender, chat/group name, and text.
- Does not filter out your own messages, so you can test from your own number.
