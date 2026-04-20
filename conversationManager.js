const {
  getConversation,
  createConversation,
  updateConversation,
  resolveConversation,
  getStaleConversations
} = require("./db");

function getOrCreateConversation(sender, messageText) {
  const existing = getConversation(sender);
  if (existing) {
    console.log(`Conversation found for sender ${sender} in state "${existing.state}"`);
    return existing;
  }

  const created = createConversation(sender, messageText);
  console.log(`Conversation created for sender ${sender}`);
  return created;
}

function advanceConversation(sender, messageText, client) {
  const conversation = getOrCreateConversation(sender, messageText);
  console.log(
    `advanceConversation placeholder: sender=${sender}, state=${conversation?.state || "unknown"}, message="${messageText}"`
  );

  updateConversation(sender, {
    last_message: messageText
  });

  return conversation;
}

function cleanupStaleConversations() {
  const staleConversations = getStaleConversations(30);
  console.log(`cleanupStaleConversations placeholder: found ${staleConversations.length} stale conversation(s).`);

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
