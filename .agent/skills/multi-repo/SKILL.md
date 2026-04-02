---
name: multi-repo
description: Federate tasks, handoffs, and context across multiple Git repositories. Use when working on a project that spans multiple repos, when referencing tasks from another repo, or when coordinating agent work across codebases.
---

## Goal

Maintain cross-repo visibility and coordination without violating each repo's local source of truth. Federation is a read-mostly layer — each repo owns its own `ai-context/` and shares a consistent view of work happening elsewhere.

## Instructions

### 1. Federation Model

Each repository maintains its own `ai-context/` directory as the local source of truth. Federation provides a read-mostly layer that enables cross-repo visibility without introducing coupling between codebases.

**Registry file:** `ai-context/federation.json`

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
  "last_synced": "ISO-8601 timestamp"
}
```

**Field definitions:**

| Field | Description |
|---|---|
| `name` | Human-readable repo identifier (lowercase, hyphenated) |
| `path` | Relative or absolute filesystem path to the repo root |
| `remote` | Canonical GitHub remote URL (used in handoffs and cross-references) |
| `prefix` | Short uppercase prefix used in cross-repo task IDs (e.g., `SP`, `AOS`) |
| `sync_mode` | `"read"` — read only; `"read-write"` — may write context back |

### 2. Cross-Repo Task References

Tasks in other repos are referenced using the format `REPO_PREFIX:TASK_ID`.

**Examples:**
- `SP:CRM-001` — task `CRM-001` in the Steelportal repo
- `AOS:INFRA-003` — task `INFRA-003` in this repo

**Agent behavior when encountering a cross-repo reference:**

1. Parse the prefix to identify the repo from `federation.json`.
2. Resolve the repo's `path` and read `{path}/ai-context/tasks.json` if accessible.
3. Find the task by `id` and display its current state inline.
4. If the repo path is not accessible, display: `SP:CRM-001 (unavailable — path not accessible)` and continue without blocking.

**Display format for inline cross-repo task status:**

```
SP:CRM-001 (in_progress, owned by Codex) — Define deal state model
```

**Mutability rules:**
- Cross-repo tasks are **read-only** when `sync_mode` is `"read"`.
- Cross-repo tasks may be updated only when `sync_mode` is `"read-write"` AND you are operating from within that repo's context.
- Never write to a remote repo's `ai-context/` unless explicitly configured with `"sync_mode": "read-write"`.

### 3. Cross-Repo Handoffs

When handing work from one repo to another, create handoff entries in **both** repos.

**Source repo handoff** (written in the repo you are leaving):

```markdown
---
## Handoff: [FROM_AGENT] → [TO_AGENT]
timestamp: [ISO 8601]
task_ids: [LOCAL_TASK_ID]
cross_repo_target: [TARGET_REPO_NAME]

### Completed
- [Work completed in this repo]

### Exact Next Step
Continue in [target_repo_name] repo at [path]. Task: [TARGET_REPO_PREFIX:TASK_ID].
[Specific action the receiving agent should take.]

### Files Touched
- [file paths in this repo]

### Notes
Handing off to [agent] in [repo_name] for [task description].
Remote context: [remote URL]
---
```

**Target repo handoff** (written in the repo you are entering):

```markdown
---
## Handoff: [FROM_AGENT] → [TO_AGENT]
timestamp: [ISO 8601]
task_ids: [TARGET_TASK_ID]
cross_repo_source: [SOURCE_REPO_NAME]

### Completed
- Received handoff from [agent] in [source_repo_name]

### Exact Next Step
[Exact action to take, incorporating full file paths and repo context]

### Files Touched
- [files this agent will work on in this repo]

### Notes
Received from [agent] in [source_repo_name], continuing [task description].
Source context: [source repo remote URL]
---
```

### 4. Federated Dashboard

At session start when federation is enabled:

1. **Load local `ai-context/` first** (always — local context takes priority).
2. **Read `ai-context/federation.json`** to discover registered repos.
3. **For each federated repo** (where `sync_mode` is `"read"` or `"read-write"`):
   - Resolve the `path` field.
   - If accessible: read `{path}/ai-context/dashboard.md` and `{path}/ai-context/tasks.json`.
   - If not accessible: log `[federation] Skipping [name] — path not accessible` and continue.
4. **Present a unified view:**

```
## Federated Dashboard — [timestamp]

### LOCAL: antigravity-agent-os (AOS)
[Paste or summarize local dashboard.md content]

