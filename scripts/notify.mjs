#!/usr/bin/env node
/**
 * notify.mjs
 * Antigravity Agent OS — Notification Webhook Dispatcher
 *
 * Reads ai-context/webhooks.json and fires matching webhooks for a given event.
 * Webhooks are fire-and-forget. Failures are logged but never thrown.
 *
 * Usage:
 *   node scripts/notify.mjs --event EVENT --agent AGENT --data '{"key":"value"}'
 *   node scripts/notify.mjs test --hook-id HOOK_ID
 *
 * Importable API (for integration with update-context.mjs):
 *   import { fireEvent, fireEventSync } from "./notify.mjs";
 *
 * Exit codes:
 *   0 — always (webhook failures do not cause non-zero exit)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Path Resolution ──────────────────────────────────────────────────────────

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, "..", "..", "..", "..");
}

const ROOT = findRoot(__dirname);
const AI_CTX = join(ROOT, "ai-context");
const WEBHOOKS_FILE = join(AI_CTX, "webhooks.json");

// ─── Utilities ────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[notify] ${msg}`);
}

function warn(msg) {
  console.warn(`[notify] WARN: ${msg}`);
}

function die(msg) {
  console.error(`\n[notify] ERROR: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = argv[i + 1];
      const value = next && !next.startsWith("--") ? (i++, next) : true;
      options[key] = value;
    } else {
      positional.push(argv[i]);
    }
    i++;
  }
  return { positional, options };
}

// ─── Webhook Config ───────────────────────────────────────────────────────────

/**
 * Load and validate webhooks.json. Returns null if the file does not exist.
 * Throws on parse error so the caller can decide how to handle it.
 */
function loadWebhooks() {
  if (!existsSync(WEBHOOKS_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(WEBHOOKS_FILE, "utf-8");
    const config = JSON.parse(raw);
    if (!Array.isArray(config.hooks)) {
      warn(`webhooks.json does not have a "hooks" array — skipping notifications`);
      return null;
    }
    return config;
  } catch (err) {
    warn(`webhooks.json is not valid JSON: ${err.message} — skipping notifications`);
    return null;
  }
}

/**
 * Filter hooks matching the given event type, respecting enabled flag.
 */
function matchingHooks(hooks, eventType) {
  return hooks.filter(
    (hook) =>
      hook.enabled === true &&
      Array.isArray(hook.events) &&
      hook.events.includes(eventType)
  );
}

// ─── Payload Builders ─────────────────────────────────────────────────────────

/**
 * The event-to-header mapping for Slack Block Kit format.
 */
const SLACK_HEADERS = {
  "task.created":       "📋 New Task Created",
  "task.status_changed":"🔄 Task Updated",
  "task.done":          "✅ Task Completed",
  "task.blocked":       "🚫 Task Blocked",
  "handoff.created":    "🤝 Handoff Created",
  "session.started":    "🚀 Session Started",
  "session.ended":      "🏁 Session Ended",
  "conflict.detected":  "⚠️ Conflict Detected",
  "decision.recorded":  "📝 Decision Recorded",
  "rollback.performed": "⏪ Rollback Performed",
};

/**
 * Build the standard JSON payload.
 */
function buildJsonPayload(eventType, agent, data, project, repo) {
  return {
    event: eventType,
    timestamp: nowISO(),
    agent,
    data: data || {},
    project: project || "unknown",
    repo: repo || "unknown",
  };
}

/**
 * Build a Slack Block Kit payload from the standard payload.
 */
function buildSlackPayload(eventType, agent, data) {
  const headerText = SLACK_HEADERS[eventType] || `🔔 ${eventType}`;
  const d = data || {};

  // Build section fields — include only fields that exist
  const fields = [];

  if (d.task_id) {
    fields.push({ type: "mrkdwn", text: `*Task:* ${d.task_id}` });
  }
  if (agent) {
    fields.push({ type: "mrkdwn", text: `*Agent:* ${capitalize(agent)}` });
  }
  if (d.from_agent) {
    fields.push({ type: "mrkdwn", text: `*From:* ${capitalize(d.from_agent)}` });
  }
  if (d.to_agent) {
    fields.push({ type: "mrkdwn", text: `*To:* ${capitalize(d.to_agent)}` });
  }
  if (d.title) {
    fields.push({ type: "mrkdwn", text: `*Title:* ${d.title}` });
  }
  if (d.new_status) {
    fields.push({ type: "mrkdwn", text: `*Status:* ${d.new_status}` });
  } else if (d.status) {
    fields.push({ type: "mrkdwn", text: `*Status:* ${d.status}` });
  }
  if (d.summary) {
    fields.push({ type: "mrkdwn", text: `*Summary:* ${d.summary}` });
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: headerText },
    },
  ];

  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }

  // Context footer
  const contextParts = [];
  if (d.project) contextParts.push(`Project: ${d.project}`);
  contextParts.push(nowISO());

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: contextParts.join(" | "),
      },
    ],
  });

  return { blocks };
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── HTTP Dispatch ────────────────────────────────────────────────────────────

