#!/usr/bin/env node
// =============================================================================
// Antigravity Agent OS — update-context.mjs
// CLI for updating agent memory files and syncing to Supabase
//
// Usage:
//   node scripts/update-context.mjs <command> [args] [options]
//
// Commands:
//   task <id> <status> <agent> <nextAction>
//   log <agent> <summary> [--files a,b] [--blockers text] [--next text] [--task-id ID]
//   handoff <fromAgent> <toAgent> <details> [--files a,b] [--blockers text] [--next text] [--task-id ID]
//   decision <title> <decision> [--context text] [--consequences text] [--files a,b] [--decided-by agent]
//   session start <agent>
//   session end <agent> <summary>
//   sync [--supabase-url URL] [--supabase-key KEY]
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Path resolution — always relative to project root (one level up from scripts/)
// ---------------------------------------------------------------------------
const ROOT = resolve(__dirname, "..");
const AI_CTX = join(ROOT, "ai-context");
const TASKS_FILE = join(AI_CTX, "tasks.json");
const LOGS_DIR = join(AI_CTX, "logs");
const HANDOFFS_DIR = join(AI_CTX, "handoffs");
const SESSIONS_FILE = join(AI_CTX, ".sessions.json");

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read ${file}: ${err.message}`);
  }
}

function writeJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function nowISO() {
  return new Date().toISOString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      options[key] = value;
    } else {
      positional.push(argv[i]);
    }
    i++;
  }
  return { positional, options };
}

function die(msg) {
  console.error(`\n[error] ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[ok] ${msg}`);
}

// ---------------------------------------------------------------------------
// Command: task
// update-context task <id> <status> <agent> <nextAction>
// ---------------------------------------------------------------------------
function cmdTask(positional, _options) {
  const [id, status, agent, ...rest] = positional;
  const nextAction = rest.join(" ");

  if (!id || !status || !agent || !nextAction) {
    die(
      "Usage: task <id> <status> <agent> <nextAction>\n" +
      "  status values: pending | ready | in_progress | blocked | review | done | archived"
    );
  }

  const validStatuses = new Set([
    "pending", "ready", "in_progress", "blocked", "review", "done", "archived",
  ]);
  if (!validStatuses.has(status)) {
    die(`Invalid status '${status}'. Must be one of: ${[...validStatuses].join(", ")}`);
  }

  if (!existsSync(TASKS_FILE)) die(`tasks.json not found at ${TASKS_FILE}`);

  const ctx = readJSON(TASKS_FILE);
  const task = ctx.tasks.find((t) => t.id === id);

  if (!task) die(`Task '${id}' not found in tasks.json`);

  const prev = { ...task };
  task.status = status;
  task.owner = agent;
  task.last_updated_by = agent;
  task.next_action = nextAction;
  task.updated_at = nowISO();
  ctx.meta.last_updated = nowISO();

  writeJSON(TASKS_FILE, ctx);
  ok(`Task ${id} updated: ${prev.status} → ${status} | owner: ${agent}`);
}

// ---------------------------------------------------------------------------
// Command: log
// update-context log <agent> <summary> [--files a,b] [--blockers text] [--next text] [--task-id ID]
// ---------------------------------------------------------------------------
function cmdLog(positional, options) {
  const [agent, ...rest] = positional;
  const summary = rest.join(" ");

  if (!agent || !summary) {
    die("Usage: log <agent> <summary> [--files a,b] [--blockers text] [--next text] [--task-id ID]");
  }

  ensureDir(LOGS_DIR);

  const today = todayString();
  const logFile = join(LOGS_DIR, `${today}.md`);

  const filesChanged = options.files ? options.files.split(",").map((f) => f.trim()) : [];
  const blockers = options.blockers || null;
  const next = options.next || null;
  const taskId = options["task-id"] || null;

  const timestamp = nowISO();
  const header = `\n---\n\n## [${timestamp}] ${agent}\n\n`;
  const body = [
    `**Summary:** ${summary}`,
    taskId ? `**Task:** ${taskId}` : null,
    filesChanged.length ? `**Files Changed:** ${filesChanged.join(", ")}` : null,
    blockers ? `**Blockers:** ${blockers}` : null,
    next ? `**Next Step:** ${next}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const entry = header + body + "\n";

  const existing = existsSync(logFile)
    ? readFileSync(logFile, "utf8")
    : `# Agent Log — ${today}\n`;
  writeFileSync(logFile, existing + entry, "utf8");

  ok(`Log appended to ${logFile}`);
  return { timestamp, agent, summary, taskId, filesChanged, blockers, next };
}

