#!/usr/bin/env node
/**
 * validate-context.mjs
 * Validates ai-context/tasks.json against the Antigravity Agent OS schema.
 * Usage: node validate-context.mjs [path/to/tasks.json]
 *
 * Exit codes:
 *   0 — validation passed (warnings may exist)
 *   1 — validation failed (schema errors found)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Schema Constants ────────────────────────────────────────────────────────

const VALID_STATUSES = new Set([
  "pending",
  "ready",
  "in_progress",
  "blocked",
  "review",
  "done",
  "archived",
]);

const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

const REQUIRED_FIELDS = [
  "id",
  "title",
  "status",
  "priority",
  "owner",
  "last_updated_by",
  "next_action",
  "notes",
  "updated_at",
];

const TASK_ID_PATTERN = /^[A-Z]+-\d{3,}$/;
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isIso8601(value) {
  return typeof value === "string" && ISO_8601_PATTERN.test(value);
}

function isOlderThan(isoString, hours) {
  const date = new Date(isoString);
  const now = new Date();
  return (now - date) / 1000 / 3600 > hours;
}

function isFuture(isoString) {
  return new Date(isoString) > new Date();
}

// ─── Validation Logic ─────────────────────────────────────────────────────────

function validateTask(task, index) {
  const errors = [];
  const warnings = [];
  const taskRef = task.id ? `Task "${task.id}"` : `Task at index ${index}`;

  // Required field presence
  for (const field of REQUIRED_FIELDS) {
    if (task[field] === undefined || task[field] === null) {
      errors.push(`${taskRef}: Missing required field "${field}"`);
    }
  }

  // id format
  if (task.id !== undefined) {
    if (typeof task.id !== "string" || !TASK_ID_PATTERN.test(task.id)) {
      errors.push(
        `${taskRef}: "id" must match pattern AREA-NNN (e.g., CRM-001). Got: "${task.id}"`
      );
    }
  }

  // title non-empty
  if (task.title !== undefined && typeof task.title === "string") {
    if (task.title.trim() === "") {
      errors.push(`${taskRef}: "title" must not be empty`);
    }
  } else if (task.title !== undefined) {
    errors.push(`${taskRef}: "title" must be a string`);
  }

  // status
  if (task.status !== undefined) {
    if (!VALID_STATUSES.has(task.status)) {
      errors.push(
        `${taskRef}: "status" must be one of [${[...VALID_STATUSES].join(", ")}]. Got: "${task.status}"`
      );
    }
  }

  // priority
  if (task.priority !== undefined) {
    if (!VALID_PRIORITIES.has(task.priority)) {
      errors.push(
        `${taskRef}: "priority" must be one of [${[...VALID_PRIORITIES].join(", ")}]. Got: "${task.priority}"`
      );
    }
  }

  // owner non-empty
  if (task.owner !== undefined) {
    if (typeof task.owner !== "string" || task.owner.trim() === "") {
      errors.push(`${taskRef}: "owner" must be a non-empty string`);
    }
  }

  // last_updated_by non-empty
  if (task.last_updated_by !== undefined) {
    if (
      typeof task.last_updated_by !== "string" ||
      task.last_updated_by.trim() === ""
    ) {
      errors.push(`${taskRef}: "last_updated_by" must be a non-empty string`);
    }
  }

  // next_action non-empty
  if (task.next_action !== undefined) {
    if (
      typeof task.next_action !== "string" ||
      task.next_action.trim() === ""
    ) {
      errors.push(`${taskRef}: "next_action" must be a non-empty string`);
    }
  }

  // notes must be a string (may be empty)
  if (task.notes !== undefined && typeof task.notes !== "string") {
    errors.push(`${taskRef}: "notes" must be a string`);
  }

  // updated_at ISO 8601
  if (task.updated_at !== undefined) {
    if (!isIso8601(task.updated_at)) {
      errors.push(
        `${taskRef}: "updated_at" must be a valid ISO 8601 datetime string. Got: "${task.updated_at}"`
      );
    } else {
      if (isFuture(task.updated_at)) {
        warnings.push(
          `${taskRef}: "updated_at" is in the future — possible clock skew`
        );
      }
      if (task.status === "in_progress" && isOlderThan(task.updated_at, 24)) {
        warnings.push(
          `${taskRef}: Status is "in_progress" but "updated_at" is older than 24 hours — may be stale`
        );
      }
    }
  }

  // Contextual warnings
  if (task.status === "blocked" && !task.notes) {
    warnings.push(
      `${taskRef}: Status is "blocked" but "notes" is empty — document the blocker`
    );
  }

  if (task.status === "review" && task.notes && !task.notes.includes("reviewer")) {
    warnings.push(
      `${taskRef}: Status is "review" but no reviewer is mentioned in "notes"`
    );
  }

  if (!task.area) {
    warnings.push(`${taskRef}: Optional field "area" is missing (recommended)`);
  }

  if (!task.files || !Array.isArray(task.files) || task.files.length === 0) {
    warnings.push(
      `${taskRef}: Optional field "files" is missing or empty (recommended)`
    );
  }

  return { errors, warnings };
}

function validateTasksJson(filePath) {
  const resolvedPath = resolve(filePath);
  let raw;

  try {
    raw = readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    console.error(`ERROR: Cannot read file "${resolvedPath}": ${err.message}`);
    process.exit(1);
  }

  let tasks;
  try {
    tasks = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: tasks.json is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(tasks)) {
    console.error("ERROR: tasks.json must be a JSON array of task objects");
    process.exit(1);
  }

  const allErrors = [];
  const allWarnings = [];
  const seenIds = new Map();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const { errors, warnings } = validateTask(task, i);
    allErrors.push(...errors);
    allWarnings.push(...warnings);

    // Duplicate ID check
    if (task.id) {
      if (seenIds.has(task.id)) {
        allErrors.push(
          `Duplicate task ID "${task.id}" found at index ${i} and index ${seenIds.get(task.id)}`
        );
      } else {
        seenIds.set(task.id, i);
      }
    }
  }

  // ─── Report ──────────────────────────────────────────────────────────────

  console.log(`\nAntigravity Context Validator`);
  console.log(`File: ${resolvedPath}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`─────────────────────────────────────────`);

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log(`✓ All tasks are valid. No errors or warnings.`);
    process.exit(0);
  }

  if (allErrors.length > 0) {
    console.log(`\n✗ ERRORS (${allErrors.length}):`);
    allErrors.forEach((e) => console.log(`  • ${e}`));
  }

  if (allWarnings.length > 0) {
    console.log(`\n⚠ WARNINGS (${allWarnings.length}):`);
    allWarnings.forEach((w) => console.log(`  • ${w}`));
  }

  console.log(`─────────────────────────────────────────`);

  if (allErrors.length > 0) {
    console.log(
      `\nValidation FAILED: ${allErrors.length} error(s), ${allWarnings.length} warning(s).`
    );
    console.log(`Fix all errors before proceeding with context-sync.\n`);
    process.exit(1);
  } else {
    console.log(
      `\nValidation PASSED with ${allWarnings.length} warning(s). Review warnings above.\n`
    );
    process.exit(0);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

const filePath = process.argv[2] || "ai-context/tasks.json";
validateTasksJson(filePath);
