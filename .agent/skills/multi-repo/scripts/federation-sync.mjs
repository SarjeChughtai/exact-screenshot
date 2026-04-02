#!/usr/bin/env node
/**
 * federation-sync.mjs
 * Antigravity Agent OS — Multi-Repo Federation Sync
 *
 * Reads ai-context/federation.json and syncs task summaries from all
 * registered repos into ai-context/federation-cache.json.
 *
 * Usage:
 *   node scripts/federation-sync.mjs sync
 *   node scripts/federation-sync.mjs add --name NAME --path PATH --prefix PREFIX [--remote URL] [--sync-mode read|read-write]
 *
 * Exit codes:
 *   0 — success
 *   1 — fatal error (invalid config, write failure)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname, join, isAbsolute } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Path Resolution ──────────────────────────────────────────────────────────

// This script may live at:
//   <repo-root>/scripts/federation-sync.mjs         (root-level scripts/)
//   <repo-root>/.agent/skills/multi-repo/scripts/   (skill-local copy)
// In both cases, resolve root as the first ancestor that contains package.json.

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: two levels up from scripts/ dir
  return resolve(__dirname, "..", "..", "..", "..");
}

const ROOT = findRoot(__dirname);
const AI_CTX = join(ROOT, "ai-context");
const FEDERATION_FILE = join(AI_CTX, "federation.json");
const CACHE_FILE = join(AI_CTX, "federation-cache.json");

// ─── Utilities ────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJSON(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function die(msg) {
  console.error(`\n[federation-sync] ERROR: ${msg}\n`);
  process.exit(1);
}

function log(msg) {
  console.log(`[federation-sync] ${msg}`);
}

function warn(msg) {
  console.warn(`[federation-sync] WARN: ${msg}`);
}

function ok(msg) {
  console.log(`[federation-sync] ok  ${msg}`);
}

// ─── Arg Parser ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
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

// ─── Federation Config Helpers ────────────────────────────────────────────────

function loadFederation() {
  if (!existsSync(FEDERATION_FILE)) {
    return { repos: [], last_synced: null };
  }
  try {
    return readJSON(FEDERATION_FILE);
  } catch (err) {
    die(`federation.json is not valid JSON: ${err.message}`);
  }
}

function saveFederation(config) {
  ensureDir(AI_CTX);
  config.last_synced = nowISO();
  writeJSON(FEDERATION_FILE, config);
}

function resolveRepoPath(repoEntry) {
  const { path: repoPath } = repoEntry;
  if (isAbsolute(repoPath)) return repoPath;
  // Relative paths are resolved from the project root
  return resolve(ROOT, repoPath);
}

// ─── Task Summary Extraction ──────────────────────────────────────────────────

const SUMMARY_FIELDS = ["id", "title", "status", "priority", "owner"];

/**
 * Read tasks.json from a repo and return an array of task summaries.
 * Returns null if the file is inaccessible or invalid.
 */
function readTaskSummaries(repoEntry) {
  const resolvedPath = resolveRepoPath(repoEntry);
  const tasksFile = join(resolvedPath, "ai-context", "tasks.json");

  if (!existsSync(resolvedPath)) {
    warn(`Repo "${repoEntry.name}" path not accessible: ${resolvedPath}`);
    return null;
  }

  if (!existsSync(tasksFile)) {
    warn(`Repo "${repoEntry.name}" has no ai-context/tasks.json at ${tasksFile}`);
    return [];
  }

  let tasksData;
  try {
    tasksData = readJSON(tasksFile);
  } catch (err) {
    warn(`Repo "${repoEntry.name}" tasks.json is invalid: ${err.message}`);
    return null;
  }

  const tasks = Array.isArray(tasksData)
    ? tasksData
    : Array.isArray(tasksData?.tasks)
      ? tasksData.tasks
      : null;

  if (!tasks) {
    warn(`Repo "${repoEntry.name}" tasks.json does not expose a task array`);
    return null;
  }

  return tasks.map((task) => {
    const summary = {};
    for (const field of SUMMARY_FIELDS) {
      if (task[field] !== undefined) summary[field] = task[field];
    }
    return summary;
  });
}

// ─── Command: sync ────────────────────────────────────────────────────────────

