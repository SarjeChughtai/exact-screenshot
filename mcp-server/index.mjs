#!/usr/bin/env node
/**
 * Antigravity Agent OS — MCP Server
 *
 * Exposes ai-context/ files as live tools that agents can call programmatically
 * via the Model Context Protocol (stdio transport).
 *
 * Tools:
 *   get_tasks          — List/filter tasks from tasks.json
 *   get_task           — Get a single task by ID
 *   update_task        — Update task fields (status, owner, etc.)
 *   create_task        — Create a new task with auto-generated ID
 *   get_handoff        — Parse active.md into structured JSON
 *   write_handoff      — Write a new handoff, archive previous
 *   get_dashboard      — Parse dashboard.md into structured JSON
 *   update_dashboard   — Update specific dashboard fields
 *   append_log         — Append entry to today's log file
 *   get_logs           — Read log entries with optional filters
 *   record_decision    — Create a new decision file
 *   detect_conflicts   — Run conflict detection checks
 *   get_project        — Read project.md content
 *   get_federation_status — Read cross-repo task summaries
 *
 * Usage: node mcp-server/index.mjs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

// ─── Path resolution ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Walk up from mcp-server/ to the repo root (where ai-context/ lives)
function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "ai-context"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: treat CWD as root
  return process.cwd();
}

const REPO_ROOT = findRepoRoot(__dirname);
const AI_CONTEXT = join(REPO_ROOT, "ai-context");
const TASKS_FILE = join(AI_CONTEXT, "tasks.json");
const DASHBOARD_FILE = join(AI_CONTEXT, "dashboard.md");
const PROJECT_FILE = join(AI_CONTEXT, "project.md");
const HANDOFF_ACTIVE = join(AI_CONTEXT, "handoffs", "active.md");
const HANDOFF_ARCHIVE = join(AI_CONTEXT, "handoffs", "archive");
const LOGS_DIR = join(AI_CONTEXT, "logs");
const DECISIONS_DIR = join(AI_CONTEXT, "decisions");
const FEDERATION_CACHE = join(AI_CONTEXT, "federation-cache.json");
const CONFLICT_SCRIPT = join(
  REPO_ROOT,
  ".agent",
  "skills",
  "conflict-resolver",
  "scripts",
  "detect-conflicts.mjs"
);

// ─── File helpers ──────────────────────────────────────────────────────────

function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function safeReadJSON(filePath) {
  const text = safeReadFile(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${err.message}`);
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

// ─── Task ID generator ────────────────────────────────────────────────────

function generateTaskId(area, existingTasks) {
  const prefix = (area || "TASK").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const existingNums = existingTasks
    .filter((t) => t.id.startsWith(prefix + "-"))
    .map((t) => parseInt(t.id.split("-")[1], 10))
    .filter((n) => !isNaN(n));
  const next = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

// ─── Handoff parser ───────────────────────────────────────────────────────

function parseHandoff(text) {
  if (!text) return null;

  // Parse YAML front matter
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) frontmatter[m[1]] = m[2].trim();
    }
  }

  // Parse sections
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");

  function extractSection(name) {
    const re = new RegExp(`##\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : null;
  }

  // Parse files from list items
  function extractList(text) {
    if (!text) return [];
    return text
      .split("\n")
      .filter((l) => l.trim().startsWith("-"))
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean);
  }

  return {
    from: frontmatter.from || null,
    to: frontmatter.to || null,
    task_id: frontmatter.task_id || null,
    status: frontmatter.status || "open",
    created_at: frontmatter.created_at || null,
    completed: extractSection("Completed"),
    blockers: extractSection("Blockers"),
    exact_next_step: extractSection("Exact Next Step"),
    files_touched: extractList(extractSection("Files Touched")),
    raw: text,
  };
}

// ─── Dashboard parser ─────────────────────────────────────────────────────

function parseDashboard(text) {
  if (!text) return null;

  function extractTableSection(name) {
    const re = new RegExp(
      `##\\s+${name}[\\s\\S]*?\\n((?:\\|[^\\n]*\\n)+)`,
      "i"
    );
    const m = text.match(re);
    if (!m) return [];
    const lines = m[1].trim().split("\n").filter((l) => l.includes("|"));
    // Skip separator row
    const rows = lines.filter((l) => !l.match(/^\|[-:\s|]+\|$/));
    return rows.map((l) => {
      const cells = l
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      return cells;
    });
  }

  // Current State table
  const stateRows = extractTableSection("Current State");
  const state = {};
  for (const row of stateRows) {
    if (row.length >= 2) {
      const key = row[0].replace(/\*\*/g, "").trim();
      state[key] = row[1];
    }
  }

  // Priority list
  const prioMatch = text.match(/##\s+Current Priority[\s\S]*?\n((?:- \[.\][^\n]*\n?)+)/i);
  const priorities = prioMatch
    ? prioMatch[1]
        .split("\n")
        .filter((l) => l.trim().startsWith("- ["))
        .map((l) => ({
          done: l.includes("[x]"),
          text: l.replace(/^- \[.\]\s*/, "").trim(),
        }))
    : [];

  // Recent Activity table
  const activityRows = extractTableSection("Recent Activity");
  const activity = activityRows
    .filter((r) => r[0] !== "Date" && r[0] !== "—")
    .map((r) => ({
      date: r[0] || null,
      agent: r[1] || null,
      task_id: r[2] || null,
      summary: r[3] || null,
    }));

  // Files to Watch table
  const filesRows = extractTableSection("Files To Watch");
  const files_to_watch = filesRows
    .filter((r) => r[0] !== "File")
    .map((r) => ({ file: r[0], reason: r[1] || null }));

  return {
    priorities,
    current_state: state,
    files_to_watch,
    recent_activity: activity,
    raw: text,
  };
}

