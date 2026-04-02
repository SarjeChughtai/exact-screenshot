#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const SOURCE_AGENT = join(ROOT, ".agent");
const SOURCE_AGENTS = join(ROOT, ".agents");
const SOURCE_AI_CONTEXT = join(ROOT, "ai-context");

const DEFAULT_MODE = "dry-run";
const DEFAULT_ASSET_MODE = "link";

const CSB_PLAN_MAP = [
  {
    id: "EST-001",
    title: "Estimate Workflow Continuity",
    file: "01-estimate-workflow-continuity.md",
    status: "in_progress",
    priority: "critical",
    area: "estimate",
  },
  {
    id: "RFQ-001",
    title: "RFQ Continuity and Estimator Visibility",
    file: "02-rfq-continuity-and-estimator-visibility.md",
    status: "ready",
    priority: "high",
    area: "rfq",
  },
  {
    id: "DEAL-001",
    title: "Production and Deal Lifecycle Integrity",
    file: "03-production-and-deal-lifecycle-integrity.md",
    status: "ready",
    priority: "high",
    area: "deal",
  },
  {
    id: "OPS-001",
    title: "Operations Workspace and Import Reliability",
    file: "04-operations-workspace-and-import-reliability.md",
    status: "ready",
    priority: "high",
    area: "operations",
  },
  {
    id: "OPP-001",
    title: "Opportunity and Post-Sale Pipeline Foundation",
    file: "05-opportunity-and-post-sale-pipeline-foundation.md",
    status: "pending",
    priority: "medium",
    area: "opportunity",
  },
];

function ensureDir(dir, applyMode) {
  if (applyMode && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function writeText(filePath, content, applyMode, actions) {
  actions.push(`write ${relative(ROOT, filePath)}`);
  if (!applyMode) return;
  ensureDir(dirname(filePath), true);
  writeFileSync(filePath, content, "utf8");
}

function writeJson(filePath, value, applyMode, actions) {
  writeText(filePath, JSON.stringify(value, null, 2) + "\n", applyMode, actions);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function extractSection(text, heading) {
  const match = text.match(new RegExp(`##\\s+${heading}\\n([\\s\\S]*?)(?=\\n##\\s+|$)`));
  return match ? match[1].trim() : "";
}

function extractBullets(section) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").replace(/`/g, "").trim());
}

function extractFocusBullets(currentState) {
  const section = extractSection(currentState, "Active Delivery Track");
  const lines = section.split("\n");
  const bullets = [];
  let inFocus = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("- Execution is currently focused")) {
      inFocus = true;
      continue;
    }

    if (line.startsWith("- Completed in the current delivery pass")) {
      break;
    }

    if (inFocus && line.startsWith("- ")) {
      bullets.push(line.replace(/^- /, "").trim());
    }
  }

  return bullets;
}

