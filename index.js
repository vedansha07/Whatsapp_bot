require("dotenv").config();

const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { logMessage, insertOrUpdateIssue } = require("./db");
const { extractIssue } = require("./extractor");
const { handleCommand } = require("./commands");

const groupName = process.env.GROUP_NAME;
const botName = process.env.BOT_NAME;

if (!groupName || !botName) {
  console.error("Missing required env variables: GROUP_NAME and/or BOT_NAME");
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true
  }
});

client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot is ready");
  console.log(`Monitoring group name from .env: "${groupName}"`);
  console.log(`Bot command trigger from .env: "@${botName}"`);
});

client.on("message", async (message) => {
  try {
    const chat = await message.getChat();

    let sender = "Unknown";
    try {
      const contact = await message.getContact();
      sender = contact.pushname || contact.name || contact.number || message.from;
    } catch (contactError) {
      sender = message.from || "Unknown";
    }

    const chatName = chat.name || "(No chat name)";
    const text = message.body || "";

    const isMonitoredGroup = chat.isGroup && chatName === groupName;
    if (!isMonitoredGroup) return;

    console.log(`[MONITORED GROUP] ${chatName} | From: ${sender} | Message: ${text}`);

    const mentionToken = `@${botName}`.toLowerCase();
    const lowerText = text.toLowerCase();
    const hasBotMention = lowerText.includes(mentionToken);

    if (hasBotMention) {
      const mentionRegex = new RegExp(`@${botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "ig");
      const strippedCommand = text.replace(mentionRegex, "").trim();
      const commandReply = handleCommand(strippedCommand, client, message);

      if (commandReply) {
        await message.reply(commandReply);
      } else {
        await message.reply(`Command not recognized. Type @${botName} help`);
      }

      logMessage({
        message: text,
        timestamp: new Date().toISOString(),
        sender,
        issue_detected: 0
      });
      return;
    }

    const extracted = await extractIssue(text);
    if (extracted.is_issue) {
      insertOrUpdateIssue({
        raw_message: text,
        category: extracted.category || "Other",
        issue_summary: extracted.issue_summary || "Unspecified issue",
        candidate_name: extracted.candidate_name || null,
        resolution_hint: extracted.resolution_hint || null,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
      });
    }

    logMessage({
      message: text,
      timestamp: new Date().toISOString(),
      sender,
      issue_detected: extracted.is_issue ? 1 : 0
    });
  } catch (error) {
    console.error("Failed to process incoming message:", error.message);
  }
});

client.on("auth_failure", (msg) => {
  console.error("Authentication failed:", msg);
});

client.on("disconnected", (reason) => {
  console.error("Client disconnected:", reason);
});

client.initialize();
