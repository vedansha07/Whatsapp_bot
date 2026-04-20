const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "hr_bot.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_message TEXT NOT NULL,
    category TEXT NOT NULL,
    issue_summary TEXT NOT NULL,
    candidate_name TEXT,
    frequency INTEGER NOT NULL DEFAULT 1,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolution_hint TEXT
  );

  CREATE TABLE IF NOT EXISTS message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    sender TEXT NOT NULL,
    issue_detected INTEGER NOT NULL DEFAULT 0 CHECK (issue_detected IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    state TEXT NOT NULL,
    selected_category TEXT,
    issue_description TEXT,
    last_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1))
  );
`);

const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

const insertIssueStmt = db.prepare(`
  INSERT INTO issues (
    raw_message,
    category,
    issue_summary,
    candidate_name,
    frequency,
    first_seen,
    last_seen,
    resolution_hint
  ) VALUES (
    @raw_message,
    @category,
    @issue_summary,
    @candidate_name,
    @frequency,
    @first_seen,
    @last_seen,
    @resolution_hint
  )
`);

const updateIssueStmt = db.prepare(`
  UPDATE issues
  SET
    frequency = @frequency,
    last_seen = @last_seen,
    raw_message = @raw_message,
    candidate_name = @candidate_name,
    resolution_hint = @resolution_hint
  WHERE id = @id
`);

const insertMessageLogStmt = db.prepare(`
  INSERT INTO message_log (
    message,
    timestamp,
    sender,
    issue_detected
  ) VALUES (
    @message,
    @timestamp,
    @sender,
    @issue_detected
  )
`);

const getConversationStmt = db.prepare(`
  SELECT *
  FROM conversations
  WHERE sender = ?
    AND resolved = 0
  ORDER BY datetime(updated_at) DESC
  LIMIT 1
`);

const insertConversationStmt = db.prepare(`
  INSERT INTO conversations (
    sender,
    state,
    selected_category,
    issue_description,
    last_message,
    created_at,
    updated_at,
    resolved
  ) VALUES (
    @sender,
    @state,
    @selected_category,
    @issue_description,
    @last_message,
    @created_at,
    @updated_at,
    @resolved
  )
`);

function insertOrUpdateIssue(data) {
  const now = data.last_seen || data.first_seen || new Date().toISOString();
  const normalizedCategory = normalizeText(data.category);
  const normalizedSummary = normalizeText(data.issue_summary);

  if (!normalizedCategory || !normalizedSummary) {
    throw new Error("category and issue_summary are required.");
  }

  const existing = db
    .prepare(
      `
      SELECT *
      FROM issues
      WHERE lower(trim(category)) = ?
        AND lower(trim(issue_summary)) = ?
      LIMIT 1
    `
    )
    .get(normalizedCategory, normalizedSummary);

  if (existing) {
    const updatedFrequency = Number(existing.frequency || 1) + 1;
    updateIssueStmt.run({
      id: existing.id,
      frequency: updatedFrequency,
      last_seen: now,
      raw_message: data.raw_message || existing.raw_message,
      candidate_name: data.candidate_name || existing.candidate_name || null,
      resolution_hint: data.resolution_hint || existing.resolution_hint || null
    });

    return {
      action: "updated",
      issueId: existing.id,
      frequency: updatedFrequency
    };
  }

  const result = insertIssueStmt.run({
    raw_message: data.raw_message || "",
    category: data.category.toString().trim(),
    issue_summary: data.issue_summary.toString().trim(),
    candidate_name: data.candidate_name || null,
    frequency: 1,
    first_seen: data.first_seen || now,
    last_seen: now,
    resolution_hint: data.resolution_hint || null
  });

  return {
    action: "inserted",
    issueId: result.lastInsertRowid,
    frequency: 1
  };
}

function logMessage(data) {
  if (!data || typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("message is required.");
  }

  if (!data.sender || !data.sender.toString().trim()) {
    throw new Error("sender is required.");
  }

  const result = insertMessageLogStmt.run({
    message: data.message.trim(),
    timestamp: data.timestamp || new Date().toISOString(),
    sender: data.sender.toString().trim(),
    issue_detected: data.issue_detected ? 1 : 0
  });

  return result.lastInsertRowid;
}

function queryIssues(filter = {}) {
  const conditions = [];
  const params = {};

  if (filter.category) {
    conditions.push("lower(trim(category)) = @category");
    params.category = normalizeText(filter.category);
  }

  if (filter.minFreq !== undefined) {
    conditions.push("frequency >= @minFreq");
    params.minFreq = Number(filter.minFreq);
  }

  if (filter.sinceDays !== undefined) {
    conditions.push("datetime(first_seen) >= datetime('now', @sinceDaysExpr)");
    params.sinceDaysExpr = `-${Number(filter.sinceDays)} days`;
  }

  if (filter.search) {
    conditions.push(
      "(lower(issue_summary) LIKE @search OR lower(raw_message) LIKE @search OR lower(ifnull(candidate_name, '')) LIKE @search)"
    );
    params.search = `%${normalizeText(filter.search)}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(
      `
      SELECT *
      FROM issues
      ${whereClause}
      ORDER BY datetime(last_seen) DESC, frequency DESC
    `
    )
    .all(params);
}

