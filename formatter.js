function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatIssueLine(issue) {
  const category = issue.category || "Other";
  const summary = issue.issue_summary || "No summary";
  const seen = Number(issue.frequency || 1);
  const lastSeen = formatDate(issue.last_seen);
  return `• [${category}] ${summary} (seen ${seen} times, last seen: ${lastSeen})`;
}

function formatIssuesList(title, issues) {
  const safeIssues = Array.isArray(issues) ? issues : [];
  const header = `${title}`;
  const body =
    safeIssues.length > 0
      ? safeIssues.map(formatIssueLine).join("\n")
      : "No issues found.";
  const footer = `Total issues: ${safeIssues.length}`;

  return `${header}\n${body}\n${footer}`;
}

function formatHelpText() {
  const commands = [
    "show all issues",
    "top issues",
    "new issues",
    "issues this month",
    "interview issues",
    "onboarding issues",
    "payment issues",
    "repeated problems",
    "help"
  ];

  return `Available commands:\n${commands.map((cmd) => `• ${cmd}`).join("\n")}\nTotal commands: ${commands.length}`;
}

module.exports = {
  formatIssuesList,
  formatHelpText
};