function cmdSync() {
  log(`Loading federation config from ${FEDERATION_FILE}`);

  const config = loadFederation();

  if (!config.repos || config.repos.length === 0) {
    log("No repos registered in federation.json. Nothing to sync.");
    log("Add a repo with: node scripts/federation-sync.mjs add --name NAME --path PATH --prefix PREFIX");
    process.exit(0);
  }

  const cache = {
    last_synced: nowISO(),
    repos: {},
  };

  let successCount = 0;
  let skipCount = 0;

  for (const repo of config.repos) {
    const { name, prefix, sync_mode, remote } = repo;
    log(`Syncing "${name}" (${prefix}) [${sync_mode}]...`);

    const summaries = readTaskSummaries(repo);

    if (summaries === null) {
      // Path inaccessible
      cache.repos[name] = {
        accessible: false,
        prefix,
        remote: remote || null,
        sync_mode,
        last_synced: nowISO(),
        tasks: [],
      };
      warn(`Skipping "${name}" — path not accessible`);
      skipCount++;
      continue;
    }

    cache.repos[name] = {
      accessible: true,
      prefix,
      remote: remote || null,
      sync_mode,
      last_synced: nowISO(),
      tasks: summaries,
    };

    const inProgress = summaries.filter((t) => t.status === "in_progress").length;
    const blocked = summaries.filter((t) => t.status === "blocked").length;
    const ready = summaries.filter((t) => t.status === "ready").length;

    ok(
      `"${name}" — ${summaries.length} tasks (${inProgress} in_progress, ${blocked} blocked, ${ready} ready)`
    );
    successCount++;
  }

  ensureDir(AI_CTX);
  writeJSON(CACHE_FILE, cache);

  log(`─────────────────────────────────────────`);
  log(`Sync complete. ${successCount} synced, ${skipCount} skipped.`);
  log(`Cache written to: ${CACHE_FILE}`);
  log(`Cache expires in 1 hour.`);
}

// ─── Command: add ─────────────────────────────────────────────────────────────

function cmdAdd(options) {
  const { name, path: repoPath, prefix, remote, "sync-mode": syncMode } = options;

  // Validate required args
  if (!name) die("--name is required. Example: --name steelportal");
  if (!repoPath) die("--path is required. Example: --path ../Steelportal");
  if (!prefix) die("--prefix is required. Example: --prefix SP");

  // Validate prefix format
  if (!/^[A-Z]{1,8}$/.test(prefix)) {
    die(`--prefix must be 1–8 uppercase letters. Got: "${prefix}"`);
  }

  // Validate sync-mode
  const resolvedSyncMode = syncMode || "read";
  if (!["read", "read-write"].includes(resolvedSyncMode)) {
    die(`--sync-mode must be "read" or "read-write". Got: "${resolvedSyncMode}"`);
  }

  const config = loadFederation();
  if (!Array.isArray(config.repos)) config.repos = [];

  // Check for duplicate name
  const existingByName = config.repos.find((r) => r.name === name);
  if (existingByName) {
    warn(`Repo "${name}" already registered. Updating entry.`);
    Object.assign(existingByName, {
      path: repoPath,
      prefix,
      ...(remote ? { remote } : {}),
      sync_mode: resolvedSyncMode,
    });
  } else {
    // Check for duplicate prefix
    const existingByPrefix = config.repos.find((r) => r.prefix === prefix);
    if (existingByPrefix) {
      die(
        `Prefix "${prefix}" is already used by repo "${existingByPrefix.name}". ` +
          `Each repo must have a unique prefix.`
      );
    }

    const newEntry = {
      name,
      path: repoPath,
      ...(remote ? { remote } : {}),
      prefix,
      sync_mode: resolvedSyncMode,
    };

    config.repos.push(newEntry);
    log(`Registered new repo "${name}" (${prefix}) at ${repoPath}`);
  }

  saveFederation(config);
  ok(`federation.json updated: ${FEDERATION_FILE}`);
  log(`Run "node scripts/federation-sync.mjs sync" to pull initial state.`);
}

// ─── Command: list ────────────────────────────────────────────────────────────

