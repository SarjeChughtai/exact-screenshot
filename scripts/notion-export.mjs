#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const AI_CONTEXT = join(ROOT, "ai-context");
const EXPORT_DIR = join(ROOT, "notion", "export");

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readText(filePath, fallback = "") {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : fallback;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeText(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + "\n");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (field) {
      frontmatter[field[1]] = field[2].trim();
    }
  }
  return frontmatter;
}

function readDecisionExports() {
  const decisionsDir = join(AI_CONTEXT, "decisions");
  if (!existsSync(decisionsDir)) return [];

  return readdirSync(decisionsDir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort()
    .map((file) => {
      const fullPath = join(decisionsDir, file);
      const content = readText(fullPath);
      const frontmatter = parseFrontmatter(content);
      const titleMatch = content.match(/^# Decision:\s+(.+)$/m);
      const contextMatch = content.match(/## Context\n([\s\S]*?)(?=\n## |\n?$)/);
      const decisionMatch = content.match(/## Decision\n([\s\S]*?)(?=\n## |\n?$)/);
      const consequencesMatch = content.match(/## Consequences\n([\s\S]*?)(?=\n## |\n?$)/);

      return {
        file,
        title: frontmatter.title || (titleMatch ? titleMatch[1].trim() : file),
        status: frontmatter.status || "accepted",
        decided_by: frontmatter.decided_by || "unknown",
        created_at: frontmatter.created_at || null,
        context: contextMatch ? contextMatch[1].trim() : "",
        decision: decisionMatch ? decisionMatch[1].trim() : "",
        consequences: consequencesMatch ? consequencesMatch[1].trim() : "",
        source: "ai-context/decisions/" + file,
      };
    });
}

function buildTaskMarkdown(tasks) {
  const lines = [
    "# Tasks Export",
    "",
    "| ID | Title | Status | Priority | Owner | Next Action |",
    "|---|---|---|---|---|---|",
  ];

  for (const task of tasks) {
    lines.push(
      `| ${escapeCell(task.id)} | ${escapeCell(task.title)} | ${escapeCell(task.status)} | ${escapeCell(task.priority)} | ${escapeCell(task.owner)} | ${escapeCell(task.next_action)} |`
    );
  }

  if (tasks.length === 0) {
    lines.push("| - | No tasks exported | - | - | - | - |");
  }

  return lines.join("\n") + "\n";
}

function buildDecisionsMarkdown(decisions) {
  const lines = [
    "# Decisions Export",
    "",
    `Total decisions: ${decisions.length}`,
    "",
  ];

  for (const decision of decisions) {
    lines.push(`## ${decision.title}`);
    lines.push("");
    lines.push(`- Status: ${decision.status}`);
    lines.push(`- Decided By: ${decision.decided_by}`);
    lines.push(`- Created At: ${decision.created_at || "unknown"}`);
    lines.push(`- Source: ${decision.source}`);
    lines.push("");
    lines.push("### Context");
    lines.push(decision.context || "_No context recorded._");
    lines.push("");
    lines.push("### Decision");
    lines.push(decision.decision || "_No decision body recorded._");
    lines.push("");
    lines.push("### Consequences");
    lines.push(decision.consequences || "_No consequences recorded._");
    lines.push("");
  }

  if (decisions.length === 0) {
    lines.push("_No decision files found._");
    lines.push("");
  }

  return lines.join("\n");
}

function summarizeTasks(tasks) {
  const summary = {
    total: tasks.length,
    by_status: {},
    by_priority: {},
  };

  for (const task of tasks) {
    summary.by_status[task.status] = (summary.by_status[task.status] || 0) + 1;
    summary.by_priority[task.priority] = (summary.by_priority[task.priority] || 0) + 1;
  }

  return summary;
}

function main() {
  ensureDir(EXPORT_DIR);

  const generatedAt = new Date().toISOString();
  const tasksPayload = readJson(join(AI_CONTEXT, "tasks.json"));
  const tasks = Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks : [];
  const dashboard = readText(join(AI_CONTEXT, "dashboard.md"), "# Dashboard\n\n_No dashboard found._\n");
  const handoff = readText(join(AI_CONTEXT, "handoffs", "active.md"), "# Active Handoff\n\n_No active handoff found._\n");
  const decisions = readDecisionExports();

  const summary = summarizeTasks(tasks);
  const manifest = {
    generated_at: generatedAt,
    export_mode: "local-derived-only",
    source_of_truth: "ai-context",
    outputs: [
      "index.md",
      "tasks.md",
      "tasks-database.json",
      "dashboard.md",
      "handoff.md",
      "decisions.md",
      "decisions.json",
      "manifest.json",
    ],
    adapters: {
      notion_automation_skill: ".agent/skills/notion-automation",
      notion_connection_required: false,
      mcp_behavior: "optional",
    },
  };

  writeJson(join(EXPORT_DIR, "manifest.json"), manifest);
  writeText(
    join(EXPORT_DIR, "index.md"),
    [
      "# Notion Export Bundle",
      "",
      `Generated: ${generatedAt}`,
      "",
      "This directory contains derived exports only. `ai-context/` remains the canonical source of truth.",
      "",
      "## Files",
      "- `tasks.md` and `tasks-database.json`: task import surfaces",
      "- `dashboard.md`: current dashboard snapshot",
      "- `handoff.md`: current active handoff snapshot",
      "- `decisions.md` and `decisions.json`: decision import surfaces",
      "- `manifest.json`: export metadata",
      "",
      "## Adapter Mode",
      "- Notion automation is optional via `.agent/skills/notion-automation`.",
      "- This export succeeds without any Notion or MCP connection.",
      "",
    ].join("\n")
  );
  writeText(join(EXPORT_DIR, "tasks.md"), buildTaskMarkdown(tasks));
  writeJson(
    join(EXPORT_DIR, "tasks-database.json"),
    {
      generated_at: generatedAt,
      meta: tasksPayload.meta,
      summary,
      tasks,
    }
  );
  writeText(join(EXPORT_DIR, "dashboard.md"), dashboard.endsWith("\n") ? dashboard : dashboard + "\n");
  writeText(join(EXPORT_DIR, "handoff.md"), handoff.endsWith("\n") ? handoff : handoff + "\n");
  writeText(join(EXPORT_DIR, "decisions.md"), buildDecisionsMarkdown(decisions));
  writeJson(
    join(EXPORT_DIR, "decisions.json"),
    {
      generated_at: generatedAt,
      count: decisions.length,
      decisions,
    }
  );

  console.log(
    `[notion-export] Wrote ${manifest.outputs.length} derived files to ${EXPORT_DIR}`
  );
  console.log(
    `[notion-export] Exported ${tasks.length} tasks and ${decisions.length} decisions without requiring a Notion connection`
  );
}

main();
