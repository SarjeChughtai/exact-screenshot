#!/usr/bin/env node

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const AI_CONTEXT = join(ROOT, "ai-context");
const OBSIDIAN_DIR = join(ROOT, "obsidian");
const GENERATED_DIR = join(OBSIDIAN_DIR, "generated");
const TASKS_DIR = join(GENERATED_DIR, "tasks");
const DECISIONS_DIR = join(GENERATED_DIR, "decisions");
const ACTIVITY_DIR = join(GENERATED_DIR, "activity");
const KANBAN_SCRIPT = join(ROOT, "scripts", "generate-kanban.mjs");

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readText(filePath, fallback = "") {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : fallback;
}

function writeText(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function renderTaskNote(task) {
  const files = Array.isArray(task.files) && task.files.length > 0
    ? task.files.map((file) => `- ${file}`).join("\n")
    : "- None recorded";

  return [
    "---",
    `task_id: ${task.id}`,
    `status: ${task.status}`,
    `priority: ${task.priority}`,
    `owner: ${task.owner}`,
    "source: ai-context/tasks.json",
    "---",
    "",
    `# ${task.id}: ${task.title}`,
    "",
    "## Next Action",
    task.next_action || "_No next action recorded._",
    "",
    "## Notes",
    task.notes || "_No notes recorded._",
    "",
    "## Files",
    files,
    "",
  ].join("\n");
}

function renderActivityNote(date, content) {
  return [
    "---",
    `date: ${date}`,
    `source: ai-context/logs/${date}.md`,
    "---",
    "",
    `# Activity: ${date}`,
    "",
    content.trim(),
    "",
  ].join("\n");
}

function buildIndex(tasks, decisions, activities) {
  const lines = [
    "# Obsidian Bootstrap",
    "",
    "This directory contains derived artifacts for Obsidian. `ai-context/` remains the source of truth.",
    "",
    "## Views",
    "- `../bases/tasks.base` for task browsing",
    "- `../bases/decisions.base` for decision browsing",
    "- `../bases/activity.base` for activity browsing",
    "- `../../ai-context/kanban-board.md` for Kanban view",
    "",
    `Tasks mirrored: ${tasks.length}`,
    `Decisions mirrored: ${decisions.length}`,
    `Activity notes mirrored: ${activities.length}`,
    "",
  ];

  if (tasks.length > 0) {
    lines.push("## Task Notes");
    for (const task of tasks) {
      lines.push(`- [[tasks/${task.id}]]`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Decision Notes");
    for (const decision of decisions) {
      lines.push(`- [[decisions/${decision}]]`);
    }
    lines.push("");
  }

  if (activities.length > 0) {
    lines.push("## Activity Notes");
    for (const activity of activities) {
      lines.push(`- [[activity/${activity}]]`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  ensureDir(TASKS_DIR);
  ensureDir(DECISIONS_DIR);
  ensureDir(ACTIVITY_DIR);

  execFileSync("node", [KANBAN_SCRIPT], {
    cwd: ROOT,
    stdio: "inherit",
  });

  const tasksPayload = readJson(join(AI_CONTEXT, "tasks.json"));
  const tasks = Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks : [];
  for (const task of tasks) {
    writeText(join(TASKS_DIR, `${task.id}.md`), renderTaskNote(task));
  }

  const mirroredDecisions = [];
  const sourceDecisionsDir = join(AI_CONTEXT, "decisions");
  if (existsSync(sourceDecisionsDir)) {
    for (const file of readdirSync(sourceDecisionsDir).filter((entry) => entry.endsWith(".md") && entry !== "README.md")) {
      mirroredDecisions.push(file.replace(/\.md$/, ""));
      writeText(join(DECISIONS_DIR, file), readText(join(sourceDecisionsDir, file)));
    }
  }

  const mirroredActivities = [];
  const sourceLogsDir = join(AI_CONTEXT, "logs");
  if (existsSync(sourceLogsDir)) {
    for (const file of readdirSync(sourceLogsDir).filter((entry) => /^\d{4}-\d{2}-\d{2}\.md$/.test(entry))) {
      const date = file.replace(/\.md$/, "");
      mirroredActivities.push(date);
      writeText(join(ACTIVITY_DIR, file), renderActivityNote(date, readText(join(sourceLogsDir, file))));
    }
  }

  writeText(
    join(GENERATED_DIR, "index.md"),
    buildIndex(tasks, mirroredDecisions, mirroredActivities)
  );

  console.log(
    `[obsidian-bootstrap] Generated Kanban plus ${tasks.length} task notes, ${mirroredDecisions.length} decision notes, and ${mirroredActivities.length} activity notes`
  );
}

main();