function cmdList() {
  const config = loadFederation();

  if (!config.repos || config.repos.length === 0) {
    log("No repos registered. Use 'add' to register one.");
    return;
  }

  log(`Registered repos (${config.repos.length}):`);
  log(`─────────────────────────────────────────`);

  for (const repo of config.repos) {
    const resolvedPath = resolveRepoPath(repo);
    const accessible = existsSync(resolvedPath);
    const statusIcon = accessible ? "✓" : "✗";
    log(`  ${statusIcon} ${repo.name} (${repo.prefix}) [${repo.sync_mode}]`);
    log(`      path:   ${resolvedPath} ${accessible ? "" : "(NOT ACCESSIBLE)"}`);
    if (repo.remote) log(`      remote: ${repo.remote}`);
  }

  // Show cache age if available
  if (existsSync(CACHE_FILE)) {
    try {
      const cache = readJSON(CACHE_FILE);
      const ageMs = Date.now() - new Date(cache.last_synced).getTime();
      const ageMin = Math.round(ageMs / 60000);
      log(`\nCache last synced: ${cache.last_synced} (${ageMin} minutes ago)`);
      if (ageMin > 60) warn("Cache is stale (>1 hour). Run 'sync' to refresh.");
    } catch (_) {
      // ignore
    }
  } else {
    log("\nNo cache found. Run 'sync' to populate.");
  }
}

// ─── Command: status ─────────────────────────────────────────────────────────

function cmdStatus() {
  if (!existsSync(CACHE_FILE)) {
    log("No federation cache found. Run 'sync' first.");
    process.exit(0);
  }

  let cache;
  try {
    cache = readJSON(CACHE_FILE);
  } catch (err) {
    die(`federation-cache.json is not valid JSON: ${err.message}`);
  }

  const ageMs = Date.now() - new Date(cache.last_synced).getTime();
  const ageMin = Math.round(ageMs / 60000);

  log(`Federation Cache Status`);
  log(`─────────────────────────────────────────`);
  log(`Last synced: ${cache.last_synced} (${ageMin} min ago)`);
  log(`Cache status: ${ageMin > 60 ? "STALE — run sync" : "fresh"}`);
  log(``);

  for (const [repoName, repoData] of Object.entries(cache.repos || {})) {
    const icon = repoData.accessible ? "✓" : "✗";
    log(`${icon} ${repoName} (${repoData.prefix}) [${repoData.sync_mode}]`);

    if (!repoData.accessible) {
      log(`    Path not accessible at last sync`);
      continue;
    }

    const tasks = repoData.tasks || [];
    const byStatus = {};
    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }

    const parts = Object.entries(byStatus)
      .map(([s, n]) => `${n} ${s}`)
      .join(", ");
    log(`    ${tasks.length} tasks: ${parts || "none"}`);

    // Show in_progress and blocked tasks
    const active = tasks.filter(
      (t) => t.status === "in_progress" || t.status === "blocked"
    );
    for (const task of active) {
      const statusLabel =
        task.status === "blocked" ? `[BLOCKED]` : `[in_progress]`;
      log(
        `    ${statusLabel} ${repoData.prefix}:${task.id} — ${task.title} (${task.owner || "unassigned"})`
      );
    }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const { positional, options } = parseArgs(argv);
const command = positional[0];

switch (command) {
  case "sync":
    cmdSync();
    break;

  case "add":
    cmdAdd(options);
    break;

  case "list":
    cmdList();
    break;

  case "status":
    cmdStatus();
    break;

  default:
    console.log(`
Antigravity Agent OS — Federation Sync

Usage:
  node scripts/federation-sync.mjs <command> [options]

Commands:
  sync                      Sync all registered repos into federation-cache.json
  add                       Register a new repo in federation.json
  list                      List all registered repos and their accessibility
  status                    Show federation cache status and active task summary

Options for 'add':
  --name       <string>     Repo identifier (e.g., steelportal)         [required]
  --path       <string>     Relative or absolute path to repo root      [required]
  --prefix     <string>     Short uppercase prefix for task IDs (e.g., SP) [required]
  --remote     <string>     GitHub remote URL (optional, for handoffs)
  --sync-mode  <string>     "read" (default) or "read-write"

Examples:
  node scripts/federation-sync.mjs sync
  node scripts/federation-sync.mjs add --name steelportal --path ../Steelportal --prefix SP --remote https://github.com/SarjeChughtai/Steelportal
  node scripts/federation-sync.mjs add --name myrepo --path /absolute/path/to/repo --prefix MR --sync-mode read-write
  node scripts/federation-sync.mjs list
  node scripts/federation-sync.mjs status
`);
    process.exit(0);
}
