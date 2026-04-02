---
name: context-sync
description: |
  Keeps ai-context/ files synchronized and valid across agent sessions. Activate when starting a new session, when context may be stale, when switching between agents, or when tasks.json might be out of date. Trigger phrases: "sync context", "update context", "check context", "is context current", "validate tasks", "context might be stale", "starting a new session", "context out of sync", "reconcile context", "refresh dashboard", "context check".
---

## Goal

Validate and reconcile all ai-context/ files so that every agent begins from a single, consistent, accurate source of truth. Detect and repair drift between tasks.json, handoffs/active.md, dashboard.md, and log entries.

## Instructions

### Step 1 — Read All Context Files

Read each file in order and note its `updated_at` or last-modified timestamp:

1. `ai-context/project.md` — project identity, stack, conventions (rarely changes)
2. `ai-context/dashboard.md` — active sprint, current agent assignments
3. `ai-context/tasks.json` — all task records
4. `ai-context/agents.md` — agent availability and current assignments
5. `ai-context/handoffs/active.md` — in-flight handoffs
6. `ai-context/logs/` — list all log files, identify the most recent

Flag any file that:
- Does not exist (create a minimal valid version)
- Has not been updated in more than 48 hours and contains in-progress work
- Has a timestamp in the future (clock skew indicator)

### Step 2 — Validate tasks.json Structure

Run `scripts/validate-context.mjs` against `ai-context/tasks.json`:

```bash
node .agent/skills/context-sync/scripts/validate-context.mjs ai-context/tasks.json
```

The validator checks:

**Required fields** (every task must have all of these):
- `id` — string, format `AREA-NNN`
- `title` — non-empty string
- `status` — one of: `pending`, `ready`, `in_progress`, `blocked`, `review`, `done`, `archived`
- `priority` — one of: `low`, `medium`, `high`, `critical`
- `owner` — non-empty string (agent name or "human")
- `last_updated_by` — non-empty string
- `next_action` — non-empty string (must be actionable, not a description of state)
- `notes` — string (may be empty)
- `updated_at` — valid ISO 8601 datetime string

**Warnings** (not blocking but should be addressed):
- Tasks in `in_progress` status with `updated_at` older than 24 hours
- Tasks in `blocked` status with no `blockers` note
- Tasks in `review` status with no reviewer specified in `notes`
- Duplicate `id` values
- Missing `area` or `files` fields (optional but recommended)

Fix all errors before proceeding. For each error, either correct the field value or flag it for human review in `ai-context/dashboard.md`.

### Step 3 — Validate handoffs/active.md

Read `ai-context/handoffs/active.md` and verify each handoff entry contains:
- `from_agent` — the agent that completed work
- `to_agent` — the agent that should pick up
- `timestamp` — when the handoff was written
- `completed` — list of completed items
- `exact_next_step` — a single, unambiguous action for the receiving agent
- `files_touched` — list of files modified

Check that:
- Every task in `in_progress` or `review` status in tasks.json has a corresponding handoff entry.
- Every handoff references a valid task ID that exists in tasks.json.
- The `to_agent` in each handoff matches the `owner` in the corresponding task.

If mismatches are found, update the handoff or task (whichever is stale) and note the correction.

### Step 4 — Validate dashboard.md

Read `ai-context/dashboard.md` and verify:
- The listed active sprint or focus area matches the highest-priority `in_progress` tasks.
- The current agent assignments reflect actual task owners in tasks.json.
- No completed tasks are listed as active.
- Blocked tasks are listed with their blocker description.

Update `dashboard.md` if it is out of sync with tasks.json. Rewrite only the stale sections; preserve any human-authored notes.

### Step 5 — Reconcile Logs with Task State

List all files in `ai-context/logs/` and read the most recent log file. Cross-reference:
- Any task mentioned as completed in logs but still `in_progress` in tasks.json → update status to `review` or `done` as appropriate.
- Any task mentioned as started in logs but still `pending` or `ready` → update to `in_progress`.
- Any error or blocker mentioned in logs but not reflected in tasks.json → update status to `blocked` and populate `notes`.

Append a reconciliation note to today's log file (create it if it does not exist):

```
[YYYY-MM-DDTHH:MM:SSZ] context-sync: Reconciliation complete. X tasks updated, Y warnings, Z errors fixed.
```

### Step 6 — Optional Supabase Sync

If the project uses a Supabase backend (check `ai-context/project.md` for `supabase_url`):

1. Confirm the edge function URL: typically `{SUPABASE_URL}/functions/v1/sync-context`
2. POST the current `tasks.json` content as the request body with `Content-Type: application/json`
3. Confirm a 200 response; if not, log the failure and continue (do not block the session on sync failure)
4. Record the sync timestamp in `dashboard.md`

This step is optional — local context files are authoritative. Supabase is a secondary replica.

### Step 7 — Report

Produce a short sync report in this format:

```
Context Sync Report — [timestamp]
==================================
Files validated: [N]
Tasks total: [N] | In-progress: [N] | Blocked: [N] | Done (recent): [N]
Errors fixed: [list or "none"]
Warnings: [list or "none"]
Handoff mismatches resolved: [N]
Dashboard updated: [yes/no]
Supabase sync: [success/failed/skipped]
Highest-priority ready task: [ID] — [title] (owner: [agent])
```

## Examples

**Example 1 — Starting a fresh session after another agent worked**
> Previous session: Codex worked on AUTH-003, finished, wrote a handoff but didn't update tasks.json.

1. Validate tasks.json → AUTH-003 still shows `in_progress`
2. Read handoffs/active.md → handoff shows AUTH-003 completed, next step for Claude review
3. Update AUTH-003 status to `review`, owner to `Claude`
4. Update dashboard.md to reflect Claude's new assignment
5. Report: 1 task updated, 1 handoff reconciled

**Example 2 — Stale context after a weekend**
> tasks.json has 3 tasks showing `in_progress` but the log shows they all completed Friday.

1. Validate → 3 tasks flagged as stale (in_progress > 48 hours)
2. Read logs → confirm all 3 completed Friday
3. Update all 3 to `done`
4. Update dashboard.md sprint summary
5. Report: 3 tasks updated, no errors

## Constraints

- Never delete a task entry from tasks.json during sync. Set status to `archived` if a task is confirmed obsolete.
- Do not overwrite human-authored notes in dashboard.md or tasks.json. Append or update only the fields that are demonstrably incorrect.
- If a conflict cannot be resolved automatically (e.g., two log entries contradict each other), flag it in dashboard.md under a "Sync Conflicts" section and leave the current value unchanged.
- Do not proceed with any other skill if the validator reports schema errors. Fix them first.
