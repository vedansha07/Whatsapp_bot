const {
  getAllIssues,
  getTopIssues,
  getNewIssues,
  getIssuesByCategory,
  getRepeatedIssues
} = require("./db");
const { formatIssuesList, formatHelpText } = require("./formatter");

function normalizeCommand(value) {
  return (value || "").toString().trim().toLowerCase();
}

function handleCommand(commandText, client, msg) {
  const command = normalizeCommand(commandText);

  switch (command) {
    case "show all issues":
      return formatIssuesList("All Issues", getAllIssues());
    case "top issues":
      return formatIssuesList("Top Issues", getTopIssues(5));
    case "new issues":
      return formatIssuesList("New Issues (Last 7 Days)", getNewIssues(7));
    case "issues this month":
      return formatIssuesList("Issues This Month (Last 30 Days)", getNewIssues(30));
    case "interview issues":
      return formatIssuesList("Interview Issues", getIssuesByCategory("Interview"));
    case "onboarding issues":
      return formatIssuesList("Onboarding Issues", getIssuesByCategory("Onboarding"));
    case "payment issues":
      return formatIssuesList("Payment Issues", getIssuesByCategory("Payment"));
    case "repeated problems":
      return formatIssuesList("Repeated Problems (Seen 3+ Times)", getRepeatedIssues(3));
    case "help":
      return formatHelpText();
    default:
      return null;
  }
}

module.exports = { handleCommand };
