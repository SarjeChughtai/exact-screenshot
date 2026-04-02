#!/usr/bin/env node
/**
 * detect-conflicts.mjs
 * Detects conflicts in ai-context/ shared agent memory files.
 *
 * Checks for:
 *   (a) Git merge conflict markers
 *   (b) Task state inconsistency (tasks.json vs logs)
 *   (c) Stale handoffs
 *   (d) Dashboard drift
 *   (e) Duplicate task updates (race conditions)
 *   (f) Orphaned log references
 *   (g) Timestamp anomalies
 *
 * Outputs a JSON report to stdout:
 *   { conflicts: [{type, file, description, severity, suggested_resolution}], summary: {total, critical, warnings, info} }
 *
 * Usage:
 *   node .agent/skills/conflict-resolver/scripts/detect-conflicts.mjs
 *   node .agent/skills/conflict-resolver/scripts/detect-conflicts.mjs --pretty
 *   node .agent/skills/conflict-resolver/scripts/detect-conflicts.mjs --quiet   (exit 1 if critical found)
 *
 * Exit codes:
 *   0 — no conflicts found, or only info-level
 *   1 — critical conflicts found
 *   2 — warnings found (no criticals)
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, basename } from "path";

// ─── Configuration ────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
const PRETTY = ARGS.includes("--pretty");
const QUIET = ARGS.includes("--quiet");

// Resolve repo root: walk up from CWD looking for ai-context/ or use CWD
const REPO_ROOT = findRepoRoot(process.cwd());
const AI_CONTEXT = join(REPO_ROOT, "ai-context");

// Conflict type constants
const TYPE = {
  GIT_CONFLICT: "git_merge_conflict",
  TASK_STATE: "task_state_inconsistency",
  STALE_HANDOFF: "stale_handoff",
  DASHBOARD_DRIFT: "dashboard_drift",
  DUPLICATE_UPDATE: "duplicate_task_update",
  ORPHANED_REF: "orphaned_log_reference",
  TIMESTAMP_ANOMALY: "timestamp_anomaly",
};

const SEVERITY = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
};

// How long before a handoff is considered stale (milliseconds)
const STALE_HANDOFF_MS = 48 * 60 * 60 * 1000; // 48 hours
// How long before an in_progress task is considered stale
const STALE_TASK_MS = 72 * 60 * 60 * 1000; // 72 hours
// Window for duplicate update detection
const RACE_CONDITION_WINDOW_MS = 60 * 1000; // 60 seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "ai-context"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function safeParseJSON(content, filePath) {
  try {
    return JSON.parse(content);
  } catch (err) {
    return { __parseError: err.message, __filePath: filePath };
  }
}

function isIso8601(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  );
}

function parseTimestamp(value) {
  if (!isIso8601(value)) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function now() {
  return new Date();
}

function conflict(type, file, description, severity, suggested_resolution, extra = {}) {
  return { type, file, description, severity, suggested_resolution, ...extra };
}

function relPath(absPath) {
  return absPath.replace(REPO_ROOT + "/", "");
}

// ─── File Readers ─────────────────────────────────────────────────────────────

function readTasksJson() {
  const filePath = join(AI_CONTEXT, "tasks.json");
  if (!existsSync(filePath)) return { exists: false, filePath, tasks: [] };

  const content = safeReadFile(filePath);
  if (!content) return { exists: true, filePath, tasks: [], readError: true };

  const parsed = safeParseJSON(content, filePath);
  if (parsed.__parseError) {
    return { exists: true, filePath, tasks: [], parseError: parsed.__parseError };
  }

  // Support both array format (old) and object format (new, with meta)
  const tasks = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.tasks)
    ? parsed.tasks
    : [];

  return { exists: true, filePath, tasks, raw: content };
}

function readHandoffsActive() {
  const filePath = join(AI_CONTEXT, "handoffs", "active.md");
  if (!existsSync(filePath)) return { exists: false, filePath, blocks: [] };

  const content = safeReadFile(filePath);
  if (!content) return { exists: true, filePath, blocks: [], readError: true };

  const blocks = parseHandoffBlocks(content);
  return { exists: true, filePath, blocks, raw: content };
}

function readDashboard() {
  const filePath = join(AI_CONTEXT, "dashboard.md");
  if (!existsSync(filePath)) return { exists: false, filePath };

  const content = safeReadFile(filePath);
  return { exists: !!content, filePath, raw: content || "" };
}

function readLogFiles() {
  const logsDir = join(AI_CONTEXT, "logs");
  if (!existsSync(logsDir)) return [];

  const files = [];
  try {
    const entries = readdirSync(logsDir).filter(
      (f) => f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}\.md$/.test(f)
    );
    entries.sort().reverse(); // most recent first

    for (const entry of entries) {
      const filePath = join(logsDir, entry);
      const content = safeReadFile(filePath);
      if (content) {
        files.push({
          filePath,
          date: entry.replace(".md", ""),
          entries: parseLogEntries(content),
          raw: content,
        });
      }
    }
  } catch {
    // readdirSync failed — ignore
  }

  return files;
}

function scanAllAiContextFiles() {
  const files = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) {
            // Skip archive directories for conflict marker scanning (they may contain intentional old data)
            if (entry !== "archive" && entry !== ".git") walk(full);
          } else {
            files.push(full);
          }
        } catch {
          // stat failed
        }
      }
    } catch {
      // readdirSync failed
    }
  }
  walk(AI_CONTEXT);
  return files;
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parses handoff blocks from active.md.
 * Each block is separated by `---` lines and starts with `## Handoff:`.
 */
