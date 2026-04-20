const cron = require("node-cron");
const { cleanupStaleConversations } = require("./conversationManager");

function startScheduler() {
  cron.schedule("*/30 * * * *", () => {
    try {
      cleanupStaleConversations();
    } catch (error) {
      console.error(`Stale conversation cleanup failed: ${error.message}`);
    }
  });

  console.log("Scheduler started: stale conversation cleanup runs every 30 minutes.");
}

module.exports = { startScheduler };