// ---------------------------------------------------------------------------
// Command: handoff
// update-context handoff <fromAgent> <toAgent> <details> [--files a,b] [--blockers text] [--next text] [--task-id ID]
// ---------------------------------------------------------------------------
function cmdHandoff(positional, options) {
  const [fromAgent, toAgent, ...rest] = positional;
  const details = rest.join(" ");

  if (!fromAgent || !toAgent || !details) {
    die(
      "Usage: handoff <fromAgent> <toAgent> <details> " +
      "[--files a,b] [--blockers text] [--next text] [--task-id ID]"
    );
  }

  ensureDir(HANDOFFS_DIR);

  const filesChanged = options.files ? options.files.split(",").map((f) => f.trim()) : [];
  const blockers = options.blockers || "None";
  const next = options.next || "See details above";
  const taskId = options["task-id"] || null;
  const timestamp = nowISO();

  const content = `---
from: ${fromAgent}
to: ${toAgent}
task_id: ${taskId || ""}
status: open
created_at: ${timestamp}
---

# Handoff: ${fromAgent} → ${toAgent}

## Completed
${details}

## Blockers
${blockers}

## Exact Next Step
${next}

## Files Touched
${filesChanged.length ? filesChanged.map((f) => `- ${f}`).join("\n") : "None"}
`;

  writeFileSync(join(HANDOFFS_DIR, "active.md"), content, "utf8");
  ok(`Handoff written: ${fromAgent} → ${toAgent}`);
  return { timestamp, fromAgent, toAgent, details, filesChanged, blockers, next, taskId };
}

// ---------------------------------------------------------------------------
// Command: decision
// update-context decision <title> <decision> [--context text] [--consequences text] [--files a,b] [--decided-by agent]
// ---------------------------------------------------------------------------
function cmdDecision(positional, options) {
  const [title, ...rest] = positional;
  const decision = rest.join(" ");

  if (!title || !decision) {
    die(
      "Usage: decision <title> <decision> " +
      "[--context text] [--consequences text] [--files a,b] [--decided-by agent]"
    );
  }

  const decisionsDir = join(AI_CTX, "decisions");
  ensureDir(decisionsDir);

  const context = options.context || "Not specified";
  const consequences = options.consequences || "Not specified";
  const relatedFiles = options.files ? options.files.split(",").map((f) => f.trim()) : [];
  const decidedBy = options["decided-by"] || "unknown";
  const timestamp = nowISO();
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const filename = `${timestamp.slice(0, 10)}-${slug}.md`;

  const content = `---
title: ${title}
status: accepted
decided_by: ${decidedBy}
created_at: ${timestamp}
---

# Decision: ${title}

## Context
${context}

## Decision
${decision}

## Consequences
${consequences}

## Related Files
${relatedFiles.length ? relatedFiles.map((f) => `- ${f}`).join("\n") : "None"}
`;

  writeFileSync(join(decisionsDir, filename), content, "utf8");
  ok(`Decision recorded: ${filename}`);
  return { timestamp, title, decision, context, consequences, relatedFiles, decidedBy };
}

// ---------------------------------------------------------------------------
// Command: session
// update-context session start <agent>
// update-context session end <agent> <summary>
// ---------------------------------------------------------------------------
function cmdSession(positional, _options) {
  const [subCommand, agent, ...rest] = positional;

  if (!subCommand || !agent) {
    die("Usage: session start <agent> | session end <agent> <summary>");
  }

  const sessions = existsSync(SESSIONS_FILE) ? readJSON(SESSIONS_FILE) : { sessions: [] };

  if (subCommand === "start") {
    const sessionId = createHash("sha1")
      .update(`${agent}-${Date.now()}`)
      .digest("hex")
      .slice(0, 12);
    const session = {
      id: sessionId,
      agent_name: agent,
      started_at: nowISO(),
      ended_at: null,
      task_ids: [],
      summary: null,
    };
    sessions.sessions.push(session);
    writeJSON(SESSIONS_FILE, sessions);
    ok(`Session started for ${agent} — ID: ${sessionId}`);
    return session;
  }

  if (subCommand === "end") {
    const summary = rest.join(" ");
    if (!summary) die("session end requires a summary");

    // Find most recent open session for this agent
    const openSessions = sessions.sessions.filter(
      (s) => s.agent_name === agent && !s.ended_at
    );
    if (openSessions.length === 0) die(`No open session found for agent '${agent}'`);

    const session = openSessions[openSessions.length - 1];
    session.ended_at = nowISO();
    session.summary = summary;
    writeJSON(SESSIONS_FILE, sessions);
    ok(`Session ended for ${agent} — ID: ${session.id}`);
    return session;
  }

  die(`Unknown session subcommand '${subCommand}'. Use 'start' or 'end'.`);
}

