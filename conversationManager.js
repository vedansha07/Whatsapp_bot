const {
  getConversation,
  createConversation,
  updateConversation,
  resolveConversation,
  getStaleConversations,
  insertOrUpdateIssue
} = require("./db");
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ""
});

const CATEGORY_OPTIONS = {
  "1": "Assessment / Test link",
  "2": "Portal / Login",
  "3": "Interview",
  "4": "Onboarding",
  "5": "Payment / Stipend",
  "6": "Document / Offer letter",
  "7": "Other"
};

const CATEGORY_KEY_BY_LABEL = {
  "Assessment / Test link": "Assessment",
  "Portal / Login": "Portal",
  Interview: "Interview",
  Onboarding: "Onboarding",
  "Payment / Stipend": "Payment",
  "Document / Offer letter": "Document",
  Other: "Other"
};

const ISSUE_OPTIONS_BY_CATEGORY = {
  "Assessment / Test link": [
    "I did not receive the test link",
    "Test link has expired",
    "Test link is not opening",
    "I submitted the test but got no confirmation",
    "Other (type your issue briefly)"
  ],
  "Portal / Login": [
    "Login issue",
    "Password reset is not working",
    "Portal page not loading",
    "Unable to submit details",
    "Other (type your issue briefly)"
  ],
  Interview: [
    "Link not received",
    "Technical issue during interview",
    "Unable to join interview room",
    "No interviewer joined",
    "Other (type your issue briefly)"
  ],
  Onboarding: [
    "Onboarding process delayed",
    "Unable to complete onboarding form",
    "No onboarding instructions received",
    "Document verification pending",
    "Other (type your issue briefly)"
  ],
  "Payment / Stipend": [
    "Stipend not credited",
    "Payment date not communicated",
    "Bank details update issue",
    "Amount mismatch",
    "Other (type your issue briefly)"
  ],
  "Document / Offer letter": [
    "Offer letter delayed",
    "Incorrect details in offer/document",
    "Document upload issue",
    "Offer acceptance issue",
    "Other (type your issue briefly)"
  ]
};

const SOLUTIONS_MAP = {
  Assessment: {
    "Test link not received":
      "1. Check your registered email inbox and spam folder\n2. Verify you are checking the same email used for application\n3. If still not received, reply with \"resend\" so HR can re-send the link\nExpected resolution time: Within 2 hours during working hours",
    "Test link expired":
      "1. Test links are valid for a limited time (typically 24 hours)\n2. Request a new link from HR immediately\n3. Reattempt the test using the latest link\nExpected resolution time: Within 2 hours during working hours",
    "Test link not opening":
      "1. Try opening the link in a different browser\n2. Disable browser extensions and retry in incognito mode\n3. Ensure stable internet and try again\nExpected resolution time: Within 2 hours during working hours"
  },
  Portal: {
    "Login issue":
      "1. Use the Forgot Password option to reset credentials\n2. Clear browser cache and cookies\n3. Retry in incognito mode or another browser\nExpected resolution time: Within 2 hours during working hours"
  },
  Interview: {
    "Link not received":
      "1. Check spam/junk folder in your email\n2. Review calendar invite for meeting details\n3. Contact HR for fresh interview link if missing\nExpected resolution time: Within 2 hours during working hours",
    "Technical issue during interview":
      "1. Rejoin using the same interview link\n2. Switch to phone if laptop setup fails\n3. Inform HR immediately about the disruption\nExpected resolution time: Within 2 hours during working hours"
  },
  Payment: {
    "Stipend not credited":
      "1. Verify bank details submitted to HR are accurate\n2. Allow 3-5 working days for processing\n3. Contact HR with payment reference if delayed further\nExpected resolution time: 3-5 working days"
  },
  Onboarding: {
    "Onboarding delayed":
      "1. Check your email for onboarding instructions\n2. Verify required documents were submitted correctly\n3. Contact HR with your offer letter reference\nExpected resolution time: 1-2 working days"
  },
  Document: {
    "Offer letter delayed":
      "1. Offer letters are generally sent within 2 working days of verbal confirmation\n2. Check inbox and spam folder for official communication\n3. Follow up with HR if not received within expected timeline\nExpected resolution time: 2 working days"
  }
};

function categoryPromptText() {
  return `Hi! I'm here to help.

I noticed you're facing an issue. Let me help you quickly.

Please select your issue category by replying with a number:

1. Assessment / Test link
2. Portal / Login
3. Interview
4. Onboarding
5. Payment / Stipend
6. Document / Offer letter
7. Other (describe your issue)

Reply with just the number.`;
}

function issuePromptText(categoryLabel) {
  const options = ISSUE_OPTIONS_BY_CATEGORY[categoryLabel] || [];
  const optionsText = options.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return `You selected: ${categoryLabel}

What exactly is the issue? Reply with a number:

${optionsText}

Reply with a number or type your issue.`;
}