/**
 * Fire a single webhook. Returns a result object — never throws.
 * Uses the global fetch available in Node.js ≥ 18.
 */
async function fireWebhook(hook, payload) {
  const startMs = Date.now();
  const body = JSON.stringify(payload);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const durationMs = Date.now() - startMs;
    const statusText = `${response.status} ${response.statusText}`;

    if (response.ok) {
      log(`fired ${hook.id} for ${payload.event || "test"} (${statusText}, ${durationMs}ms)`);
      return { hookId: hook.id, success: true, status: response.status, durationMs };
    } else {
      const body = await response.text().catch(() => "");
      warn(`FAILED ${hook.id}: HTTP ${statusText}${body ? ` — ${body.slice(0, 120)}` : ""}`);
      return { hookId: hook.id, success: false, status: response.status, error: statusText, durationMs };
    }
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errMsg = err.name === "AbortError" ? "timeout (8s)" : err.message;
    warn(`FAILED ${hook.id}: ${errMsg}`);
    return { hookId: hook.id, success: false, error: errMsg, durationMs };
  }
}

/**
 * Build the correct payload for a hook based on its format setting.
 */
function buildPayloadForHook(hook, eventType, agent, data, project, repo) {
  if (hook.format === "slack") {
    return buildSlackPayload(eventType, agent, { ...data, project });
  }
  return buildJsonPayload(eventType, agent, data, project, repo);
}

// ─── Public API (for import) ──────────────────────────────────────────────────

/**
 * Fire webhooks for an event. Fire-and-forget — does not await results.
 * Safe to call from synchronous context flows.
 *
 * @param {string} eventType - One of the supported event types
 * @param {string} agent - Agent name (e.g., "codex", "claude")
 * @param {object} data - Event-specific data object
 * @param {string} [project] - Project name (from ai-context/project.md)
 * @param {string} [repo] - Repo identifier (e.g., "SarjeChughtai/Steelportal")
 */
export function fireEvent(eventType, agent, data = {}, project = "", repo = "") {
  const config = loadWebhooks();
  if (!config) return;

  const hooks = matchingHooks(config.hooks, eventType);
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    const payload = buildPayloadForHook(hook, eventType, agent, data, project, repo);
    fireWebhook(hook, payload).catch((err) => {
      warn(`Unexpected error firing ${hook.id}: ${err.message}`);
    });
  }
}

/**
 * Fire webhooks and await all results. Returns an array of result objects.
 * Use this when you need to know delivery status (e.g., in CLI commands).
 *
 * @param {string} eventType
 * @param {string} agent
 * @param {object} data
 * @param {string} [project]
 * @param {string} [repo]
 * @returns {Promise<Array<{hookId: string, success: boolean, status?: number, error?: string, durationMs: number}>>}
 */
export async function fireEventSync(eventType, agent, data = {}, project = "", repo = "") {
  const config = loadWebhooks();
  if (!config) return [];

  const hooks = matchingHooks(config.hooks, eventType);
  if (hooks.length === 0) return [];

  const results = await Promise.allSettled(
    hooks.map((hook) => {
      const payload = buildPayloadForHook(hook, eventType, agent, data, project, repo);
      return fireWebhook(hook, payload);
    })
  );

  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { hookId: "unknown", success: false, error: r.reason?.message }
  );
}

// ─── CLI Commands ─────────────────────────────────────────────────────────────

/**
 * Command: fire an event
 * Usage: node scripts/notify.mjs --event task.done --agent codex --data '{"task_id":"CRM-001","title":"Done"}'
 */