// ─── Dashboard updater ────────────────────────────────────────────────────

function updateDashboardField(text, field, value) {
  // Update Current State table row
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(\\|\\s*\\*\\*${escapedField}\\*\\*\\s*\\|)([^|\\n]*)`,
    "i"
  );
  if (re.test(text)) {
    return text.replace(re, `$1 ${value} `);
  }
  return text;
}

// ─── Log parser ───────────────────────────────────────────────────────────

function parseLogFile(text, dateStr) {
  if (!text) return [];
  const entries = [];
  // Split on H2 entry blocks
  const blocks = text.split(/\n(?=##\s)/);
  for (const block of blocks) {
    if (!block.trim() || block.startsWith("#\s")) continue;
    const lines = block.split("\n");
    const titleLine = lines.find((l) => l.startsWith("##"));
    if (!titleLine) continue;

    const isoMatch = titleLine.match(/^##\s+\[(.+?)\]\s+(.+)$/);
    const legacyMatch = titleLine.match(/^##\s+(\d{2}:\d{2})\s*[—–-]\s*(.+)$/);
    const timestamp = isoMatch ? isoMatch[1] : null;
    const time = isoMatch
      ? new Date(timestamp).toISOString().slice(11, 16)
      : legacyMatch
        ? legacyMatch[1]
        : null;
    const agent = isoMatch
      ? isoMatch[2].trim()
      : legacyMatch
        ? legacyMatch[2].trim()
        : null;

    function extractField(name) {
      const re = new RegExp(`\\*\\*${name}\\*\\*:?\\s*(.+)`, "i");
      for (const l of lines) {
        const m = l.match(re);
        if (m) return m[1].trim();
      }
      return null;
    }

    function extractListField(name) {
      const re = new RegExp(`\\*\\*${name}\\*\\*:?\\s*(.*)`, "i");
      const idx = lines.findIndex((l) => re.test(l));
      if (idx === -1) return [];

      const inlineMatch = lines[idx].match(re);
      const inlineValue = inlineMatch ? inlineMatch[1].trim() : "";
      if (inlineValue) {
        return inlineValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      const items = [];
      for (let i = idx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("**")) break;
        if (lines[i].trim().startsWith("-")) {
          items.push(lines[i].replace(/^-\s*/, "").trim());
        }
      }
      return items;
    }

    entries.push({
      date: dateStr,
      time,
      timestamp,
      agent: agent || extractField("Agent"),
      task_id: extractField("Task"),
      summary: extractField("Summary"),
      files_changed: extractListField("Files Changed"),
      blockers: extractField("Blockers"),
      next_step: extractField("Next Step"),
    });
  }
  return entries;
}

// ─── Tool definitions ─────────────────────────────────────────────────────

const TOOLS = [
  // ── 1. get_tasks ──────────────────────────────────────────────────────
  {
    name: "get_tasks",
    description:
      "Returns all tasks from ai-context/tasks.json. Supports optional filters: status, priority, owner, area. Returns the filtered task list plus metadata.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Filter by task status. Allowed: pending, ready, in_progress, blocked, review, done, archived.",
          enum: [
            "pending",
            "ready",
            "in_progress",
            "blocked",
            "review",
            "done",
            "archived",
          ],
        },
        priority: {
          type: "string",
          description: "Filter by priority level.",
          enum: ["low", "medium", "high", "critical"],
        },
        owner: {
          type: "string",
          description: "Filter by owner name (e.g. 'claude', 'codex', 'human').",
        },
        area: {
          type: "string",
          description:
            "Filter by task area/domain (e.g. 'frontend', 'backend', 'setup').",
        },
      },
      additionalProperties: false,
    },
  },

  // ── 2. get_task ───────────────────────────────────────────────────────
  {
    name: "get_task",
    description:
      "Returns a single task by its ID (e.g. 'SYS-001', 'FE-003'). Returns full task object or an error if not found.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The task ID in AREA-NNN format.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },

  // ── 3. update_task ────────────────────────────────────────────────────
  {
    name: "update_task",
    description:
      "Updates one or more fields of an existing task. Automatically sets updated_at and last_updated_by. Updatable fields: status, owner, next_action, priority, notes, files, area. Returns the updated task.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The task ID to update.",
        },
        updated_by: {
          type: "string",
          description: "Name of the agent or user making the update.",
        },
        status: {
          type: "string",
          enum: [
            "pending",
            "ready",
            "in_progress",
            "blocked",
            "review",
            "done",
            "archived",
          ],
          description: "New task status.",
        },
        owner: {
          type: "string",
          description: "New owner name.",
        },
        next_action: {
          type: "string",
          description: "Updated description of the next action required.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "New priority level.",
        },
        notes: {
          type: "string",
          description: "Replacement notes for the task.",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Replacement list of file paths associated with this task.",
        },
        area: {
          type: "string",
          description: "New area/domain for the task.",
        },
      },
      required: ["id", "updated_by"],
      additionalProperties: false,
    },
  },

  // ── 4. create_task ────────────────────────────────────────────────────
  {
    name: "create_task",
    description:
      "Creates a new task with an auto-generated ID in AREA-NNN format (e.g. 'FE-004'). Returns the created task with its assigned ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, descriptive task title.",
        },
        area: {
          type: "string",
          description:
            "Area/domain prefix for the task ID (e.g. 'FE', 'BE', 'INFRA', 'UX'). Defaults to 'TASK'.",
        },
        status: {
          type: "string",
          enum: [
            "pending",
            "ready",
            "in_progress",
            "blocked",
            "review",
            "done",
            "archived",
          ],
          description: "Initial status. Defaults to 'ready'.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Task priority. Defaults to 'medium'.",
        },
        owner: {
          type: "string",
          description: "Assigned owner. Defaults to 'unassigned'.",
        },
        next_action: {
          type: "string",
          description: "What needs to happen next.",
        },
        notes: {
          type: "string",
          description: "Additional context or notes.",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "File paths relevant to this task.",
        },
        created_by: {
          type: "string",
          description: "Name of the agent creating the task.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },

  // ── 5. get_handoff ────────────────────────────────────────────────────
  {
    name: "get_handoff",
    description:
      "Returns the current active handoff from ai-context/handoffs/active.md, parsed into structured JSON. Includes from, to, task_id, status, completed summary, blockers, exact next step, and files touched.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // ── 6. write_handoff ──────────────────────────────────────────────────
  {
    name: "write_handoff",
    description:
      "Writes a new active handoff to ai-context/handoffs/active.md. Archives the previous handoff to handoffs/archive/YYYY-MM-DD-from-to.md if it exists. All fields should be explicit and specific.",
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Agent or person handing off (e.g. 'claude', 'codex', 'human').",
        },
        to: {
          type: "string",
          description:
            "Agent or person receiving the handoff, or 'next available agent'.",
        },
        task_id: {
          type: "string",
          description: "Primary task ID this handoff is for.",
        },
        completed: {
          type: "string",
          description:
            "Markdown description of what was accomplished this session. Be specific.",
        },
        blockers: {
          type: "string",
          description:
            "What is blocking progress. Write 'None' if nothing is blocked.",
        },
        exact_next_step: {
          type: "string",
          description:
            "The single most important, unambiguous action the next agent must take.",
        },
        files_touched: {
          type: "array",
          items: { type: "string" },
          description: "List of file paths modified in this session.",
        },
      },
      required: ["from", "to", "completed", "exact_next_step"],
      additionalProperties: false,
    },
  },

  // ── 7. get_dashboard ──────────────────────────────────────────────────
  {
    name: "get_dashboard",
    description:
      "Returns ai-context/dashboard.md parsed into structured JSON. Includes current priorities, state fields (current agent, task, branch, blockers), files to watch, and recent activity.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // ── 8. update_dashboard ───────────────────────────────────────────────
  {
    name: "update_dashboard",
    description:
      "Updates specific fields in the Current State table of ai-context/dashboard.md. Also supports appending a row to Recent Activity. Returns success confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        current_agent: {
          type: "string",
          description: "Set the 'Current Agent' field.",
        },
        current_task_id: {
          type: "string",
          description: "Set the 'Current Task ID' field.",
        },
        current_branch: {
          type: "string",
          description: "Set the 'Current Branch' field.",
        },
        last_completed_step: {
          type: "string",
          description: "Set the 'Last Completed Step' field.",
        },
        next_action: {
          type: "string",
          description: "Set the 'Next Action' field.",
        },
        current_blockers: {
          type: "string",
          description: "Set the 'Current Blockers' field.",
        },
        append_activity: {
          type: "object",
          description: "Append a row to the Recent Activity table.",
          properties: {
            agent: { type: "string" },
            task_id: { type: "string" },
            summary: { type: "string" },
          },
          required: ["agent", "summary"],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },

  // ── 9. append_log ─────────────────────────────────────────────────────
  {
    name: "append_log",
    description:
      "Appends a structured log entry to today's log file at ai-context/logs/YYYY-MM-DD.md. Creates the file if it doesn't exist. Returns the log file path and entry written.",
    inputSchema: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          description: "Name of the agent or person writing the log.",
        },
        summary: {
          type: "string",
          description: "What was accomplished in this session or action.",
        },
        task_id: {
          type: "string",
          description: "Task ID this log entry relates to.",
        },
        files_changed: {
          type: "array",
          items: { type: "string" },
          description: "List of files created or modified.",
        },
        blockers: {
          type: "string",
          description: "Any blockers encountered. Write 'None' if none.",
        },
        next_step: {
          type: "string",
          description: "What should happen next.",
        },
      },
      required: ["agent", "summary"],
      additionalProperties: false,
    },
  },

  // ── 10. get_logs ──────────────────────────────────────────────────────
  {
    name: "get_logs",
    description:
      "Returns log entries from ai-context/logs/. Defaults to today's log. Supports filtering by date (YYYY-MM-DD), agent name, or task_id.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Date to read logs for, in YYYY-MM-DD format. Defaults to today. Use 'all' to read all available log files.",
          pattern: "^(\\d{4}-\\d{2}-\\d{2}|all)$",
        },
        agent: {
          type: "string",
          description: "Filter entries by agent name (case-insensitive).",
        },
        task_id: {
          type: "string",
          description: "Filter entries by task ID.",
        },
      },
      additionalProperties: false,
    },
  },

  // ── 11. record_decision ───────────────────────────────────────────────
  {
    name: "record_decision",
    description:
      "Creates a new decision file in ai-context/decisions/ using the standard template. File is named YYYY-MM-DD-{slug}.md. Returns the file path created.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, descriptive title for the decision.",
        },
        context: {
          type: "string",
          description:
            "Why this decision needed to be made — background, constraints, and problem statement.",
        },
        decision: {
          type: "string",
          description: "What was decided. State it clearly and unambiguously.",
        },
        consequences: {
          type: "string",
          description:
            "What this decision means going forward — what becomes easier/harder, what patterns now apply.",
        },
        options_considered: {
          type: "string",
          description:
            "Optional: alternatives evaluated before choosing. Can include pros/cons.",
        },
        related_files: {
          type: "array",
          items: { type: "string" },
          description: "File paths related to this decision.",
        },
        decided_by: {
          type: "string",
          description: "Agent or person making the decision.",
        },
        status: {
          type: "string",
          enum: ["proposed", "accepted", "deprecated"],
          description: "Decision status. Defaults to 'accepted'.",
        },
      },
      required: ["title", "context", "decision", "decided_by"],
      additionalProperties: false,
    },
  },

  // ── 12. detect_conflicts ──────────────────────────────────────────────
  {
    name: "detect_conflicts",
    description:
      "Runs the conflict detection script (.agent/skills/conflict-resolver/scripts/detect-conflicts.mjs) and returns the structured results: conflicts found (with type, file, severity, description), and a summary (total, critical, warnings, info counts).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // ── 13. get_project ───────────────────────────────────────────────────
  {
    name: "get_project",
    description:
      "Returns the full content of ai-context/project.md as text. This contains project name, goal, stack, operating rules, and repository structure.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // ── 14. get_federation_status ─────────────────────────────────────────
  {
    name: "get_federation_status",
    description:
      "Returns cross-repo task summaries from ai-context/federation-cache.json. Shows connected repos, their task counts, last sync time, and accessible/inaccessible status.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────

async function handleGetTasks(args) {
  const data = safeReadJSON(TASKS_FILE);
  if (!data) throw new Error("tasks.json not found or invalid");

  let tasks = data.tasks || [];

  if (args.status) tasks = tasks.filter((t) => t.status === args.status);
  if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);
  if (args.owner)
    tasks = tasks.filter(
      (t) => t.owner?.toLowerCase() === args.owner.toLowerCase()
    );
  if (args.area)
    tasks = tasks.filter(
      (t) => t.area?.toLowerCase() === args.area.toLowerCase()
    );

  return {
    total: tasks.length,
    meta: data.meta,
    tasks,
    filters_applied: Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined)
    ),
  };
}

async function handleGetTask(args) {
  const data = safeReadJSON(TASKS_FILE);
  if (!data) throw new Error("tasks.json not found or invalid");

  const task = (data.tasks || []).find(
    (t) => t.id.toLowerCase() === args.id.toLowerCase()
  );
  if (!task) throw new Error(`Task '${args.id}' not found`);

  return task;
}

async function handleUpdateTask(args) {
  const data = safeReadJSON(TASKS_FILE);
  if (!data) throw new Error("tasks.json not found or invalid");

  const idx = (data.tasks || []).findIndex(
    (t) => t.id.toLowerCase() === args.id.toLowerCase()
  );
  if (idx === -1) throw new Error(`Task '${args.id}' not found`);

  const updatable = ["status", "owner", "next_action", "priority", "notes", "files", "area"];
  const task = data.tasks[idx];
  const changes = {};

  for (const field of updatable) {
    if (args[field] !== undefined) {
      changes[field] = args[field];
      task[field] = args[field];
    }
  }

  task.updated_at = nowISO();
  task.last_updated_by = args.updated_by;
  data.meta.last_updated = task.updated_at;

  writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), "utf-8");

  return {
    success: true,
    task,
    changes_applied: { ...changes, updated_at: task.updated_at, last_updated_by: task.last_updated_by },
  };
}

async function handleCreateTask(args) {
  const data = safeReadJSON(TASKS_FILE);
  if (!data) throw new Error("tasks.json not found or invalid");

  const tasks = data.tasks || [];
  const id = generateTaskId(args.area || "TASK", tasks);
  const now = nowISO();

  const task = {
    id,
    title: args.title,
    status: args.status || "ready",
    priority: args.priority || "medium",
    owner: args.owner || "unassigned",
    last_updated_by: args.created_by || "agent",
    next_action: args.next_action || "",
    notes: args.notes || "",
    area: (args.area || "general").toLowerCase(),
    files: args.files || [],
    updated_at: now,
    created_at: now,
  };

  tasks.push(task);
  data.tasks = tasks;
  data.meta.last_updated = now;

  writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), "utf-8");

  return { success: true, task };
}

async function handleGetHandoff() {
  const text = safeReadFile(HANDOFF_ACTIVE);
  if (!text) return { error: "No active handoff found", path: HANDOFF_ACTIVE };

  const parsed = parseHandoff(text);
  return { path: HANDOFF_ACTIVE, ...parsed };
}

async function handleWriteHandoff(args) {
  const now = nowISO();
  const today = todayISO();

  // Archive previous handoff if it exists
  let archived_to = null;
  if (existsSync(HANDOFF_ACTIVE)) {
    ensureDir(HANDOFF_ARCHIVE);
    const prev = parseHandoff(safeReadFile(HANDOFF_ACTIVE));
    const slug = [
      today,
      prev?.from?.replace(/\s+/g, "-") || "unknown",
      prev?.to?.replace(/\s+/g, "-") || "unknown",
    ].join("-");
    archived_to = join(HANDOFF_ARCHIVE, `${slug}.md`);
    renameSync(HANDOFF_ACTIVE, archived_to);
  }

  // Build files list
  const filesList = (args.files_touched || [])
    .map((f) => `- ${f}`)
    .join("\n");

  const content = `---
from: ${args.from}
to: ${args.to}
task_id: ${args.task_id || ""}
status: open
created_at: ${now}
---

# Handoff: ${args.from} → ${args.to}

## Completed
${args.completed}

## Blockers
${args.blockers || "None"}

## Exact Next Step
${args.exact_next_step}

## Files Touched
${filesList || "_None recorded._"}
`;

  ensureDir(dirname(HANDOFF_ACTIVE));
  writeFileSync(HANDOFF_ACTIVE, content, "utf-8");

  return {
    success: true,
    path: HANDOFF_ACTIVE,
    archived_previous: archived_to,
    handoff: {
      from: args.from,
      to: args.to,
      task_id: args.task_id || null,
      created_at: now,
    },
  };
}

async function handleGetDashboard() {
  const text = safeReadFile(DASHBOARD_FILE);
  if (!text) return { error: "dashboard.md not found", path: DASHBOARD_FILE };

  return { path: DASHBOARD_FILE, ...parseDashboard(text) };
}

async function handleUpdateDashboard(args) {
  let text = safeReadFile(DASHBOARD_FILE);
  if (!text) throw new Error("dashboard.md not found");

  const fieldMap = {
    current_agent: "Current Agent",
    current_task_id: "Current Task ID",
    current_branch: "Current Branch",
    last_completed_step: "Last Completed Step",
    next_action: "Next Action",
    current_blockers: "Current Blockers",
  };

  const changes = [];
  for (const [arg, label] of Object.entries(fieldMap)) {
    if (args[arg] !== undefined) {
      text = updateDashboardField(text, label, args[arg]);
      changes.push(label);
    }
  }

  if (args.append_activity) {
    const { agent, task_id, summary } = args.append_activity;
    const today = todayISO();
    const newRow = `| ${today} | ${agent} | ${task_id || "—"} | ${summary} |`;
    // Insert after the header row of the Recent Activity table
    text = text.replace(
      /(##\s+Recent Activity[\s\S]*?\|[-:\s|]+\|\s*\n)/,
      `$1${newRow}\n`
    );
    changes.push("Recent Activity (append)");
  }

  writeFileSync(DASHBOARD_FILE, text, "utf-8");

  return { success: true, changes_applied: changes, path: DASHBOARD_FILE };
}

async function handleAppendLog(args) {
  ensureDir(LOGS_DIR);
  const today = todayISO();
  const logFile = join(LOGS_DIR, `${today}.md`);
  const timestamp = nowISO();
  const timeStr = timestamp.slice(11, 16);

  // Create header if new file
  if (!existsSync(logFile)) {
    writeFileSync(logFile, `# Agent Log — ${today}\n\n`, "utf-8");
  }

  const filesInline = (args.files_changed || []).join(", ");

  const entry = `
## [${timestamp}] ${args.agent}

**Task**: ${args.task_id || "—"}
**Summary**: ${args.summary}
**Files Changed**: ${filesInline || "(none)"}
**Blockers**: ${args.blockers || "None"}
**Next Step**: ${args.next_step || "—"}

---
`;

  const current = readFileSync(logFile, "utf-8");
  writeFileSync(logFile, current + entry, "utf-8");

  return {
    success: true,
    log_file: logFile,
    entry: {
      date: today,
      time: timeStr,
      agent: args.agent,
      task_id: args.task_id || null,
      summary: args.summary,
    },
  };
}

