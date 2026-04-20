require("dotenv").config();

const Groq = require("groq-sdk");

const MODEL_NAME = "llama-3.1-8b-instant";
const SYSTEM_PROMPT = `You are an HR issue extractor for a recruitment team's WhatsApp group.
Read the user message and decide if it describes a candidate-related problem.
Respond ONLY in raw JSON. No explanation, no markdown, no backticks, no extra text.

If it IS a candidate issue:
{"is_issue":true,"candidate_name":"name or null","issue_summary":"max 10 words","category":"Assessment|Portal|Interview|Onboarding|Payment|Document|Offer|Technical|Other","resolution_hint":"one short fix suggestion"}

If it is NOT a candidate issue:
{"is_issue":false}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ""
});

async function extractIssue(messageText) {
  await sleep(50);

  const userMessage = typeof messageText === "string" ? messageText.trim() : "";
  if (!userMessage) {
    return { is_issue: false };
  }

  if (!process.env.GROQ_API_KEY) {
    console.error("extractIssue: missing GROQ_API_KEY");
    return { is_issue: false };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Empty response from Groq");
    }

    const parsed = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || typeof parsed.is_issue !== "boolean") {
      throw new Error("Invalid JSON structure from Groq");
    }

    return parsed;
  } catch (error) {
    console.error(`extractIssue: ${error.message}`);
    return { is_issue: false };
  }
}

module.exports = { extractIssue };