function parseHandoffBlocks(content) {
  const blocks = [];
  // Split on lines that are exactly `---`
  const sections = content.split(/^---$/m);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Look for a handoff block
    const headlineMatch = section.match(/^##\s+Handoff:\s+(.+?)\s*$/m);
    if (!headlineMatch) continue;

    const block = { raw: section, headline: headlineMatch[1] };

    // Extract timestamp
    const tsMatch = section.match(/^timestamp:\s*(.+)$/m);
    if (tsMatch) block.timestamp = tsMatch[1].trim();

    // Extract task_ids
    const taskIdsMatch = section.match(/^task_ids:\s*\[([^\]]*)\]/m);
    if (taskIdsMatch) {
      block.task_ids = taskIdsMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Try task_id (singular, old format)
      const taskIdMatch = section.match(/^task_id:\s*(\S+)/m);
      if (taskIdMatch) block.task_ids = [taskIdMatch[1].trim()];
    }

    // Extract status field (some older formats have it)
    const statusMatch = section.match(/^status:\s*(\S+)/m);
    if (statusMatch) block.status = statusMatch[1].trim();

    blocks.push(block);
  }

  return blocks;
}

/**
 * Parses log entries from a log file.
 * Each entry starts with `## [HH:MM:SS]`.
 */
function parseLogEntries(content) {
  const entries = [];
  const lines = content.split("\n");
  let current = null;

  for (const line of lines) {
    const match = line.match(/^##\s+\[(\d{2}:\d{2}:\d{2})\]\s+(.*)$/);
    if (match) {
      if (current) entries.push(current);
      current = { time: match[1], headline: match[2], body: "", taskIds: [] };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) entries.push(current);

  // Extract task IDs mentioned in entries
  const taskIdPattern = /\b([A-Z]+-\d{3,})\b/g;
  for (const entry of entries) {
    const combined = entry.headline + " " + entry.body;
    const matches = [...combined.matchAll(taskIdPattern)];
    entry.taskIds = [...new Set(matches.map((m) => m[1]))];
  }

  return entries;
}

/**
 * Extracts task IDs referenced in dashboard.md.
 */
function extractDashboardTaskIds(raw) {
  const taskIdPattern = /\b([A-Z]+-\d{3,})\b/g;
  return [...new Set([...raw.matchAll(taskIdPattern)].map((m) => m[1]))];
}

/**
 * Extracts the "Current Agent" from dashboard.md.
 */
function extractDashboardCurrentAgent(raw) {
  const match = raw.match(/\*\*Current Agent\*\*\s*\|\s*(.+)/);
  if (!match) return null;
  const value = match[1].trim().replace(/\|.*$/, "").trim();
  return value === "—" || value === "" ? null : value;
}

/**
 * Extracts the "Current Task ID" from dashboard.md.
 */
function extractDashboardCurrentTaskId(raw) {
  const match = raw.match(/\*\*Current Task ID\*\*\s*\|\s*(.+)/);
  if (!match) return null;
  const value = match[1].trim().replace(/\|.*$/, "").trim();
  return value === "—" || value === "" ? null : value;
}

// ─── Conflict Detectors ───────────────────────────────────────────────────────

/**
 * (a) Git merge conflict markers
 */
function detectGitConflicts(allFiles) {
  const conflicts = [];
  const markerPattern = /^<{7}|^={7}|^>{7}/m;

  for (const filePath of allFiles) {
    const content = safeReadFile(filePath);
    if (!content) continue;
    if (markerPattern.test(content)) {
      const file = relPath(filePath);
      // Count occurrences
      const count = (content.match(/^<{7}/gm) || []).length;
      conflicts.push(
        conflict(
          TYPE.GIT_CONFLICT,
          file,
          `Git merge conflict markers found (${count} conflict block${count !== 1 ? "s" : ""})`,
          SEVERITY.CRITICAL,
          `Resolve conflict markers in ${file}. For tasks.json: parse both sides, merge task arrays by ID (later updated_at wins). For logs: keep all entries sorted by timestamp. For handoffs: keep the more recent handoff, archive the other. For dashboard: regenerate from tasks.json.`
        )
      );
    }
  }

  return conflicts;
}

/**
 * (b) Task state inconsistency: tasks.json status vs log-implied status
 */
function detectTaskStateInconsistency(tasksData, logFiles) {
  const conflicts = [];
  const { tasks } = tasksData;

  // Build a map of task ID → most recent log mention
  const latestLogMentionByTask = new Map();

  for (const logFile of logFiles) {
    for (const entry of logFile.entries) {
      for (const taskId of entry.taskIds) {
        const entryTimestamp = new Date(`${logFile.date}T${entry.time}Z`);
        const existing = latestLogMentionByTask.get(taskId);

        // Determine implied status from the log entry headline
        let impliedStatus = null;
        const headline = entry.headline.toLowerCase();
        if (
          headline.includes("complet") ||
          headline.includes("done") ||
          headline.includes("finished") ||
          headline.includes("closed")
        ) {
          impliedStatus = "done";
        } else if (
          headline.includes("handoff") ||
          headline.includes("hand off")
        ) {
          impliedStatus = "in_progress"; // handoffs don't necessarily mean done
        } else if (headline.includes("blocked")) {
          impliedStatus = "blocked";
        }

        if (
          !existing ||
          entryTimestamp > existing.timestamp
        ) {
          latestLogMentionByTask.set(taskId, {
            timestamp: entryTimestamp,
            headline: entry.headline,
            file: logFile.filePath,
            impliedStatus,
          });
        }
      }
    }
  }

  for (const task of tasks) {
    if (!task.id || !task.status || !task.updated_at) continue;
    const taskTs = parseTimestamp(task.updated_at);
    const logMention = latestLogMentionByTask.get(task.id);

    if (!logMention || !logMention.impliedStatus) continue;

    // Only flag when there's a clear contradiction
    const statusContradicts =
      (logMention.impliedStatus === "done" &&
        ["in_progress", "ready", "pending", "blocked"].includes(task.status)) ||
      (logMention.impliedStatus === "blocked" && task.status === "done");

    if (!statusContradicts) continue;

    const logIsNewer = taskTs && logMention.timestamp > taskTs;
    const timeDiffSec = taskTs
      ? Math.abs(logMention.timestamp - taskTs) / 1000
      : null;
    const isAmbiguous = timeDiffSec !== null && timeDiffSec < 60;

    const severity = isAmbiguous ? SEVERITY.WARNING : SEVERITY.CRITICAL;

    conflicts.push(
      conflict(
        TYPE.TASK_STATE,
        relPath(tasksData.filePath),
        `Task ${task.id} has status "${task.status}" in tasks.json but latest log (${relPath(logMention.file)}) implies status "${logMention.impliedStatus}" — headline: "${logMention.headline}"${logIsNewer ? " (log is newer)" : taskTs ? " (tasks.json is newer)" : ""}${isAmbiguous ? " — timestamps within 60s, ambiguous" : ""}`,
        severity,
        isAmbiguous
          ? `Set ${task.id} status to "review" and flag for human review — timestamps are within 60 seconds`
          : logIsNewer
          ? `Update ${task.id} status to "${logMention.impliedStatus}" in tasks.json (log timestamp ${logMention.timestamp.toISOString()} is newer than tasks.json updated_at ${task.updated_at})`
          : `Trust tasks.json — it has a newer updated_at. Append a clarifying note to the log entry.`,
        { taskId: task.id }
      )
    );
  }

  return conflicts;
}

/**
 * (c) Stale handoffs
 */
function detectStaleHandoffs(handoffsData, tasksData) {
  const conflicts = [];
  const { blocks, filePath } = handoffsData;
  const taskMap = new Map(tasksData.tasks.map((t) => [t.id, t]));

  for (const block of blocks) {
    if (!block.task_ids || block.task_ids.length === 0) continue;

    const blockTs = block.timestamp ? parseTimestamp(block.timestamp) : null;
    const ageMs = blockTs ? now() - blockTs : null;

    for (const taskId of block.task_ids) {
      const task = taskMap.get(taskId);

      if (!task) {
        // Task doesn't exist in tasks.json — orphaned handoff
        conflicts.push(
          conflict(
            TYPE.STALE_HANDOFF,
            relPath(filePath),
            `Handoff block "${block.headline}" references task ${taskId} which does not exist in tasks.json`,
            SEVERITY.WARNING,
            `Archive this handoff block to handoffs/archive/YYYY-MM-DD.md. Task ${taskId} may have been archived or never registered.`,
            { taskId }
          )
        );
        continue;
      }

      // Check if task is done but handoff is still active
      if (task.status === "done" || task.status === "archived") {
        conflicts.push(
          conflict(
            TYPE.STALE_HANDOFF,
            relPath(filePath),
            `Handoff block "${block.headline}" references task ${taskId} which is now "${task.status}" — handoff is no longer active`,
            SEVERITY.WARNING,
            `Archive this handoff block to handoffs/archive/YYYY-MM-DD.md and remove it from active.md`,
            { taskId }
          )
        );
        continue;
      }

      // Check if handoff is over 48 hours old
      if (ageMs !== null && ageMs > STALE_HANDOFF_MS) {
        const ageHours = Math.round(ageMs / 1000 / 3600);
        conflicts.push(
          conflict(
            TYPE.STALE_HANDOFF,
            relPath(filePath),
            `Handoff block "${block.headline}" for task ${taskId} is ${ageHours} hours old (threshold: 48h) and task is still "${task.status}"`,
            SEVERITY.WARNING,
            `Reconcile handoff with current tasks.json state. Update "Exact Next Step" from task.next_action, re-stamp with current timestamp, and add a reconciliation note.`,
            { taskId, ageHours }
          )
        );
      }

      // Check if handoff owner matches tasks.json owner
      if (block.headline && task.owner) {
        const toAgentMatch = block.headline.match(/→\s*(.+)$/);
        if (toAgentMatch) {
          const handoffToAgent = toAgentMatch[1].trim();
          if (
            handoffToAgent.toLowerCase() !== task.owner.toLowerCase() &&
            task.owner.toLowerCase() !== "system"
          ) {
            conflicts.push(
              conflict(
                TYPE.STALE_HANDOFF,
                relPath(filePath),
                `Handoff block "${block.headline}" sends to "${handoffToAgent}" but tasks.json shows task ${taskId} owner is "${task.owner}"`,
                SEVERITY.WARNING,
                `Refresh handoff to reflect current task owner "${task.owner}" from tasks.json, or verify the ownership transfer completed correctly.`,
                { taskId }
              )
            );
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * (d) Dashboard drift
 */
function detectDashboardDrift(dashboardData, tasksData, handoffsData) {
  const conflicts = [];
  if (!dashboardData.exists || !dashboardData.raw) return conflicts;

  const { raw, filePath } = dashboardData;
  const taskMap = new Map(tasksData.tasks.map((t) => [t.id, t]));

  // Find active in-progress tasks in tasks.json
  const inProgressTasks = tasksData.tasks.filter(
    (t) => t.status === "in_progress"
  );
  const blockedTasks = tasksData.tasks.filter((t) => t.status === "blocked");

  // Check "Current Task ID" in dashboard
  const dashTaskId = extractDashboardCurrentTaskId(raw);
  if (dashTaskId) {
    const task = taskMap.get(dashTaskId);
    if (!task) {
      conflicts.push(
        conflict(
          TYPE.DASHBOARD_DRIFT,
          relPath(filePath),
          `Dashboard shows "Current Task ID: ${dashTaskId}" but this task does not exist in tasks.json`,
          SEVERITY.CRITICAL,
          `Regenerate dashboard.md from tasks.json. The current task ID must exist in tasks.json.`
        )
      );
    } else if (task.status !== "in_progress") {
      conflicts.push(
        conflict(
          TYPE.DASHBOARD_DRIFT,
          relPath(filePath),
          `Dashboard shows "Current Task ID: ${dashTaskId}" but tasks.json shows this task has status "${task.status}" (not in_progress)`,
          SEVERITY.WARNING,
          `Regenerate dashboard.md from tasks.json. The current task ID should be an in_progress task.`
        )
      );
    }
  } else if (inProgressTasks.length > 0) {
    conflicts.push(
      conflict(
        TYPE.DASHBOARD_DRIFT,
        relPath(filePath),
        `Dashboard shows no "Current Task ID" but tasks.json has ${inProgressTasks.length} in_progress task(s): ${inProgressTasks.map((t) => t.id).join(", ")}`,
        SEVERITY.WARNING,
        `Regenerate dashboard.md from tasks.json to reflect active in_progress tasks.`
      )
    );
  }

  // Check "Current Agent" in dashboard
  const dashAgent = extractDashboardCurrentAgent(raw);
  if (dashAgent && inProgressTasks.length > 0) {
    const inProgressOwners = new Set(inProgressTasks.map((t) => t.owner));
    if (!inProgressOwners.has(dashAgent)) {
      conflicts.push(
        conflict(
          TYPE.DASHBOARD_DRIFT,
          relPath(filePath),
          `Dashboard shows "Current Agent: ${dashAgent}" but no in_progress task in tasks.json is owned by "${dashAgent}" (actual owners: ${[...inProgressOwners].join(", ")})`,
          SEVERITY.WARNING,
          `Regenerate dashboard.md from tasks.json to reflect the actual agent owning in_progress work.`
        )
      );
    }
  }

  // Check that all task IDs mentioned in dashboard exist in tasks.json
  const dashTaskIds = extractDashboardTaskIds(raw);
  for (const taskId of dashTaskIds) {
    if (!taskMap.has(taskId)) {
      conflicts.push(
        conflict(
          TYPE.DASHBOARD_DRIFT,
          relPath(filePath),
          `Dashboard references task ${taskId} which does not exist in tasks.json`,
          SEVERITY.INFO,
          `Regenerate dashboard.md from tasks.json to remove stale task references.`
        )
      );
    }
  }

  // Check blocked section
  const dashHasBlockedSection = raw.toLowerCase().includes("blocked");
  if (blockedTasks.length > 0 && !dashHasBlockedSection) {
    conflicts.push(
      conflict(
        TYPE.DASHBOARD_DRIFT,
        relPath(filePath),
        `tasks.json has ${blockedTasks.length} blocked task(s) (${blockedTasks.map((t) => t.id).join(", ")}) but dashboard has no blocked section`,
        SEVERITY.WARNING,
        `Regenerate dashboard.md from tasks.json to include the blocked tasks section.`
      )
    );
  }

  return conflicts;
}

/**
 * (e) Duplicate task updates (race conditions)
 */
function detectDuplicateUpdates(tasksData, logFiles) {
  const conflicts = [];
  const { tasks, filePath } = tasksData;

  // Build update timeline per task from log entries
  const taskUpdateLog = new Map();

  for (const logFile of logFiles) {
    for (const entry of logFile.entries) {
      for (const taskId of entry.taskIds) {
        if (!taskUpdateLog.has(taskId)) taskUpdateLog.set(taskId, []);
        const ts = new Date(`${logFile.date}T${entry.time}Z`);
        taskUpdateLog.get(taskId).push({
          timestamp: ts,
          headline: entry.headline,
          file: logFile.filePath,
        });
      }
    }
  }

  // Check tasks where multiple agents are recorded as last_updated_by within a short window
  // We can only detect this from tasks.json directly if there are suspiciously close update windows
  // More reliable: check for tasks where last_updated_by doesn't match expected owner transitions

  for (const task of tasks) {
    if (!task.id) continue;

    const updates = taskUpdateLog.get(task.id);
    if (!updates || updates.length < 2) continue;

    // Sort by timestamp
    updates.sort((a, b) => a.timestamp - b.timestamp);

    // Find consecutive updates within the race condition window
    for (let i = 1; i < updates.length; i++) {
      const prev = updates[i - 1];
      const curr = updates[i];
      const diffMs = curr.timestamp - prev.timestamp;

      if (diffMs >= 0 && diffMs <= RACE_CONDITION_WINDOW_MS) {
        conflicts.push(
          conflict(
            TYPE.DUPLICATE_UPDATE,
            relPath(filePath),
            `Task ${task.id} has ${updates.length} log entries within 60 seconds: "${prev.headline}" (${prev.timestamp.toISOString()}) and "${curr.headline}" (${curr.timestamp.toISOString()})`,
            SEVERITY.WARNING,
            `Review both update entries for ${task.id}. If field values conflict, apply the later timestamp's version. For notes, concatenate both. If status conflicts within 60s, set to "review" and flag for human.`,
            { taskId: task.id }
          )
        );
        break; // Only flag once per task
      }
    }
  }

  return conflicts;
}

/**
 * (f) Orphaned log references
 */
function detectOrphanedLogRefs(tasksData, logFiles) {
  const conflicts = [];
  const taskIds = new Set(tasksData.tasks.map((t) => t.id).filter(Boolean));

  const mentioned = new Map(); // taskId → [{ file, headline }]

  for (const logFile of logFiles) {
    for (const entry of logFile.entries) {
      for (const taskId of entry.taskIds) {
        if (!taskIds.has(taskId)) {
          if (!mentioned.has(taskId)) mentioned.set(taskId, []);
          mentioned.get(taskId).push({
            file: logFile.filePath,
            headline: entry.headline,
          });
        }
      }
    }
  }

  for (const [taskId, refs] of mentioned.entries()) {
    const files = [...new Set(refs.map((r) => relPath(r.file)))].join(", ");
    const sample = refs[0].headline;
    conflicts.push(
      conflict(
        TYPE.ORPHANED_REF,
        files,
        `Task ID ${taskId} appears in log(s) [${files}] but does not exist in tasks.json (sample entry: "${sample}")`,
        SEVERITY.WARNING,
        `Do not delete the log entry. Append a clarifying inline comment to the log noting that ${taskId} was not found in tasks.json. Consider whether this task was incorrectly deleted and should be restored.`,
        { taskId }
      )
    );
  }

  return conflicts;
}

/**
 * (g) Timestamp anomalies
 */
function detectTimestampAnomalies(tasksData, logFiles) {
  const conflicts = [];
  const currentNow = now();

  // Check tasks.json updated_at values
  for (const task of tasksData.tasks) {
    if (!task.id || !task.updated_at) continue;

    const ts = parseTimestamp(task.updated_at);
    if (!ts) {
      conflicts.push(
        conflict(
          TYPE.TIMESTAMP_ANOMALY,
          relPath(tasksData.filePath),
          `Task ${task.id} has invalid updated_at value: "${task.updated_at}"`,
          SEVERITY.CRITICAL,
          `Replace ${task.id}.updated_at with a valid ISO 8601 timestamp (current time: ${currentNow.toISOString()})`,
          { taskId: task.id }
        )
      );
      continue;
    }

    // Future timestamp
    if (ts > currentNow) {
      const diffMin = Math.round((ts - currentNow) / 60000);
      conflicts.push(
        conflict(
          TYPE.TIMESTAMP_ANOMALY,
          relPath(tasksData.filePath),
          `Task ${task.id} has a future updated_at timestamp: "${task.updated_at}" (${diffMin} minutes in the future) — possible clock skew`,
          SEVERITY.WARNING,
          `Replace ${task.id}.updated_at with the current timestamp: ${currentNow.toISOString()}. Add a note to the task's notes field about the original value.`,
          { taskId: task.id }
        )
      );
    }

    // Stale in_progress
    if (
      task.status === "in_progress" &&
      currentNow - ts > STALE_TASK_MS
    ) {
      const ageHours = Math.round((currentNow - ts) / 1000 / 3600);
      conflicts.push(
        conflict(
          TYPE.TIMESTAMP_ANOMALY,
          relPath(tasksData.filePath),
          `Task ${task.id} has been "in_progress" for ${ageHours} hours without an update — may be stale or abandoned`,
          SEVERITY.WARNING,
          `Verify ${task.id} is still actively being worked. If not, update the status to "blocked", "review", or "done" as appropriate.`,
          { taskId: task.id }
        )
      );
    }
  }

  // Check log file entry ordering within each file
  for (const logFile of logFiles) {
    const entries = logFile.entries;
    let prevTs = null;
    let outOfOrder = false;

    for (const entry of entries) {
      const ts = new Date(`${logFile.date}T${entry.time}Z`);
      if (prevTs && ts < prevTs) {
        outOfOrder = true;
        break;
      }
      prevTs = ts;
    }

    if (outOfOrder) {
      conflicts.push(
        conflict(
          TYPE.TIMESTAMP_ANOMALY,
          relPath(logFile.filePath),
          `Log entries in ${basename(logFile.filePath)} are not in chronological order`,
          SEVERITY.INFO,
          `Re-sort log entries by their [HH:MM:SS] timestamp headers. Append a comment at the end of the file noting the re-sort.`
        )
      );
    }
  }

  return conflicts;
}

// ─── Main Detection Runner ────────────────────────────────────────────────────

async function detectAllConflicts() {
  const allConflicts = [];
  const detectionErrors = [];

  // Read all data sources
  const tasksData = readTasksJson();
  const handoffsData = readHandoffsActive();
  const dashboardData = readDashboard();
  const logFiles = readLogFiles();
  const allFiles = scanAllAiContextFiles();

  // Report missing critical files
  if (!tasksData.exists) {
    detectionErrors.push(`ai-context/tasks.json not found — cannot perform most checks`);
  }
  if (tasksData.parseError) {
    detectionErrors.push(`ai-context/tasks.json parse error: ${tasksData.parseError} — resolve JSON syntax before running conflict detection`);
  }
  if (!handoffsData.exists) {
    detectionErrors.push(`ai-context/handoffs/active.md not found — handoff checks skipped`);
  }

  // Run all detectors
  if (allFiles.length > 0) {
    allConflicts.push(...detectGitConflicts(allFiles));
  }

  if (tasksData.exists && !tasksData.parseError) {
    allConflicts.push(...detectTaskStateInconsistency(tasksData, logFiles));

    if (handoffsData.exists) {
      allConflicts.push(...detectStaleHandoffs(handoffsData, tasksData));
    }

    if (dashboardData.exists) {
      allConflicts.push(...detectDashboardDrift(dashboardData, tasksData, handoffsData));
    }

    allConflicts.push(...detectDuplicateUpdates(tasksData, logFiles));
    allConflicts.push(...detectOrphanedLogRefs(tasksData, logFiles));
    allConflicts.push(...detectTimestampAnomalies(tasksData, logFiles));
  }

  // Build summary
  const critical = allConflicts.filter((c) => c.severity === SEVERITY.CRITICAL).length;
  const warnings = allConflicts.filter((c) => c.severity === SEVERITY.WARNING).length;
  const info = allConflicts.filter((c) => c.severity === SEVERITY.INFO).length;

  const report = {
    generated_at: now().toISOString(),
    repo_root: REPO_ROOT,
    conflicts: allConflicts,
    detection_errors: detectionErrors,
    summary: {
      total: allConflicts.length,
      critical,
      warnings,
      info,
    },
  };

  return report;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function printPretty(report) {
  const { conflicts, summary, detection_errors } = report;

  console.log(`\nAntigravity Conflict Detector`);
  console.log(`Generated: ${report.generated_at}`);
  console.log(`Repo root: ${report.repo_root}`);
  console.log(`─────────────────────────────────────────────────────────`);

  if (detection_errors.length > 0) {
    console.log(`\n⚠ Detection Errors:`);
    detection_errors.forEach((e) => console.log(`  • ${e}`));
  }

  if (conflicts.length === 0) {
    console.log(`\n✓ No conflicts detected. All ai-context/ files appear consistent.`);
  } else {
    const criticals = conflicts.filter((c) => c.severity === SEVERITY.CRITICAL);
    const warnings = conflicts.filter((c) => c.severity === SEVERITY.WARNING);
    const infos = conflicts.filter((c) => c.severity === SEVERITY.INFO);

    if (criticals.length > 0) {
      console.log(`\n✗ CRITICAL (${criticals.length}):`);
      criticals.forEach((c) => {
        console.log(`\n  [${c.type}] ${c.file}`);
        console.log(`  Problem:    ${c.description}`);
        console.log(`  Resolution: ${c.suggested_resolution}`);
      });
    }

    if (warnings.length > 0) {
      console.log(`\n⚠ WARNINGS (${warnings.length}):`);
      warnings.forEach((c) => {
        console.log(`\n  [${c.type}] ${c.file}`);
        console.log(`  Problem:    ${c.description}`);
        console.log(`  Resolution: ${c.suggested_resolution}`);
      });
    }

    if (infos.length > 0) {
      console.log(`\nℹ INFO (${infos.length}):`);
      infos.forEach((c) => {
        console.log(`\n  [${c.type}] ${c.file}`);
        console.log(`  Problem:    ${c.description}`);
        console.log(`  Resolution: ${c.suggested_resolution}`);
      });
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`Summary: ${summary.total} conflict(s) — ${summary.critical} critical, ${summary.warnings} warnings, ${summary.info} info`);

  if (summary.critical > 0) {
    console.log(`\nRun conflict-resolver skill to resolve critical conflicts before continuing work.\n`);
  } else if (summary.warnings > 0) {
    console.log(`\nReview warnings and resolve before the next agent session.\n`);
  } else {
    console.log(`\nAll checks passed. Context is consistent.\n`);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    const report = await detectAllConflicts();

    if (PRETTY) {
      printPretty(report);
    } else {
      console.log(JSON.stringify(report, null, 2));
    }

    // Exit codes
    if (report.summary.critical > 0) {
      process.exit(1);
    } else if (report.summary.warnings > 0 && QUIET) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`Fatal error in conflict detector: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
})();