async function handleGetLogs(args) {
  ensureDir(LOGS_DIR);

  const targetDate = args.date === "all" ? null : (args.date || todayISO());
  let logFiles = [];

  if (targetDate) {
    const logFile = join(LOGS_DIR, `${targetDate}.md`);
    if (existsSync(logFile)) logFiles = [{ date: targetDate, path: logFile }];
    else {
      return {
        date: targetDate,
        entries: [],
        message: `No log file found for ${targetDate}`,
      };
    }
  } else {
    // All available logs
    const files = readdirSync(LOGS_DIR)
      .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse();
    logFiles = files.map((f) => ({ date: f.replace(".md", ""), path: join(LOGS_DIR, f) }));
  }

  const allEntries = [];
  for (const { date, path } of logFiles) {
    const text = safeReadFile(path);
    const entries = parseLogFile(text, date);
    allEntries.push(...entries);
  }

  let filtered = allEntries;
  if (args.agent)
    filtered = filtered.filter(
      (e) => e.agent?.toLowerCase().includes(args.agent.toLowerCase())
    );
  if (args.task_id)
    filtered = filtered.filter(
      (e) => e.task_id?.toLowerCase() === args.task_id.toLowerCase()
    );

  return {
    total: filtered.length,
    entries: filtered,
    filters_applied: Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined)
    ),
  };
}

