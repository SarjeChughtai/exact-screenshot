#!/usr/bin/env node
// =============================================================================
// Antigravity Agent OS — validate-context.mjs
// Validates tasks.json and ai-context/ directory integrity
//
// Usage:
//   node scripts/validate-context.mjs [--tasks-file path] [--strict]
//
// Exit codes:
//   0 — all checks passed
//   1 — validation errors found
// =============================================================================

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..");
const AI_CTX = join(ROOT, "ai-context");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const VALID_STATUSES = new Set([
  "pending", "ready", "in_progress", "blocked", "review", "done", "archived",
]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const REQUIRED_TASK_FIELDS = [
  "id", "title", "status", "priority", "owner",
  "last_updated_by", "next_action",
];
const REQUIRED_META_FIELDS = ["version", "last_updated", "description"];

// ---------------------------------------------------------------------------
// Result collector
// ---------------------------------------------------------------------------
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  error(msg) {
    this.errors.push(msg);
    console.error(`  [FAIL] ${msg}`);
  }

  warn(msg) {
    this.warnings.push(msg);
    console.warn(`  [WARN] ${msg}`);
  }

  pass(msg) {
    this.passed.push(msg);
    console.log(`  [PASS] ${msg}`);
  }

  get isValid() {
    return this.errors.length === 0;
  }

  summary() {
    const total = this.errors.length + this.warnings.length + this.passed.length;
    console.log(`\n─────────────────────────────────────────`);
    console.log(`Validation complete — ${total} checks`);
    console.log(`  Passed:   ${this.passed.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    console.log(`  Errors:   ${this.errors.length}`);
    if (this.errors.length > 0) {
      console.log(`\nErrors:`);
      this.errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    }
    if (this.warnings.length > 0) {
      console.log(`\nWarnings:`);
      this.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
    }
    console.log(`─────────────────────────────────────────\n`);
  }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateTasksMeta(meta, result) {
  console.log("\n[meta]");
  if (!meta || typeof meta !== "object") {
    result.error("tasks.json: 'meta' field is missing or not an object");
    return;
  }

  for (const field of REQUIRED_META_FIELDS) {
    if (meta[field] === undefined || meta[field] === null || meta[field] === "") {
      result.error(`tasks.json meta: '${field}' is missing or empty`);
    } else {
      result.pass(`meta.${field} present`);
    }
  }

  if (typeof meta.version !== "number") {
    result.warn(`meta.version should be a number, got: ${typeof meta.version}`);
  } else if (meta.version < 1) {
    result.warn(`meta.version looks suspect: ${meta.version}`);
  }

  // Validate last_updated is a valid ISO date
  if (meta.last_updated) {
    const d = new Date(meta.last_updated);
    if (isNaN(d.getTime())) {
      result.error(`meta.last_updated is not a valid ISO date: ${meta.last_updated}`);
    } else {
      result.pass(`meta.last_updated is valid ISO date`);
      // Warn if last_updated is older than 30 days
      const ageMs = Date.now() - d.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > 30) {
        result.warn(`meta.last_updated is ${Math.floor(ageDays)} days old — context may be stale`);
      }
    }
  }
}

function validateTask(task, index, result) {
  const prefix = `tasks[${index}] (id: ${task.id || "?"})`;

  // Required fields
  for (const field of REQUIRED_TASK_FIELDS) {
    if (task[field] === undefined || task[field] === null || task[field] === "") {
      result.error(`${prefix}: required field '${field}' is missing or empty`);
    }
  }

  // Status
  if (task.status && !VALID_STATUSES.has(task.status)) {
    result.error(
      `${prefix}: invalid status '${task.status}'. Must be one of: ${[...VALID_STATUSES].join(", ")}`
    );
  } else if (task.status) {
    result.pass(`${prefix}: status '${task.status}' is valid`);
  }

  // Priority
  if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
    result.error(
      `${prefix}: invalid priority '${task.priority}'. Must be one of: ${[...VALID_PRIORITIES].join(", ")}`
    );
  } else if (task.priority) {
    result.pass(`${prefix}: priority '${task.priority}' is valid`);
  }

  // ID format — should be alphanumeric with dashes or underscores
  if (task.id && !/^[A-Za-z0-9_\-]+$/.test(task.id)) {
    result.warn(`${prefix}: id '${task.id}' contains unusual characters`);
  }

  // notes should be a string
  if (task.notes !== undefined && typeof task.notes !== "string") {
    result.error(`${prefix}: 'notes' must be a string`);
  }

  // files should be an array
  if (task.files !== undefined && !Array.isArray(task.files)) {
    result.error(`${prefix}: 'files' must be an array`);
  }

  // updated_at should be a valid ISO date if present
  if (task.updated_at) {
    const d = new Date(task.updated_at);
    if (isNaN(d.getTime())) {
      result.warn(`${prefix}: 'updated_at' is not a valid ISO date: ${task.updated_at}`);
    }
  }
}

function validateDuplicateIds(tasks, result) {
  console.log("\n[duplicate IDs]");
  const seen = new Map();
  for (const task of tasks) {
    if (!task.id) continue;
    if (seen.has(task.id)) {
      result.error(`Duplicate task ID found: '${task.id}'`);
    } else {
      seen.set(task.id, true);
    }
  }
  if (!tasks.some((t) => seen.get(t.id) === true && [...seen.values()].filter((v) => v === true).length > tasks.length)) {
    result.pass(`No duplicate task IDs`);
  }
}

function validateOrphanedReferences(tasks, result) {
  console.log("\n[orphaned references]");
  const taskIds = new Set(tasks.map((t) => t.id).filter(Boolean));

  // Look for any task referencing a blocked_by or depends_on that doesn't exist
  for (const task of tasks) {
    if (task.blocked_by) {
      const refs = Array.isArray(task.blocked_by) ? task.blocked_by : [task.blocked_by];
      for (const ref of refs) {
        if (!taskIds.has(ref)) {
          result.error(`Task '${task.id}': blocked_by references unknown task '${ref}'`);
        }
      }
    }
    if (task.depends_on) {
      const refs = Array.isArray(task.depends_on) ? task.depends_on : [task.depends_on];
      for (const ref of refs) {
        if (!taskIds.has(ref)) {
          result.warn(`Task '${task.id}': depends_on references unknown task '${ref}'`);
        }
      }
    }
  }
  result.pass("Orphaned reference check complete");
}

function validateInvalidStateTransitions(tasks, result) {
  console.log("\n[invalid states]");
  for (const task of tasks) {
    // A 'done' task should not have an empty next_action pointing at unfinished work
    if (task.status === "done" && task.next_action && task.next_action.toLowerCase().includes("todo")) {
      result.warn(`Task '${task.id}' is 'done' but next_action contains 'todo' — may be incomplete`);
    }

    // An 'archived' task should not be 'in_progress'
    if (task.status === "archived" && task.owner && task.owner !== "unassigned") {
      result.warn(
        `Task '${task.id}' is 'archived' but has owner '${task.owner}' — consider reassigning`
      );
    }

    // A 'blocked' task should have notes explaining the blocker
    if (task.status === "blocked" && (!task.notes || task.notes.trim() === "")) {
      result.warn(`Task '${task.id}' is 'blocked' but has no notes explaining the blocker`);
    }

    // A 'critical' task shouldn't be archived without explanation
    if (task.priority === "critical" && task.status === "archived") {
      result.warn(
        `Task '${task.id}' has priority 'critical' but status 'archived' — verify this is intentional`
      );
    }
  }
  result.pass("State transition checks complete");
}

function validateFileStructure(result) {
  console.log("\n[file structure]");
  const required = [
    { path: join(AI_CTX, "tasks.json"), label: "ai-context/tasks.json" },
    { path: join(AI_CTX, "project.md"), label: "ai-context/project.md" },
    { path: join(AI_CTX, "agents.md"), label: "ai-context/agents.md" },
    { path: join(AI_CTX, "dashboard.md"), label: "ai-context/dashboard.md" },
    { path: join(AI_CTX, "handoffs"), label: "ai-context/handoffs/" },
    { path: join(AI_CTX, "logs"), label: "ai-context/logs/" },
    { path: join(AI_CTX, "decisions"), label: "ai-context/decisions/" },
    { path: join(AI_CTX, "templates"), label: "ai-context/templates/" },
    { path: join(AI_CTX, "runbooks"), label: "ai-context/runbooks/" },
  ];

  for (const { path, label } of required) {
    if (existsSync(path)) {
      result.pass(`${label} exists`);
    } else {
      result.warn(`${label} is missing — run setup to create it`);
    }
  }

  // Check active.md in handoffs
  const activeHandoff = join(AI_CTX, "handoffs", "active.md");
  if (existsSync(activeHandoff)) {
    result.pass("ai-context/handoffs/active.md exists");
  } else {
    result.warn("ai-context/handoffs/active.md is missing — no active handoff");
  }
}

function validateDecisions(result) {
  console.log("\n[decisions]");
  const decisionsDir = join(AI_CTX, "decisions");
  if (!existsSync(decisionsDir)) {
    result.warn("decisions/ directory missing");
    return;
  }
  const files = readdirSync(decisionsDir).filter(
    (f) => f.endsWith(".md") && f !== "README.md"
  );
  if (files.length === 0) {
    result.warn("No decisions recorded yet — consider documenting architectural choices");
  } else {
    result.pass(`${files.length} decision(s) found`);
    for (const file of files) {
      const content = readFileSync(join(decisionsDir, file), "utf8");
      if (!content.includes("## Decision")) {
        result.warn(`decisions/${file}: missing '## Decision' section`);
      }
      if (!content.includes("## Context")) {
        result.warn(`decisions/${file}: missing '## Context' section`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");

  // Allow custom tasks file path
  const customPathIdx = args.indexOf("--tasks-file");
  const tasksFile =
    customPathIdx !== -1 && args[customPathIdx + 1]
      ? resolve(args[customPathIdx + 1])
      : join(AI_CTX, "tasks.json");

  const result = new ValidationResult();

  console.log("═══════════════════════════════════════════");
  console.log("  Antigravity Agent OS — Context Validator");
  console.log("═══════════════════════════════════════════");
  console.log(`Tasks file: ${tasksFile}`);
  console.log(`Strict mode: ${strict ? "ON" : "OFF"}`);

  // 1. File exists
  console.log("\n[tasks.json]");
  if (!existsSync(tasksFile)) {
    result.error(`tasks.json not found at: ${tasksFile}`);
    result.summary();
    process.exit(1);
  }
  result.pass("tasks.json file exists");

  // 2. Valid JSON
  let ctx;
  try {
    ctx = JSON.parse(readFileSync(tasksFile, "utf8"));
    result.pass("tasks.json is valid JSON");
  } catch (err) {
    result.error(`tasks.json is not valid JSON: ${err.message}`);
    result.summary();
    process.exit(1);
  }

  // 3. Top-level structure
  if (!ctx.meta) result.error("tasks.json: missing 'meta' field");
  if (!Array.isArray(ctx.tasks)) {
    result.error("tasks.json: 'tasks' must be an array");
    result.summary();
    process.exit(1);
  } else {
    result.pass(`tasks.json: 'tasks' is an array with ${ctx.tasks.length} item(s)`);
  }

  // 4. Meta validation
  validateTasksMeta(ctx.meta, result);

  // 5. Individual task validation
  console.log("\n[tasks]");
  for (let i = 0; i < ctx.tasks.length; i++) {
    validateTask(ctx.tasks[i], i, result);
  }

  // 6. Duplicate IDs
  validateDuplicateIds(ctx.tasks, result);

  // 7. Orphaned references
  validateOrphanedReferences(ctx.tasks, result);

  // 8. Invalid state transitions
  validateInvalidStateTransitions(ctx.tasks, result);

  // 9. File structure
  validateFileStructure(result);

  // 10. Decisions
  validateDecisions(result);

  // Print summary
  result.summary();

  // Exit with error if validation failed
  if (!result.isValid || (strict && result.warnings.length > 0)) {
    process.exit(1);
  }

  process.exit(0);
}

main();
