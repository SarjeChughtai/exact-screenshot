# Federation Setup Guide

Multi-repo federation lets the Antigravity Agent OS share task visibility and handoffs across multiple Git repositories. This guide covers initial setup, common configurations, and troubleshooting.

---

## Overview

Federation is a **read-mostly** coordination layer. Each repository maintains its own `ai-context/` directory as the sole source of truth. Federation only shares task metadata — it never merges, overwrites, or auto-applies changes across repos.

**What federation does:**
- Shows in-progress and blocked tasks from other repos in your dashboard
- Enables cross-repo task references in the format `PREFIX:TASK_ID` (e.g., `SP:CRM-001`)
- Writes structured handoffs that include both source and target repo context

**What federation does not do:**
- Merge or sync full context files between repos
- Automatically commit or push to remote repos
- Write to a repo unless `sync_mode` is `"read-write"` and you explicitly run a write operation

---

## Prerequisites

- Node.js ≥ 18 (ESM module support required)
- Both repos cloned locally and accessible from the filesystem
- `ai-context/tasks.json` present in each repo you want to federate with

---

## Step 1 — Copy the Script

The federation sync script is bundled with the `multi-repo` skill. Copy it to your project's root `scripts/` directory so it integrates with `package.json`:

```bash
cp .agent/skills/multi-repo/scripts/federation-sync.mjs scripts/federation-sync.mjs
```

---

## Step 2 — Add npm Scripts to package.json

Add these entries to the `"scripts"` block in `package.json`:

```json
{
  "scripts": {
    "context:federation:sync": "node scripts/federation-sync.mjs sync",
    "context:federation:add": "node scripts/federation-sync.mjs add",
    "context:federation:list": "node scripts/federation-sync.mjs list",
    "context:federation:status": "node scripts/federation-sync.mjs status"
  }
}
```

After adding these, run `npm run context:federation:list` to confirm the script loads correctly.

---

## Step 3 — Register a Remote Repo

Use the `add` command to register a repo. The `--path` argument is resolved relative to this repo's root directory.

**Example — sibling directory:**

```bash
npm run context:federation:add -- \
  --name steelportal \
  --path ../Steelportal \
  --prefix SP \
  --remote https://github.com/SarjeChughtai/Steelportal
```

**Example — absolute path:**

```bash
npm run context:federation:add -- \
  --name myrepo \
  --path /Users/me/projects/myrepo \
  --prefix MR \
  --remote https://github.com/myorg/myrepo \
  --sync-mode read-write
```

**Option reference:**

| Option | Required | Description |
|---|---|---|
| `--name` | Yes | Lowercase identifier for the repo (used in display and cache keys) |
| `--path` | Yes | Filesystem path to the repo root (relative or absolute) |
| `--prefix` | Yes | 1–8 uppercase letters used in cross-repo task IDs (`SP`, `AOS`, `MR`) |
| `--remote` | No | GitHub URL shown in handoff records |
| `--sync-mode` | No | `read` (default) or `read-write` |

**Important:** Prefix values must be unique across all registered repos. The script rejects duplicates.

---

## Step 4 — Run Initial Sync

Pull the current task state from all registered repos:

```bash
npm run context:federation:sync
```

Expected output:

```
[federation-sync] Loading federation config...
[federation-sync] Syncing "steelportal" (SP) [read]...
[federation-sync] ok  "steelportal" — 12 tasks (3 in_progress, 1 blocked, 4 ready)
[federation-sync] ─────────────────────────────────────────
[federation-sync] Sync complete. 1 synced, 0 skipped.
[federation-sync] Cache written to: /path/to/project/ai-context/federation-cache.json
[federation-sync] Cache expires in 1 hour.
```

---

## Step 5 — Verify Setup

Check what was cached:

```bash
npm run context:federation:status
```

Expected output:

```
[federation-sync] Federation Cache Status
[federation-sync] ─────────────────────────────────────────
[federation-sync] Last synced: 2026-04-02T12:00:00Z (3 min ago)
[federation-sync] Cache status: fresh
[federation-sync]
[federation-sync] ✓ steelportal (SP) [read]
[federation-sync]     12 tasks: 3 in_progress, 1 blocked, 4 ready, 2 done, 2 archived
[federation-sync]     [in_progress] SP:CRM-001 — Define deal state model (Codex)
[federation-sync]     [BLOCKED] SP:UI-007 — Contact card layout (Claude)
```

---

## Configuration Reference

`ai-context/federation.json` is the live registry. You can edit it directly or use the `add` command.