function normalizeIssueLabel(categoryLabel, userText) {
  const text = (userText || "").toLowerCase();
  if (categoryLabel === "Assessment / Test link") {
    if (text.includes("not receive")) return "Test link not received";
    if (text.includes("expired")) return "Test link expired";
    if (text.includes("not opening") || text.includes("not open")) return "Test link not opening";
  }
  if (categoryLabel === "Portal / Login" && text.includes("login")) return "Login issue";
  if (categoryLabel === "Interview" && text.includes("link")) return "Link not received";
  if (categoryLabel === "Interview" && text.includes("technical")) return "Technical issue during interview";
  if (categoryLabel === "Payment / Stipend" && text.includes("stipend")) return "Stipend not credited";
  if (categoryLabel === "Onboarding" && text.includes("delay")) return "Onboarding delayed";
  if (categoryLabel === "Document / Offer letter" && text.includes("offer")) return "Offer letter delayed";
  return userText;
}

async function generateGroqSolution(issueText) {
  if (!process.env.GROQ_API_KEY) {
    return {
      issueLabel: issueText,
      solutionText:
        "1. Share your exact issue details and any screenshots with HR.\n2. Confirm your registered email and phone number are correct.\n3. Request a status update and expected resolution timeline.\nExpected resolution time: Within 1 working day."
    };
  }

  try {
    const prompt = `You are an HR support assistant. A candidate is facing this issue: "${issueText}"
Give a helpful, practical solution in 3-4 numbered steps.
Also give an expected resolution time.
Be friendly and concise. Plain text only, no markdown.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty Groq solution response");

    return {
      issueLabel: issueText,
      solutionText: content
    };
  } catch (error) {
    console.error(`Failed to generate Groq solution: ${error.message}`);
    return {
      issueLabel: issueText,
      solutionText:
        "1. Share your exact issue details and any screenshots with HR.\n2. Confirm your registered email and phone number are correct.\n3. Request a status update and expected resolution timeline.\nExpected resolution time: Within 1 working day."
    };
  }
}

function sendSolutionText(issueLabel, solutionText) {
  return `Here's what you can do

Issue: ${issueLabel}

Solution:
${solutionText}

Did this help?
Reply YES if resolved or NO if you still need help.`;
}

async function sendFlowMessage(client, sender, text, flowChatId) {
  const target = flowChatId || sender;
  await client.sendMessage(target, text);
}

function getOrCreateConversation(sender, messageText) {
  const existing = getConversation(sender);
  if (existing) {
    updateConversation(sender, {
      last_message: messageText
    });
    return existing;
  }

  const created = createConversation(sender, messageText);
  console.log(`Conversation created for sender ${sender}`);
  return created;
}

async function advanceConversation(sender, messageText, client, flowChatId) {
  const conversation = getOrCreateConversation(sender, messageText);
  const trimmedMessage = (messageText || "").toString().trim();
  const state = conversation?.state || "awaiting_category";

  if (state === "awaiting_category") {
    const categoryChoice = trimmedMessage.match(/^[1-7]$/) ? trimmedMessage : null;

    if (!categoryChoice) {
      await sendFlowMessage(client, sender, categoryPromptText(), flowChatId);
      return { status: "awaiting_category" };
    }

    if (categoryChoice === "7") {
      updateConversation(sender, {
        state: "awaiting_free_text",
        selected_category: "Other",
        last_message: trimmedMessage
      });
      await sendFlowMessage(client, sender, "Please describe your issue briefly in one message.", flowChatId);
      return { status: "awaiting_free_text" };
    }

    const categoryLabel = CATEGORY_OPTIONS[categoryChoice];
    updateConversation(sender, {
      state: "awaiting_issue",
      selected_category: categoryLabel,
      last_message: trimmedMessage
    });
    await sendFlowMessage(client, sender, issuePromptText(categoryLabel), flowChatId);
    return { status: "awaiting_issue", category: categoryLabel };
  }

  if (state === "awaiting_issue") {
    const selectedCategory = conversation.selected_category || "Other";
    const options = ISSUE_OPTIONS_BY_CATEGORY[selectedCategory] || [];
    const numericChoice = trimmedMessage.match(/^\d+$/) ? Number(trimmedMessage) : null;
    const optionPicked = numericChoice && options[numericChoice - 1] ? options[numericChoice - 1] : null;
    const isOtherChoice = optionPicked ? optionPicked.toLowerCase().startsWith("other") : false;

    if (numericChoice && !optionPicked) {
      await sendFlowMessage(
        client,
        sender,
        "Please reply with a valid option number from the list or type your issue.",
        flowChatId
      );
      return { status: "awaiting_issue" };
    }

    let issueLabel;
    let solutionText;
    let rawIssueText;

    if (optionPicked && !isOtherChoice) {
      issueLabel = normalizeIssueLabel(selectedCategory, optionPicked);
      rawIssueText = issueLabel;
      const categoryKey = CATEGORY_KEY_BY_LABEL[selectedCategory] || "Other";
      solutionText = SOLUTIONS_MAP[categoryKey]?.[issueLabel] || null;
    } else {
      rawIssueText =
        !numericChoice && trimmedMessage
          ? trimmedMessage
          : conversation.issue_description || `${selectedCategory} issue`;
      const generated = await generateGroqSolution(rawIssueText);
      issueLabel = generated.issueLabel;
      solutionText = generated.solutionText;
    }

    if (!solutionText) {
      const generated = await generateGroqSolution(rawIssueText || issueLabel);
      issueLabel = generated.issueLabel;
      solutionText = generated.solutionText;
    }

    updateConversation(sender, {
      state: "awaiting_confirmation",
      issue_description: rawIssueText || issueLabel,
      last_message: trimmedMessage
    });

    await sendFlowMessage(client, sender, sendSolutionText(issueLabel, solutionText), flowChatId);
    return { status: "awaiting_confirmation", issue: issueLabel };
  }

  if (state === "awaiting_free_text") {
    if (!trimmedMessage) {
      await sendFlowMessage(client, sender, "Please type a brief description of your issue.", flowChatId);
      return { status: "awaiting_free_text" };
    }

    const generated = await generateGroqSolution(trimmedMessage);
    updateConversation(sender, {
      state: "awaiting_confirmation",
      issue_description: trimmedMessage,
      last_message: trimmedMessage
    });

    await sendFlowMessage(client, sender, sendSolutionText(generated.issueLabel, generated.solutionText), flowChatId);
    return { status: "awaiting_confirmation", issue: generated.issueLabel };
  }

  if (state === "awaiting_confirmation") {
    const answer = trimmedMessage.toLowerCase();
    const yesValues = new Set(["yes", "y"]);
    const noValues = new Set(["no", "n"]);

    if (yesValues.has(answer)) {
      insertOrUpdateIssue({
        raw_message: conversation.issue_description || "",
        category: CATEGORY_KEY_BY_LABEL[conversation.selected_category] || "Other",
        issue_summary: conversation.issue_description || "Issue resolved",
        resolution_hint: "Resolved via support flow",
        resolved: true
      });

      resolveConversation(sender);
      await sendFlowMessage(
        client,
        sender,
        "Great! Glad your issue is resolved.\nIf you face any other issue, feel free to tag me anytime."
        ,
        flowChatId
      );
      return { status: "resolved" };
    }

    if (noValues.has(answer)) {
      const escalatedConversation = updateConversation(sender, {
        state: "escalated",
        resolved: true,
        last_message: trimmedMessage
      });

      const issueSummary = conversation.issue_description || "Unspecified issue";
      await sendFlowMessage(
        client,
        sender,
        `I understand, let me escalate this to the HR team.\nSomeone will get back to you shortly.\n\nYour issue has been flagged as: ${issueSummary}\nReference: #${escalatedConversation?.id || conversation.id}`
        ,
        flowChatId
      );

      const adminNumber = (process.env.BOT_ADMIN_NUMBER || "").trim();
      if (adminNumber) {
        const adminRecipient = adminNumber.includes("@") ? adminNumber : `${adminNumber}@c.us`;
        const alertText = `Escalation alert\nReference: #${escalatedConversation?.id || conversation.id}\nSender: ${sender}\nIssue: ${issueSummary}`;
        try {
          await client.sendMessage(adminRecipient, alertText);
        } catch (error) {
          console.error(`Failed to alert admin: ${error.message}`);
        }
      }

      return { status: "escalated" };
    }

    await sendFlowMessage(client, sender, "Please reply with YES if resolved or NO if you still need help.", flowChatId);
    return { status: "awaiting_confirmation" };
  }

  updateConversation(sender, {
    state: "awaiting_category",
    last_message: trimmedMessage
  });
  await sendFlowMessage(client, sender, categoryPromptText(), flowChatId);
  return { status: "awaiting_category" };
}

function cleanupStaleConversations() {
  const staleConversations = getStaleConversations(30);
  console.log(`cleanupStaleConversations: found ${staleConversations.length} stale conversation(s).`);

  for (const conversation of staleConversations) {
    resolveConversation(conversation.sender);
    console.log(`Resolved stale conversation for sender ${conversation.sender}`);
  }

  return staleConversations.length;
}

module.exports = {
  getOrCreateConversation,
  advanceConversation,
  cleanupStaleConversations
};