async function cmdFire(options) {
  const { event: eventType, agent, data: dataRaw, project = "", repo = "" } = options;

  if (!eventType) die("--event is required. Example: --event task.done");
  if (!agent) die("--agent is required. Example: --agent codex");

  let data = {};
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw);
    } catch (err) {
      die(`--data is not valid JSON: ${err.message}`);
    }
  }

  const config = loadWebhooks();
  if (!config) {
    log("No webhooks.json found at " + WEBHOOKS_FILE);
    log("Create ai-context/webhooks.json to configure webhooks.");
    process.exit(0);
  }

  const hooks = matchingHooks(config.hooks, eventType);

  if (hooks.length === 0) {
    log(`No enabled hooks match event "${eventType}". Nothing to fire.`);
    log(`Available events in configured hooks: ${[...new Set(config.hooks.flatMap((h) => h.events || []))].join(", ")}`);
    process.exit(0);
  }

  log(`Firing ${hooks.length} hook(s) for event "${eventType}"...`);

  const results = await Promise.allSettled(
    hooks.map((hook) => {
      const payload = buildPayloadForHook(hook, eventType, agent, data, project, repo);
      return fireWebhook(hook, payload);
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  const failed = results.length - succeeded;

  log(`─────────────────────────────────────────`);
  log(`Done. ${succeeded} succeeded, ${failed} failed.`);
}

/**
 * Command: send a test payload to a specific hook
 * Usage: node scripts/notify.mjs test --hook-id slack-updates
 */
async function cmdTest(options) {
  const { hookId } = options;

  if (!hookId) die("--hook-id is required. Example: --hook-id slack-updates");

  const config = loadWebhooks();
  if (!config) {
    log("No webhooks.json found at " + WEBHOOKS_FILE);
    process.exit(0);
  }

  const hook = config.hooks.find((h) => h.id === hookId);
  if (!hook) {
    die(`Hook "${hookId}" not found in webhooks.json.\nRegistered hooks: ${config.hooks.map((h) => h.id).join(", ")}`);
  }

  log(`Sending test payload to hook "${hookId}" (${hook.url.slice(0, 40)}...)...`);

  const testData = {
    task_id: "TEST-001",
    title: "Test notification from Antigravity Agent OS",
    old_status: "in_progress",
    new_status: "done",
    summary: "This is a test payload fired by the notify.mjs test command.",
    project: "antigravity-agent-os",
  };

  const payload = buildPayloadForHook(
    hook,
    "task.done",
    "system",
    testData,
    "antigravity-agent-os",
    "SarjeChughtai/antigravity-agent-os"
  );

  // Override event name for clarity
  if (payload.event) payload.event = "test";

  const result = await fireWebhook(hook, payload);

  if (result.success) {
    log(`Test successful. Hook "${hookId}" is working.`);
  } else {
    log(`Test failed. Hook "${hookId}" returned: ${result.error || result.status}`);
    log(`Check your webhook URL in ai-context/webhooks.json.`);
  }
}

/**
 * Command: list all configured hooks
 * Usage: node scripts/notify.mjs list
 */
function cmdList() {
  const config = loadWebhooks();
  if (!config) {
    log("No webhooks.json found at " + WEBHOOKS_FILE);
    log(`Create ${WEBHOOKS_FILE} to configure webhooks.`);
    return;
  }

  const hooks = config.hooks || [];
  log(`Configured hooks (${hooks.length}):`);
  log(`─────────────────────────────────────────`);

  for (const hook of hooks) {
    const statusIcon = hook.enabled ? "✓" : "○";
    const urlPreview = (hook.url || "").slice(0, 50) + ((hook.url || "").length > 50 ? "..." : "");
    log(`  ${statusIcon} ${hook.id} [${hook.format || "json"}]`);
    log(`      url:    ${urlPreview}`);
    log(`      events: ${(hook.events || []).join(", ")}`);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

// Only run as CLI if this file is executed directly (not imported as a module)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const { positional, options } = parseArgs(argv);
  const command = positional[0];

  switch (command) {
    case "test":
      cmdTest(options).catch((err) => {
        warn(`Unexpected error: ${err.message}`);
        process.exit(0); // never exit non-zero
      });
      break;

    case "list":
      cmdList();
      break;

    default:
      // Default behavior: treat as a fire command (--event, --agent, --data flags)
      if (options.event) {
        cmdFire(options).catch((err) => {
          warn(`Unexpected error: ${err.message}`);
          process.exit(0);
        });
      } else {
        console.log(`
Antigravity Agent OS — Notification Webhook Dispatcher

Usage:
  node scripts/notify.mjs [options]              Fire a webhook event
  node scripts/notify.mjs test [options]         Send a test payload
  node scripts/notify.mjs list                   List configured hooks

Options for firing an event:
  --event      <string>   Event type (e.g., task.done, task.blocked)  [required]
  --agent      <string>   Agent name (e.g., codex, claude)            [required]
  --data       <string>   JSON string with event data
  --project    <string>   Project name (optional)
  --repo       <string>   Repo identifier (optional)

Options for test:
  --hook-id    <string>   ID of the hook to test                      [required]

Supported events:
  task.created, task.status_changed, task.done, task.blocked,
  handoff.created, session.started, session.ended,
  conflict.detected, decision.recorded, rollback.performed

Examples:
  node scripts/notify.mjs --event task.done --agent codex --data '{"task_id":"CRM-001","title":"Define deal state model","old_status":"in_progress","new_status":"done"}'
  node scripts/notify.mjs --event task.blocked --agent claude --data '{"task_id":"AUTH-005","title":"Security audit","new_status":"blocked"}'
  node scripts/notify.mjs test --hook-id slack-updates
  node scripts/notify.mjs list
`);
        process.exit(0);
      }
  }
}