// ---------------------------------------------------------------------------
// Command: sync
// update-context sync [--supabase-url URL] [--supabase-key KEY]
// ---------------------------------------------------------------------------
async function cmdSync(positional, options) {
  const supabaseUrl =
    options["supabase-url"] ||
    process.env.SUPABASE_URL ||
    die("Supabase URL required: --supabase-url or SUPABASE_URL env var");

  const supabaseKey =
    options["supabase-key"] ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    die("Supabase key required: --supabase-key or SUPABASE_SERVICE_ROLE_KEY env var");

  const edgeFnUrl = `${supabaseUrl}/functions/v1/sync-ai-context`;

  async function pushToSupabase(type, payload) {
    const res = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`  [warn] ${type} sync failed (${res.status}): ${text}`);
      return false;
    }
    return true;
  }

  let synced = 0;
  let failed = 0;

  // Sync tasks
  if (existsSync(TASKS_FILE)) {
    const ctx = readJSON(TASKS_FILE);
    console.log(`\nSyncing ${ctx.tasks.length} tasks...`);
    for (const task of ctx.tasks) {
      const success = await pushToSupabase("task", task);
      success ? synced++ : failed++;
      process.stdout.write(success ? "." : "x");
    }
    console.log();
  }

  // Sync sessions
  if (existsSync(SESSIONS_FILE)) {
    const { sessions } = readJSON(SESSIONS_FILE);
    console.log(`\nSyncing ${sessions.length} sessions...`);
    for (const session of sessions) {
      const success = await pushToSupabase("session", session);
      success ? synced++ : failed++;
      process.stdout.write(success ? "." : "x");
    }
    console.log();
  }

  // Sync decisions
  const decisionsDir = join(AI_CTX, "decisions");
  if (existsSync(decisionsDir)) {
    const decisionFiles = readdirSync(decisionsDir).filter(
      (f) => f.endsWith(".md") && f !== "README.md"
    );
    console.log(`\nSyncing ${decisionFiles.length} decisions...`);
    for (const file of decisionFiles) {
      const raw = readFileSync(join(decisionsDir, file), "utf8");
      // Extract frontmatter fields for basic sync
      const title = (raw.match(/^title:\s*(.+)$/m) || [])[1] || file;
      const decidedBy = (raw.match(/^decided_by:\s*(.+)$/m) || [])[1] || "unknown";
      // Extract body sections
      const contextMatch = raw.match(/## Context\n([\s\S]*?)(?=\n## )/);
      const decisionMatch = raw.match(/## Decision\n([\s\S]*?)(?=\n## )/);
      const success = await pushToSupabase("decision", {
        title: title.trim(),
        decided_by: decidedBy.trim(),
        context: contextMatch ? contextMatch[1].trim() : "See file",
        decision: decisionMatch ? decisionMatch[1].trim() : "See file",
      });
      success ? synced++ : failed++;
      process.stdout.write(success ? "." : "x");
    }
    console.log();
  }

  console.log(`\nSync complete: ${synced} succeeded, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    console.log(`
Antigravity Agent OS — update-context

Usage:
  task <id> <status> <agent> <nextAction>
  log <agent> <summary> [--files a,b] [--blockers text] [--next text] [--task-id ID]
  handoff <fromAgent> <toAgent> <details> [--files a,b] [--blockers text] [--next text] [--task-id ID]
  decision <title> <decision> [--context text] [--consequences text] [--files a,b] [--decided-by agent]
  session start <agent>
  session end <agent> <summary>
  sync [--supabase-url URL] [--supabase-key KEY]
`);
    process.exit(0);
  }

  const command = rawArgs[0];
  const { positional, options } = parseArgs(rawArgs.slice(1));

  switch (command) {
    case "task":
      cmdTask(positional, options);
      break;
    case "log":
      cmdLog(positional, options);
      break;
    case "handoff":
      cmdHandoff(positional, options);
      break;
    case "decision":
      cmdDecision(positional, options);
      break;
    case "session":
      cmdSession(positional, options);
      break;
    case "sync":
      await cmdSync(positional, options);
      break;
    default:
      die(`Unknown command '${command}'. Run without arguments to see usage.`);
  }
}

main().catch((err) => {
  console.error("\n[fatal]", err.message);
  process.exit(1);
});
