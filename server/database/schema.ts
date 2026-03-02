import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  pkgManager: text("pkg_manager"),
  devCommand: text("dev_command"),
  installCommand: text("install_command"),
  configOverride: text("config_override", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const worktrees = sqliteTable("worktrees", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  branchName: text("branch_name").notNull(),
  path: text("path").notNull(),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  linearIssueId: text("linear_issue_id"),
  linearIssueIdentifier: text("linear_issue_identifier"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  worktreeId: text("worktree_id").references(() => worktrees.id),
  parentSessionId: text("parent_session_id"),
  role: text("role", { enum: ["main", "worker", "reviewer"] }).notNull(),
  modelPreference: text("model_preference", {
    enum: ["opus", "sonnet"],
  })
    .notNull()
    .default("sonnet"),
  status: text("status", {
    enum: ["idle", "working", "question", "done", "error"],
  })
    .notNull()
    .default("idle"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  type: text("type", {
    enum: ["question", "done", "progress", "error", "blocked"],
  }).notNull(),
  content: text("content").notNull(),
  options: text("options", { mode: "json" }),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  resolvedContent: text("resolved_content"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  worktreeId: text("worktree_id")
    .notNull()
    .references(() => worktrees.id),
  workerSessionId: text("worker_session_id"),
  reviewerSessionId: text("reviewer_session_id"),
  iteration: integer("iteration").notNull().default(1),
  status: text("status", {
    enum: [
      "agent_review",
      "approved_by_agent",
      "user_review",
      "approved",
      "changes_requested",
    ],
  })
    .notNull()
    .default("agent_review"),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id),
  filePath: text("file_path").notNull(),
  lineNumber: integer("line_number"),
  side: text("side", { enum: ["left", "right"] }),
  author: text("author", { enum: ["user", "worker", "reviewer"] }).notNull(),
  content: text("content").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const changeComments = sqliteTable("change_comments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  sessionId: text("session_id"),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  side: text("side", { enum: ["additions", "deletions"] }),
  content: text("content").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const devProfile = sqliteTable("dev_profile", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category", {
    enum: ["style", "preference", "convention", "rule"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  role: text("role", {
    enum: ["user", "assistant", "system", "tool"],
  }).notNull(),
  content: text("content", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