function getAllIssues() {
  return db
    .prepare(
      `
      SELECT *
      FROM issues
      ORDER BY datetime(last_seen) DESC
    `
    )
    .all();
}

function getTopIssues(n = 5) {
  const limit = Math.max(1, Number(n) || 5);
  return db
    .prepare(
      `
      SELECT *
      FROM issues
      ORDER BY frequency DESC, datetime(last_seen) DESC
      LIMIT ?
    `
    )
    .all(limit);
}

function getNewIssues(days = 7) {
  const parsedDays = Math.max(0, Number(days) || 7);
  return db
    .prepare(
      `
      SELECT *
      FROM issues
      WHERE datetime(first_seen) >= datetime('now', ?)
      ORDER BY datetime(first_seen) DESC
    `
    )
    .all(`-${parsedDays} days`);
}

function getIssuesByCategory(category) {
  if (!category || !category.toString().trim()) {
    throw new Error("category is required.");
  }

  return db
    .prepare(
      `
      SELECT *
      FROM issues
      WHERE lower(trim(category)) = ?
      ORDER BY frequency DESC, datetime(last_seen) DESC
    `
    )
    .all(normalizeText(category));
}

function getRepeatedIssues(minFreq = 2) {
  const threshold = Math.max(1, Number(minFreq) || 2);
  return db
    .prepare(
      `
      SELECT *
      FROM issues
      WHERE frequency >= ?
      ORDER BY frequency DESC, datetime(last_seen) DESC
    `
    )
    .all(threshold);
}

function getConversation(sender) {
  if (!sender || !sender.toString().trim()) {
    throw new Error("sender is required.");
  }
  return getConversationStmt.get(sender.toString().trim()) || null;
}

function createConversation(sender, issueDescription) {
  if (!sender || !sender.toString().trim()) {
    throw new Error("sender is required.");
  }

  const now = new Date().toISOString();
  const safeSender = sender.toString().trim();
  const safeIssueDescription = (issueDescription || "").toString().trim();

  const existing = getConversation(safeSender);
  if (existing) return existing;

  const result = insertConversationStmt.run({
    sender: safeSender,
    state: "awaiting_category",
    selected_category: null,
    issue_description: safeIssueDescription || null,
    last_message: safeIssueDescription || null,
    created_at: now,
    updated_at: now,
    resolved: 0
  });

  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(result.lastInsertRowid) || null;
}

function updateConversation(sender, updates = {}) {
  const existing = getConversation(sender);
  if (!existing) return null;

  const allowedFields = ["state", "selected_category", "issue_description", "last_message", "resolved"];
  const setParts = [];
  const params = { id: existing.id, updated_at: new Date().toISOString() };

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      setParts.push(`${field} = @${field}`);
      if (field === "resolved") {
        params[field] = updates[field] ? 1 : 0;
      } else if (updates[field] === undefined) {
        params[field] = null;
      } else {
        params[field] = updates[field];
      }
    }
  }

  setParts.push("updated_at = @updated_at");

  db.prepare(`UPDATE conversations SET ${setParts.join(", ")} WHERE id = @id`).run(params);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(existing.id) || null;
}

function resolveConversation(sender) {
  const existing = getConversation(sender);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare("UPDATE conversations SET resolved = 1, updated_at = ? WHERE id = ?").run(now, existing.id);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(existing.id) || null;
}

function getStaleConversations(minutesOld) {
  const parsedMinutes = Math.max(1, Number(minutesOld) || 30);
  return db
    .prepare(
      `
      SELECT *
      FROM conversations
      WHERE resolved = 0
        AND datetime(updated_at) <= datetime('now', ?)
      ORDER BY datetime(updated_at) ASC
    `
    )
    .all(`-${parsedMinutes} minutes`);
}

module.exports = {
  insertOrUpdateIssue,
  logMessage,
  queryIssues,
  getAllIssues,
  getTopIssues,
  getNewIssues,
  getIssuesByCategory,
  getRepeatedIssues,
  getConversation,
  createConversation,
  updateConversation,
  resolveConversation,
  getStaleConversations
};