### REMOTE: steelportal (SP) [read-only]
Last synced: [timestamp from federation-cache.json]
In Progress:
  SP:CRM-001 — Define deal state model [Codex]
  SP:AUTH-003 — Add OAuth provider [Claude]
Blocked:
  SP:UI-007 — Contact card layout [waiting for design]
```

### 5. Sync Procedure

**Command:** `npm run context:federation:sync`

The sync operation:
1. Reads `ai-context/federation.json` for all registered repos.
2. For each repo with an accessible path, reads `{path}/ai-context/tasks.json`.
3. Extracts task summaries: `id`, `title`, `status`, `priority`, `owner`.
4. Writes summaries to `ai-context/federation-cache.json` with a `last_synced` timestamp.
5. Cache is considered fresh for **1 hour**. Agents should check `last_synced` before trusting cached data.

**federation-cache.json format:**

```json
{
  "last_synced": "2026-04-02T12:00:00Z",
  "repos": {
    "steelportal": {
      "accessible": true,
      "last_synced": "2026-04-02T12:00:00Z",
      "tasks": [
        {
          "id": "CRM-001",
          "title": "Define deal state model",
          "status": "in_progress",
          "priority": "high",
          "owner": "Codex"
        }
      ]
    }
  }
}
```

**Adding a new repo:**

```bash
npm run context:federation:add -- --name steelportal --path ../Steelportal --prefix SP --remote https://github.com/SarjeChughtai/Steelportal
```

This creates or updates `ai-context/federation.json` with the new repo entry. `sync_mode` defaults to `"read"`.

### 6. Setup Instructions

**First-time setup for a new federated repo:**

```bash
# Step 1 — Register the remote repo
npm run context:federation:add -- \
  --name steelportal \
  --path ../Steelportal \
  --prefix SP \
  --remote https://github.com/SarjeChughtai/Steelportal

# Step 2 — Pull initial state from all federated repos
npm run context:federation:sync
```

**Verify federation is working:**

```bash
# Check the cache was populated
cat ai-context/federation-cache.json

# Run a sync and confirm output
node scripts/federation-sync.mjs sync
```

**Direct script usage (without npm):**

```bash
# Sync all registered repos
node scripts/federation-sync.mjs sync

# Add a new repo
node scripts/federation-sync.mjs add \
  --name steelportal \
  --path ../Steelportal \
  --prefix SP \
  --remote https://github.com/SarjeChughtai/Steelportal \
  --sync-mode read
```

## Examples

**Example 1 — Referencing a cross-repo task in a handoff**

```markdown
### Notes
This task depends on SP:CRM-001 (in_progress, Codex) being complete before
the API contract can be finalized. Do not proceed with AOS:API-005 until
SP:CRM-001 reaches `done` status.
```

**Example 2 — Federated session start output**

```
Loading local context... done
Loading federation registry... 2 repos registered

[federation] steelportal (SP) — accessible at ../Steelportal
  5 tasks: 2 in_progress, 1 blocked, 2 ready
  Blocked: SP:UI-007 — Contact card layout (waiting for design spec)

[federation] Cache age: 23 minutes (fresh)
```

**Example 3 — Cross-repo handoff (sending side)**

Claude finishes AOS-side API scaffolding and needs Codex to pick up Steelportal integration:

Source repo handoff written to `antigravity-agent-os/ai-context/handoffs/active.md`:
```
Handing off to Codex in steelportal for SP:CRM-005 API integration.
Remote context: https://github.com/SarjeChughtai/Steelportal
```

Target repo handoff written to `Steelportal/ai-context/handoffs/active.md`:
```
Received from Claude in antigravity-agent-os, continuing SP:CRM-005 API integration.
Source context: https://github.com/SarjeChughtai/antigravity-agent-os
```

## Constraints

- **Never write to a remote repo's `ai-context/`** unless `sync_mode` is `"read-write"`.
- **Federation is optional.** The system works fully without `federation.json`. If the file does not exist, skip all federation steps silently.
- **Inaccessible repos are non-blocking.** If a federated repo path cannot be read, log it and continue.
- **Cross-repo task references are informational, not blocking.** An agent should never halt work because a remote task status cannot be fetched.
- **Cache only task metadata.** Never cache full context files, source code, or decision records from remote repos.
- **One hour cache TTL.** If `federation-cache.json` is older than 1 hour, re-sync before presenting federated dashboard data.
- **Prefix uniqueness.** Each repo must have a unique prefix. Adding a repo with a duplicate prefix is an error.