function extractTechStack(claudeText, currentStateText) {
  const techLines = [
    ...extractBullets(extractSection(currentStateText, "Technology Stack")),
    ...extractBullets(extractSection(claudeText, "Tech Stack")),
  ];
  const seen = new Set();

  return techLines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePlanFile(filePath) {
  const raw = sanitizeText(readText(filePath));
  return {
    title: raw.match(/^#\s+(.+)$/m)?.[1].trim() || filePath,
    business_problem: extractBullets(extractSection(raw, "Business problem")),
    target_behavior: extractBullets(extractSection(raw, "Target behavior")),
    files: extractBullets(extractSection(raw, "Files and impact")),
    tests_needed: extractBullets(extractSection(raw, "Tests needed")),
    risk: extractBullets(extractSection(raw, "Risk")),
  };
}

function parseLegacyDecisions(decisionLogText) {
  const raw = sanitizeText(decisionLogText);
  const blocks = raw.split(/\n(?=###\s+)/).filter((block) => block.trim().startsWith("### "));

  return blocks.map((block) => {
    const lines = block.trim().split("\n");
    const heading = lines[0].replace(/^###\s+/, "").trim();
    const headingParts = heading.split(": ");
    const dateLabel = headingParts.length > 1 ? headingParts.shift() : null;
    const title = headingParts.length > 0 ? headingParts.join(": ") : heading;
    const body = lines.slice(1).join("\n").trim();
    const context = body.match(/\*\*Context\*\*:\s*([\s\S]*?)(?=\n\*\*Decisions\*\*|\n\*\*[A-Z]|$)/)?.[1].trim()
      || "Imported from docs/ai_context/decision_log.md";
    const decisionBlock = body.match(/\*\*Decisions\*\*:\s*([\s\S]*)/)?.[1].trim() || body;
    const isoDate = dateLabel && !Number.isNaN(new Date(dateLabel).getTime())
      ? new Date(dateLabel).toISOString()
      : new Date().toISOString();

    return {
      title,
      slug: slugify(title),
      created_at: isoDate,
      context,
      decision: decisionBlock || "Imported from legacy decision log.",
    };
  });
}

function parseLatestSession(sessionLogText) {
  const raw = sanitizeText(sessionLogText);
  const matches = [...raw.matchAll(/### Session:\s+(.+)\n([\s\S]*?)(?=\n### Session:|$)/g)];
  if (matches.length === 0) return null;

  const [_, title, body] = matches[0];
  const objective = body.match(/\*\*Objective\*\*:\s*(.+)$/m)?.[1].trim() || "Imported legacy session context.";
  const highlights = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .slice(0, 10)
    .map((line) => line.replace(/^- /, "").trim());

  return {
    title: title.trim(),
    objective,
    highlights,
  };
}

function buildProjectMd({ repoName, claudeText, currentStateText, focusBullets, techStack }) {
  const overview = sanitizeText(
    claudeText.match(/## Project Overview\n([\s\S]*?)(?=\n## )/)?.[1].trim()
      || "Internal steel building sales management platform."
  );

  return [
    "# Project Overview",
    "",
    "## Name",
    repoName,
    "",
    "## Goal",
    overview,
    "",
    "## Primary Stack",
    ...techStack.map((item) => `- ${item}`),
    "- Code workspace: Antigravity master pack bridge mode",
    "- Canonical coordination state: ai-context/",
    "- Legacy context retained in docs/ai_context/",
    "",
    "## Current Focus",
    ...focusBullets.slice(0, 3).map((item) => `- ${item}`),
    "",
    "## Operating Rules",
    "1. Read `ai-context/project.md`, `tasks.json`, `dashboard.md`, `handoffs/active.md`, and `agents.md` before starting work.",
    "2. Keep `ai-context/` as the forward-looking coordination layer; do not overwrite `docs/ai_context/`.",
    "3. Treat `docs/ai_context/` and `antigravity-god-mode/` as preserved legacy references unless a migration task explicitly says otherwise.",
    "4. Update `tasks.json`, the daily log, and the active handoff whenever work materially changes state.",
    "5. Record durable architectural decisions in `ai-context/decisions/`.",
    "",
    "## Legacy Sources",
    "- `CLAUDE.md`",
    "- `docs/ai_context/current_state.md`",
    "- `docs/ai_context/decision_log.md`",
    "- `docs/ai_context/session_logs.md`",
    "",
  ].join("\n");
}

function buildDashboardMd({ importedTrack, bootstrapDate }) {
  return [
    "# Agent Dashboard",
    "",
    "> Agents: Read this first. Update this last.",
    "> This file is the ground truth for the current state of work.",
    "",
    "---",
    "",
    "## Current Priority",
    "",
    "- [ ] EST-001 - Estimate Workflow Continuity",
    "- [ ] RFQ-001 - RFQ Continuity and Estimator Visibility",
    "- [ ] DEAL-001 - Production and Deal Lifecycle Integrity",
    "",
    "---",
    "",
    "## Current State",
    "",
    "| Field | Value |",
    "|---|---|",
    "| **Current Agent** | unassigned |",
    "| **Current Task ID** | EST-001 |",
    "| **Current Branch** | main |",
    "| **Last Completed Step** | Bootstrapped bridge-mode ai-context from legacy CSB sources |",
    "| **Next Action** | Continue EST-001 against `docs/plans/01-estimate-workflow-continuity.md` and verify estimate edit/import/state persistence |",
    "| **Current Blockers** | None |",
    "",
    "---",
    "",
    "## Imported Delivery Track",
    "",
    ...importedTrack.map((item) => `- ${item}`),
    "",
    "---",
    "",
    "## Files To Watch",
    "",
    "| File | Why |",
    "|---|---|",
    "| `ai-context/tasks.json` | Canonical task list for bridge-mode coordination |",
    "| `ai-context/handoffs/active.md` | Exact next-step handoff between agents |",
    "| `docs/plans/01-estimate-workflow-continuity.md` | Current active execution track |",
    "| `docs/ai_context/current_state.md` | Legacy state reference during transition |",
    "",
    "---",
    "",
    "## Recent Activity",
    "",
    "| Date | Agent | Task ID | Summary |",
    "|---|---|---|---|",
    `| ${bootstrapDate} | repo-bootstrap | EST-001 | Created ai-context bridge, seeded tasks, imported decisions, and preserved legacy docs |`,
    "",
  ].join("\n");
}

function buildAgentsMd() {
  const personas = [
    "orchestrator",
    "project-planner",
    "frontend-specialist",
    "backend-specialist",
    "database-architect",
    "debugger",
    "qa-automation-engineer",
    "documentation-writer",
    "security-auditor",
    "performance-optimizer",
  ];

  return [
    "# Agent Roles and Rules",
    "",
    "This project uses the Antigravity master pack as shared agent infrastructure.",
    "",
    "## Shared Rules",
    "1. Read the full `ai-context/` bundle before starting work.",
    "2. Keep bridge-mode coordination in `ai-context/`; keep `docs/ai_context/` intact as legacy reference.",
    "3. Update structured state before ending a session: task, log, dashboard, and handoff.",
    "4. Escalate blockers explicitly instead of leaving silent partial work.",
    "",
    "## Curated Personas",
    ...personas.map((persona) => `- \`.agent/agents/${persona}.md\``),
    "",
    "## Shared Skills",
    "- Use the linked `.agent/skills/` catalog as the default skill surface for planning, implementation, review, debugging, deployment, and repo coordination.",
    "- Treat Notion automation and Supabase automation as optional adapters, not canonical memory stores.",
    "",
    "## Bridge-Mode Notes",
    "- `ai-context/` is the forward-looking agent operating surface.",
    "- `docs/ai_context/` remains the preserved historical record from the pre-master-pack workflow.",
    "- `antigravity-god-mode/` remains untouched and available for reference when specialized prompts are needed.",
    "",
  ].join("\n");
}

function buildTasksJson(planDir) {
  const now = new Date().toISOString();
  const tasks = CSB_PLAN_MAP.map((taskConfig) => {
    const planPath = join(planDir, taskConfig.file);
    const plan = parsePlanFile(planPath);
    const nextAction = plan.target_behavior[0]
      ? `Validate and continue: ${plan.target_behavior[0]}`
      : `Review docs/plans/${taskConfig.file} and continue implementation.`;
    const notes = [
      `Imported from docs/plans/${taskConfig.file}.`,
      "",
      "Business problem:",
      ...(plan.business_problem.length > 0 ? plan.business_problem.map((item) => `- ${item}`) : ["- See source plan file."]),
      "",
      "Target behavior:",
      ...(plan.target_behavior.length > 0 ? plan.target_behavior.map((item) => `- ${item}`) : ["- See source plan file."]),
      "",
      "Tests needed:",
      ...(plan.tests_needed.length > 0 ? plan.tests_needed.map((item) => `- ${item}`) : ["- See source plan file."]),
      "",
      "Risk:",
      ...(plan.risk.length > 0 ? plan.risk.map((item) => `- ${item}`) : ["- Not specified."]),
    ].join("\n");

    return {
      id: taskConfig.id,
      title: taskConfig.title,
      status: taskConfig.status,
      priority: taskConfig.priority,
      owner: "unassigned",
      last_updated_by: "repo-bootstrap",
      next_action: nextAction,
      notes,
      area: taskConfig.area,
      files: [
        `docs/plans/${taskConfig.file}`,
        ...plan.files,
      ],
      updated_at: now,
      created_at: now,
    };
  });

  return {
    meta: {
      version: 2,
      last_updated: now,
      description: "CSB Portal bridge-mode task registry seeded from legacy docs/plans.",
    },
    tasks,
  };
}

function buildHandoffMd() {
  return [
    "---",
    "from: repo-bootstrap",
    "to: next available agent",
    "task_id: EST-001",
    "status: open",
    `created_at: ${new Date().toISOString()}`,
    "---",
    "",
    "# Handoff: repo-bootstrap -> next available agent",
    "",
    "## Completed",
    "- Linked or copied shared `.agent` and `.agents` assets from the Antigravity master repo.",
    "- Created bridge-mode `ai-context/` files seeded from `CLAUDE.md`, `docs/ai_context/current_state.md`, `docs/ai_context/decision_log.md`, and `docs/ai_context/session_logs.md`.",
    "- Seeded canonical `tasks.json` from `docs/plans/01..05` without modifying legacy AI files.",
    "",
    "## Blockers",
    "None",
    "",
    "## Exact Next Step",
    "Continue `EST-001` by validating estimate edit/import/state persistence against `docs/plans/01-estimate-workflow-continuity.md` and current repo behavior.",
    "",
    "## Files Touched",
    "- .agent",
    "- .agents",
    "- ai-context/project.md",
    "- ai-context/dashboard.md",
    "- ai-context/agents.md",
    "- ai-context/tasks.json",
    "- ai-context/handoffs/active.md",
    "- ai-context/logs/",
    "- ai-context/decisions/",
    "",
  ].join("\n");
}

function buildImportedLog(latestSession) {
  const lines = [
    `# Agent Log - ${new Date().toISOString().slice(0, 10)}`,
    "",
    "---",
    "",
    `## [${new Date().toISOString()}] repo-bootstrap`,
    "",
    "**Summary:** Imported bridge-mode ai-context from legacy CSB documents and seeded canonical tasks from docs/plans/01..05.",
    "**Task:** EST-001",
    "**Files Changed:** ai-context/project.md, ai-context/dashboard.md, ai-context/tasks.json, ai-context/decisions/*.md, ai-context/handoffs/active.md",
    "**Blockers:** None",
    "**Next Step:** Continue EST-001 against docs/plans/01-estimate-workflow-continuity.md.",
    "",
  ];

  if (latestSession) {
    lines.push("### Imported Legacy Session");
    lines.push(`- Title: ${latestSession.title}`);
    lines.push(`- Objective: ${latestSession.objective}`);
    if (latestSession.highlights.length > 0) {
      lines.push("- Highlights:");
      for (const item of latestSession.highlights) {
        lines.push(`  - ${item}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function copyDirectory(sourceDir, destinationDir, applyMode, actions) {
  actions.push(`copy ${relative(ROOT, sourceDir)} -> ${destinationDir}`);
  if (!applyMode) return;
  cpSync(sourceDir, destinationDir, { recursive: true, force: true });
}

function linkOrCopySharedAsset(sourceDir, destinationDir, assetMode, applyMode, actions) {
  if (existsSync(destinationDir)) {
    const stats = lstatSync(destinationDir);
    if (stats.isSymbolicLink()) {
      actions.push(`skip existing link ${destinationDir}`);
      return;
    }

    throw new Error(`Target already has ${destinationDir}. Refusing to overwrite existing shared asset.`);
  }

  actions.push(`${assetMode} ${relative(ROOT, sourceDir)} -> ${destinationDir}`);
  if (!applyMode) return;

  if (assetMode === "copy") {
    cpSync(sourceDir, destinationDir, { recursive: true, force: true });
    return;
  }

  symlinkSync(sourceDir, destinationDir, "junction");
}

function bootstrapLegacyCsb(targetRoot, applyMode, assetMode) {
  const actions = [];
  const targetAiContext = join(targetRoot, "ai-context");
  const targetDocs = join(targetRoot, "docs", "ai_context");
  const targetPlans = join(targetRoot, "docs", "plans");
  const bootstrapDate = new Date().toISOString().slice(0, 10);

  const claudeText = sanitizeText(readText(join(targetRoot, "CLAUDE.md")));
  const currentStateText = sanitizeText(readText(join(targetDocs, "current_state.md")));
  const decisionLogText = readText(join(targetDocs, "decision_log.md"));
  const sessionLogText = readText(join(targetDocs, "session_logs.md"));
  const repoName = sanitizeText(
    readText(join(targetRoot, "README.md")).match(/^#\s+(.+)$/m)?.[1]?.trim()
      || "CSB Portal"
  );

  const focusBullets = extractFocusBullets(currentStateText);
  const techStack = extractTechStack(claudeText, currentStateText);
  const tasksPayload = buildTasksJson(targetPlans);
  const latestSession = parseLatestSession(sessionLogText);
  const importedDecisions = parseLegacyDecisions(decisionLogText);

  linkOrCopySharedAsset(SOURCE_AGENT, join(targetRoot, ".agent"), assetMode, applyMode, actions);
  linkOrCopySharedAsset(SOURCE_AGENTS, join(targetRoot, ".agents"), assetMode, applyMode, actions);

  ensureDir(targetAiContext, applyMode);
  ensureDir(join(targetAiContext, "handoffs", "archive"), applyMode);
  ensureDir(join(targetAiContext, "logs"), applyMode);
  ensureDir(join(targetAiContext, "decisions"), applyMode);

  copyDirectory(join(SOURCE_AI_CONTEXT, "templates"), join(targetAiContext, "templates"), applyMode, actions);
  copyDirectory(join(SOURCE_AI_CONTEXT, "runbooks"), join(targetAiContext, "runbooks"), applyMode, actions);

  writeText(
    join(targetAiContext, "project.md"),
    buildProjectMd({ repoName, claudeText, currentStateText, focusBullets, techStack }),
    applyMode,
    actions
  );
  writeText(
    join(targetAiContext, "dashboard.md"),
    buildDashboardMd({
      importedTrack: focusBullets.length > 0 ? focusBullets : ["See docs/ai_context/current_state.md"],
      bootstrapDate,
    }),
    applyMode,
    actions
  );
  writeText(join(targetAiContext, "agents.md"), buildAgentsMd(), applyMode, actions);
  writeJson(join(targetAiContext, "tasks.json"), tasksPayload, applyMode, actions);
  writeText(join(targetAiContext, "handoffs", "active.md"), buildHandoffMd(), applyMode, actions);
  writeText(
    join(targetAiContext, "logs", `${bootstrapDate}.md`),
    buildImportedLog(latestSession),
    applyMode,
    actions
  );
  writeText(
    join(targetAiContext, "decisions", "README.md"),
    readText(join(SOURCE_AI_CONTEXT, "decisions", "README.md")),
    applyMode,
    actions
  );

  for (const decision of importedDecisions) {
    const fileName = `${decision.created_at.slice(0, 10)}-${decision.slug}.md`;
    const content = [
      "---",
      `title: ${decision.title}`,
      "status: accepted",
      "decided_by: imported-legacy-log",
      `created_at: ${decision.created_at}`,
      "---",
      "",
      `# Decision: ${decision.title}`,
      "",
      "## Context",
      decision.context,
      "",
      "## Decision",
      decision.decision,
      "",
      "## Consequences",
      "Imported from docs/ai_context/decision_log.md during master-pack bridge bootstrap.",
      "",
    ].join("\n");
    writeText(join(targetAiContext, "decisions", fileName), content, applyMode, actions);
  }

  return actions;
}

function bootstrapGeneric(targetRoot, applyMode, assetMode) {
  const actions = [];
  const targetAiContext = join(targetRoot, "ai-context");
  const now = new Date().toISOString();

  linkOrCopySharedAsset(SOURCE_AGENT, join(targetRoot, ".agent"), assetMode, applyMode, actions);
  linkOrCopySharedAsset(SOURCE_AGENTS, join(targetRoot, ".agents"), assetMode, applyMode, actions);
  ensureDir(targetAiContext, applyMode);
  ensureDir(join(targetAiContext, "handoffs", "archive"), applyMode);
  ensureDir(join(targetAiContext, "logs"), applyMode);
  ensureDir(join(targetAiContext, "decisions"), applyMode);

  copyDirectory(join(SOURCE_AI_CONTEXT, "templates"), join(targetAiContext, "templates"), applyMode, actions);
  copyDirectory(join(SOURCE_AI_CONTEXT, "runbooks"), join(targetAiContext, "runbooks"), applyMode, actions);
  writeText(join(targetAiContext, "project.md"), "# Project Overview\n\nPopulate this file for the target repository.\n", applyMode, actions);
  writeText(join(targetAiContext, "dashboard.md"), "# Agent Dashboard\n\nPopulate this dashboard for the target repository.\n", applyMode, actions);
  writeText(join(targetAiContext, "agents.md"), buildAgentsMd(), applyMode, actions);
  writeJson(
    join(targetAiContext, "tasks.json"),
    {
      meta: {
        version: 2,
        last_updated: now,
        description: "Generic Antigravity bootstrap task registry.",
      },
      tasks: [],
    },
    applyMode,
    actions
  );
  writeText(join(targetAiContext, "handoffs", "active.md"), buildHandoffMd(), applyMode, actions);
  writeText(
    join(targetAiContext, "decisions", "README.md"),
    readText(join(SOURCE_AI_CONTEXT, "decisions", "README.md")),
    applyMode,
    actions
  );

  return actions;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = options.target;
  const mode = options.mode || DEFAULT_MODE;
  const source = options.source || "generic";
  const assetMode = options.copy ? "copy" : options.link ? "link" : DEFAULT_ASSET_MODE;

  if (!target) {
    throw new Error("Missing required --target argument.");
  }

  if (!["dry-run", "apply"].includes(mode)) {
    throw new Error(`Unsupported --mode "${mode}". Use dry-run or apply.`);
  }

  const targetRoot = isAbsolute(target) ? target : resolve(ROOT, target);
  if (!existsSync(targetRoot)) {
    throw new Error(`Target path does not exist: ${targetRoot}`);
  }

  const applyMode = mode === "apply";
  const actions = source === "legacy-csb"
    ? bootstrapLegacyCsb(targetRoot, applyMode, assetMode)
    : bootstrapGeneric(targetRoot, applyMode, assetMode);

  console.log(`[repo-bootstrap] mode=${mode} assetMode=${assetMode} source=${source}`);
  console.log(`[repo-bootstrap] target=${targetRoot}`);
  for (const action of actions) {
    console.log(`[repo-bootstrap] ${action}`);
  }
  console.log(`[repo-bootstrap] ${applyMode ? "Applied" : "Planned"} ${actions.length} operations`);
}

main();