```json
{
  "repos": [
    {
      "name": "steelportal",
      "path": "../Steelportal",
      "remote": "https://github.com/SarjeChughtai/Steelportal",
      "prefix": "SP",
      "sync_mode": "read"
    },
    {
      "name": "antigravity-agent-os",
      "path": ".",
      "remote": "https://github.com/SarjeChughtai/antigravity-agent-os",
      "prefix": "AOS",
      "sync_mode": "read-write"
    }
  ],
  "last_synced": "2026-04-02T12:00:00Z"
}
```

**sync_mode values:**

| Value | Meaning |
|---|---|
| `read` | Read task metadata from this repo. Never write to it. |
| `read-write` | May write context back to this repo (requires explicit agent action). |

---

## Cross-Repo Task References

Reference a task in another repo using the format `PREFIX:TASK_ID`:

- `SP:CRM-001` — task CRM-001 in the Steelportal repo
- `AOS:INFRA-003` — task INFRA-003 in this repo

Agents resolve these references by:
1. Looking up the prefix in `federation.json`
2. Reading `{repo_path}/ai-context/tasks.json`
3. Displaying the task status inline

If the remote repo is not accessible, the reference displays as:
```
SP:CRM-001 (unavailable — path not accessible)
```

---

## Cross-Repo Handoffs

When handing work from one repo to another, write handoff entries in both repos.

**Source repo** (`antigravity-agent-os/ai-context/handoffs/active.md`):

```markdown
---
## Handoff: Claude → Codex
timestamp: 2026-04-02T16:45:00Z
task_ids: [AOS-API-005]
cross_repo_target: steelportal

### Completed
- Scaffolded API contract in api/contracts/deal.ts

### Exact Next Step
Switch to Steelportal repo. Pick up SP:CRM-005. Implement the API client in
lib/api/deals.ts using the contract from antigravity-agent-os/api/contracts/deal.ts.

### Files Touched
- api/contracts/deal.ts — new contract file

### Notes
Handing off to Codex in steelportal for SP:CRM-005 API integration.
Remote context: https://github.com/SarjeChughtai/Steelportal
---
```

**Target repo** (`Steelportal/ai-context/handoffs/active.md`):

```markdown
---
## Handoff: Claude → Codex
timestamp: 2026-04-02T16:46:00Z
task_ids: [CRM-005]
cross_repo_source: antigravity-agent-os

### Completed
- Received handoff from Claude in antigravity-agent-os

### Exact Next Step
Implement the API client in lib/api/deals.ts using the contract from
../antigravity-agent-os/api/contracts/deal.ts.

### Files Touched
- lib/api/deals.ts — to be created

### Notes
Received from Claude in antigravity-agent-os, continuing SP:CRM-005.
Source context: https://github.com/SarjeChughtai/antigravity-agent-os
---
```

---

## Troubleshooting

### "Path not accessible" on sync

The `path` in `federation.json` cannot be resolved from the project root.

**Fix:** Check that the sibling repo is cloned at the expected relative path. Use `node scripts/federation-sync.mjs list` to see resolved absolute paths.

```bash
# Confirm the path resolves correctly
ls ../Steelportal/ai-context/tasks.json
```

### "tasks.json is not valid JSON"

The remote repo's `tasks.json` has a syntax error.

**Fix:** This must be fixed in the remote repo. The sync will skip that repo and continue with others — it is non-blocking.

### "Prefix already used by another repo"

Two repos share the same prefix.

**Fix:** Assign a different prefix when registering. Edit `federation.json` directly if needed.

### Cache is always stale

The cache file is not being written, or the path is wrong.

**Fix:** Confirm that `ai-context/` is writable and that you run `sync` from the project root.

### Federation breaks agent session startup

Federation is optional. If `federation.json` does not exist, the skill is silently skipped.

**Fix:** If federation is causing errors, rename or delete `ai-context/federation.json` temporarily and re-run the session bootstrap.

---

## Automating Sync

To keep the cache fresh, schedule `sync` at the start of each agent session by adding it to your session bootstrap workflow:

```markdown
# In .agent/workflows/start-session.md, add:
- Run `npm run context:federation:sync` if federation.json exists
```

Or integrate it into your CI/CD pipeline:

```yaml
# .github/workflows/agent-sync.yml
- name: Sync federation cache
  run: npm run context:federation:sync
```

---

## Security Notes

- Federation only reads local filesystem paths — it does not make network requests to GitHub.
- The `remote` field is stored for display/handoff purposes only; it is never used to fetch data.
- If you store sensitive data in `tasks.json`, it will be included in `federation-cache.json`. Ensure `federation-cache.json` is included in `.gitignore` if needed.
- Repos with `sync_mode: "read"` are strictly read-only at the tool level; no agent action can write to them through this system.