async function handleRecordDecision(args) {
  ensureDir(DECISIONS_DIR);
  const today = todayISO();
  const slug = args.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const filename = `${today}-${slug}.md`;
  const filepath = join(DECISIONS_DIR, filename);

  if (existsSync(filepath))
    throw new Error(`Decision file already exists: ${filename}`);

  const relatedFilesList = (args.related_files || [])
    .map((f) => `- ${f}`)
    .join("\n");

  const content = `---
title: ${args.title}
status: ${args.status || "accepted"}
decided_by: ${args.decided_by}
created_at: ${nowISO()}
---

# Decision: ${args.title}

## Context
${args.context}

${
  args.options_considered
    ? `## Options Considered\n${args.options_considered}\n\n`
    : ""
}## Decision
${args.decision}

## Consequences
${args.consequences || "_Not specified._"}

## Related Files
${relatedFilesList || "- (none)"}
`;

  writeFileSync(filepath, content, "utf-8");

  return { success: true, path: filepath, filename };
}

async function handleDetectConflicts() {
  if (!existsSync(CONFLICT_SCRIPT)) {
    // Run a lightweight built-in check if the script doesn't exist
    return builtinConflictCheck();
  }

  try {
    const output = execFileSync("node", [CONFLICT_SCRIPT], {
      cwd: REPO_ROOT,
      timeout: 30000,
      encoding: "utf-8",
    });
    return JSON.parse(output);
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {}
    }
    throw new Error(`Conflict detection failed: ${err.message}`);
  }
}

function builtinConflictCheck() {
  const conflicts = [];

  // Check for git merge conflict markers
  const filesToCheck = [
    TASKS_FILE,
    DASHBOARD_FILE,
    PROJECT_FILE,
    HANDOFF_ACTIVE,
  ];
  for (const f of filesToCheck) {
    const text = safeReadFile(f);
    if (text && text.includes("<<<<<<<")) {
      conflicts.push({
        type: "git_merge_conflict",
        file: f.replace(REPO_ROOT + "/", ""),
        description: "Git merge conflict markers detected",
        severity: "critical",
        suggested_resolution: "Resolve merge conflict manually, then re-validate",
      });
    }
  }

  // Check for stale handoff (> 48h)
  if (existsSync(HANDOFF_ACTIVE)) {
    const stat = statSync(HANDOFF_ACTIVE);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > 48 * 60 * 60 * 1000) {
      conflicts.push({
        type: "stale_handoff",
        file: "ai-context/handoffs/active.md",
        description: `Active handoff is ${Math.round(ageMs / 3600000)}h old`,
        severity: "warning",
        suggested_resolution: "Update or archive the active handoff",
      });
    }
  }

  // Check for stale in_progress tasks
  const taskData = safeReadJSON(TASKS_FILE);
  if (taskData) {
    for (const task of taskData.tasks || []) {
      if (task.status === "in_progress" && task.updated_at) {
        const ageMs = Date.now() - new Date(task.updated_at).getTime();
        if (ageMs > 72 * 60 * 60 * 1000) {
          conflicts.push({
            type: "task_state_inconsistency",
            file: "ai-context/tasks.json",
            description: `Task ${task.id} has been in_progress for ${Math.round(ageMs / 3600000)}h`,
            severity: "warning",
            suggested_resolution: "Update task status or add a progress note",
          });
        }
      }
    }
  }

  const summary = {
    total: conflicts.length,
    critical: conflicts.filter((c) => c.severity === "critical").length,
    warnings: conflicts.filter((c) => c.severity === "warning").length,
    info: conflicts.filter((c) => c.severity === "info").length,
  };

  return { conflicts, summary };
}

async function handleGetProject() {
  const text = safeReadFile(PROJECT_FILE);
  if (!text) return { error: "project.md not found", path: PROJECT_FILE };
  return { path: PROJECT_FILE, content: text };
}

async function handleGetFederationStatus() {
  const data = safeReadJSON(FEDERATION_CACHE);
  if (!data) {
    return {
      error: "federation-cache.json not found",
      path: FEDERATION_CACHE,
    };
  }

  const repos = Object.entries(data.repos || {}).map(([name, info]) => ({
    name,
    accessible: info.accessible,
    prefix: info.prefix,
    remote: info.remote,
    sync_mode: info.sync_mode,
    last_synced: info.last_synced,
    task_count: (info.tasks || []).length,
    tasks: info.tasks || [],
  }));

  const total_tasks = repos.reduce((sum, r) => sum + r.task_count, 0);

  return {
    last_synced: data.last_synced,
    repo_count: repos.length,
    total_cross_repo_tasks: total_tasks,
    repos,
  };
}

// ─── Dispatch table ───────────────────────────────────────────────────────

const HANDLERS = {
  get_tasks: handleGetTasks,
  get_task: handleGetTask,
  update_task: handleUpdateTask,
  create_task: handleCreateTask,
  get_handoff: handleGetHandoff,
  write_handoff: handleWriteHandoff,
  get_dashboard: handleGetDashboard,
  update_dashboard: handleUpdateDashboard,
  append_log: handleAppendLog,
  get_logs: handleGetLogs,
  record_decision: handleRecordDecision,
  detect_conflicts: handleDetectConflicts,
  get_project: handleGetProject,
  get_federation_status: handleGetFederationStatus,
};

// ─── Server setup ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "antigravity-agent-os",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = HANDLERS[name];
  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: err.message,
            tool: name,
            args,
          }),
        },
      ],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with MCP stdio protocol
  process.stderr.write(
    `[agent-os-mcp] Server started. Repo root: ${REPO_ROOT}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[agent-os-mcp] Fatal: ${err.message}\n`);
  process.exit(1);
});
