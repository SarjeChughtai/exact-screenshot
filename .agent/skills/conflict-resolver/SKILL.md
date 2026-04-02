---
name: conflict-resolver
description: Detect and resolve conflicts in shared agent memory files (tasks.json, handoffs, dashboard, logs). Use when merging branches, when context files seem inconsistent, when multiple agents worked simultaneously, or when starting a session and data looks stale or contradictory.
---

## Goal

Restore a single, consistent, trustworthy source of truth across all `ai-context/` files after conflicts caused by simultaneous agent writes, branch merges, stale sessions, or clock drift.

## When to Activate

Activate this skill when any of the following are true:

- You notice a task is `in_progress` in tasks.json but the latest log entry says it's `done`
- A handoff references a task state that doesn't match tasks.json
- Dashboard shows an agent or task that tasks.json doesn't reflect
- A `git merge` or `git pull` produced conflict markers in any `ai-context/` file
- Two agents wrote to the same file within a short window and you suspect a race condition
- A log entry references a task ID that doesn't exist
- Any `updated_at` timestamp looks wrong (future date, or out of sequence)
- You're starting a new session and something "feels off" about the context

If in doubt, run the detection script first (`node .agent/skills/conflict-resolver/scripts/detect-conflicts.mjs`) before making any manual changes.

---

## Phase 1 — Detection

Read ALL `ai-context/` files before touching anything. Record what you observe. Never modify files during the detection phase.

### Files to Read (in order)

1. `ai-context/tasks.json` — task registry, primary source of truth
2. `ai-context/handoffs/active.md` — in-flight handoffs between agents
3. `ai-context/dashboard.md` — derived state (agent assignments, current task, blockers)
4. `ai-context/logs/` — scan all log files present, focus on the most recent two
5. Any git-conflicted files (check output of `git status` if in a git repo)

### Conflict Types to Check

#### (a) Git Merge Conflicts
Scan all files in `ai-context/` for the strings `<<<<<<<`, `=======`, and `>>>>>>>`. Even one occurrence in any file means the file is unreadable by other agents and must be resolved first. This is always **Critical** severity.

Detection: run `grep -r "<<<<<<" ai-context/` from the repo root.

#### (b) Task State Inconsistency
For each task in tasks.json with status `in_progress`, `review`, or `blocked`:
- Find all log entries mentioning that task ID
- Compare the log's implied state to tasks.json's stated status
- A log entry saying "completed" or "done" while tasks.json says `in_progress` is a conflict
- A task with `status: done` that has no corresponding log entry is a conflict

Detection: compare `updated_at` in tasks.json vs the timestamp of the log entry for that task. The newer source is more likely correct.

#### (c) Stale Handoff
For each handoff entry in `handoffs/active.md`:
- Extract the `task_ids` referenced
- Look up each task in tasks.json
- If the task's current state (status, owner, next_action) significantly differs from what the handoff describes, the handoff is stale
- A handoff is also stale if its timestamp is older than 48 hours and the referenced task is still `in_progress`

#### (d) Dashboard Drift
Compare `dashboard.md` against tasks.json and `handoffs/active.md`:
- "Current Agent" in dashboard should match the `owner` of the active in-progress task
- "Current Task ID" should exist in tasks.json with status `in_progress`
- "Current Blockers" should match any `blocked` tasks in tasks.json
- "Recently Completed" should list tasks with `status: done`

Dashboard is always derived. Any discrepancy between dashboard and tasks.json means dashboard is wrong — not tasks.json.

#### (e) Duplicate Task Updates
For tasks where two different agents both wrote updates:
- Compare `last_updated_by` field and `updated_at` timestamps
- If two updates exist with timestamps within 60 seconds of each other and different `last_updated_by` values, flag as a potential race condition
- This requires checking git log or log file entries to reconstruct who wrote what

#### (f) Orphaned Log References
For each task ID mentioned in any log file:
- Check that the task ID exists in tasks.json
- If the task ID is not found in tasks.json, the log entry is orphaned
- Orphaned references are informational (the task may have been purged incorrectly), not always critical

#### (g) Timestamp Anomalies
For every `updated_at` value in tasks.json and every timestamp in log files:
- **Future timestamp**: `updated_at` is after the current UTC time
- **Out-of-order sequence**: a task's log entries are not in chronological order
- **Suspicious gap**: a task has `status: in_progress` and `updated_at` older than 72 hours

---

## Phase 2 — Resolution

Work through conflicts one at a time. Always create a backup before making bulk changes. Log every action.

### Step 0 — Backup

Before resolving anything, create a timestamped backup:

```bash
cp -r ai-context/ ai-context.backup-$(date -u +%Y%m%dT%H%M%SZ)/
```

Record the backup path in your reconciliation summary.

### Step 1 — Resolve Git Merge Conflicts First

Git conflicts make files unparseable. Resolve these before any other conflict type.

**tasks.json** (JSON merge):
1. Identify the `<<<<<<< HEAD` (local) and `>>>>>>> branch-name` (incoming) sides
2. Parse the task arrays from each side
3. Build a merged task array:
   - For tasks that appear only in one side, include them
   - For tasks that appear in both sides (same `id`), keep the version with the **later `updated_at` timestamp**
   - If `updated_at` timestamps are equal but fields differ, merge field by field: later timestamp wins per field if individual field timestamps are available, otherwise flag for human review
   - Deduplicate by `id` — no two tasks may share an ID
4. Write the merged array as valid JSON
5. Run `node scripts/validate-context.mjs` to confirm validity

**handoffs/active.md** (text merge):
1. Parse the handoff blocks from each side (each block is delimited by `---` separators)
2. For each pair of conflicting handoff blocks, keep the one with the **later `timestamp:` field**
3. Archive the older one by appending it to `ai-context/handoffs/archive/YYYY-MM-DD.md` with a note: `Archived during conflict resolution (older of two concurrent versions)`
4. Write the merged active.md with only the winning handoff blocks

**dashboard.md** (regenerate):
- Do not try to merge dashboard.md — it is derived state
- Instead, skip to Phase 2 Step 4 (Dashboard Drift) and regenerate it from tasks.json

**logs/YYYY-MM-DD.md** (append-only merge):
1. Extract all timestamped entries from both sides
2. Combine both sets of entries into one list
3. Sort chronologically by timestamp
4. Write the combined, deduplicated list (if identical entries appear on both sides, keep one)
5. Never discard any log entry — logs are append-only and immutable

### Step 2 — Resolve Task State Inconsistency

For each inconsistent task:

1. Find the `updated_at` timestamp in tasks.json for this task
2. Find the most recent log entry that references this task ID and note its timestamp
3. Apply this decision tree:
   - **Log is newer than tasks.json**: update tasks.json to match the implied state from the log. Example: if the log says "completed INFRA-005", set `status: done` in tasks.json.
   - **tasks.json is newer than the log**: trust tasks.json. The explicit update took precedence. Append a clarifying note to the log: `# Note: tasks.json updated_at is newer than this log entry. tasks.json state is authoritative.`
   - **Timestamps are identical or ambiguous** (within 60 seconds): set task `status` to `review`, add a note to `notes` field: `Conflict: status ambiguous between tasks.json and log as of [timestamp]. Human review required.`, and flag in reconciliation summary.

### Step 3 — Resolve Stale Handoffs

For each stale handoff in `handoffs/active.md`:

1. Read the current state of the referenced task(s) from tasks.json
2. Reconstruct the handoff content:
   - **"Completed" section**: preserve from the stale handoff (historical — don't rewrite history)
   - **"Blockers" section**: read from tasks.json `notes` field (current blockers)
   - **"Exact Next Step"**: use whichever version is more recent — if the task's `next_action` in tasks.json is newer than the handoff's timestamp, use `next_action`; otherwise preserve the handoff's "Exact Next Step"
   - **"Files Touched"**: preserve from stale handoff, append any new files from tasks.json `files` field
3. Overwrite the handoff block with the reconciled version
4. Add a "### Reconciliation Note" field at the end of the handoff:
   ```
   ### Reconciliation Note
   Refreshed by conflict-resolver at [ISO 8601 timestamp]. Reason: handoff was stale (original timestamp: [original timestamp]).
   ```

### Step 4 — Resolve Dashboard Drift

Dashboard is always derived. Never patch dashboard.md manually — regenerate it.

To regenerate dashboard.md:

1. Read `tasks.json` — collect:
   - All tasks with `status: in_progress` → current active work
   - The task with the highest priority that is `in_progress` → current priority task
   - The agent(s) who own `in_progress` tasks → current active agents
   - All tasks with `status: blocked` → blockers section
   - The 5 most recently completed tasks (status `done`, sorted by `updated_at` desc) → recently completed
   - All tasks with `status: ready` sorted by priority → up next

2. Read `handoffs/active.md`:
   - The most recent handoff's "Exact Next Step" → next action field
   - The handoff's `to:` field → receiving agent

3. Overwrite `dashboard.md` with the regenerated content using this template:

```markdown
# Agent Dashboard

> **Agents: Read this first. Update this last.**
> This file is derived from tasks.json and handoffs/active.md. Do not edit manually — run conflict-resolver to regenerate.
> Last regenerated: [ISO 8601 timestamp] by conflict-resolver

---

## Current Priority

[List top 3 in_progress or ready tasks by priority]

---

## Current State

| Field | Value |
|---|---|
| **Current Agent** | [owner of highest-priority in_progress task] |
| **Current Task ID** | [id of highest-priority in_progress task] |
| **Current Branch** | [read from git or leave as "unknown"] |
| **Last Completed Step** | [title of most recently completed task] |
| **Next Action** | [next_action from highest-priority in_progress task] |
| **Current Blockers** | [blocked task IDs and their blockers, or "None"] |

---

## Active Work

[Table of all in_progress tasks with ID, title, owner, priority, next_action]

---

## Blocked

[List of blocked tasks with blocker description]

---

## Up Next (Ready)

[List of ready tasks sorted by priority]

---

## Recently Completed

[Last 5 done tasks with ID, title, completed_at approximated from updated_at]

---

## Files To Watch

[Union of all `files` arrays from active in_progress tasks]
```

### Step 5 — Resolve Duplicate Task Updates

For confirmed race condition conflicts (two updates within 60 seconds):

- **If the fields differ in non-critical ways** (e.g., `notes` text differs): merge by **concatenating** the `notes` fields from both versions, separated by:
  ```
  --- [Agent A note, updated_at] ---
  [Agent A's notes]
  --- [Agent B note, updated_at] ---
  [Agent B's notes]
  ```
- **For `status` field conflicts**: apply the later timestamp's value. Log the discarded status.
- **For `next_action` field conflicts**: apply the later timestamp's value. Preserve the discarded value in `notes`.
- **If timestamps are within 60 seconds and you cannot determine which is authoritative**: set `status: review`, preserve both values in notes, and flag for human.

### Step 6 — Resolve Orphaned Log References

For each orphaned log entry (references a task ID not in tasks.json):

1. Do NOT delete the log entry — it is permanent record
2. Append a clarifying comment immediately after the orphaned entry in the log file:
   ```
   # [conflict-resolver] Task ID [AREA-NNN] not found in tasks.json at time of reconciliation ([timestamp]). This entry may reference a task that was deleted (not permitted) or never created. Preserved for audit.
   ```
3. Note the orphaned reference in the reconciliation summary as a warning

### Step 7 — Resolve Timestamp Anomalies

**Future timestamps** (updated_at is after current UTC time):
- Replace with the current UTC timestamp
- Add a note to the task's `notes` field: `[conflict-resolver] updated_at was in the future ([original value]). Corrected to [new value]. Possible clock skew.`

**Out-of-order log sequences**:
- Re-read the log file
- Sort all entries by their `## [HH:MM:SS]` timestamp headers
- Rewrite the log file with entries in chronological order
- Append at the end: `# [conflict-resolver] Log entries reordered at [timestamp] due to out-of-order sequence anomaly.`

**Stale in_progress tasks (>72 hours)**:
- Do not auto-change status — this is a warning only
- Append to the task's `notes`: `[conflict-resolver WARNING] Task has been in_progress for >72 hours as of [timestamp]. Verify this task is still actively being worked.`
- Flag in the reconciliation summary

---

## Phase 3 — Reconciliation Output

After resolving all conflicts, produce a reconciliation summary. This is mandatory — never skip it.

### Reconciliation Summary Format

Write the summary to `ai-context/logs/YYYY-MM-DD.md` as a log entry:

```markdown
## [HH:MM:SS] Conflict Resolution — conflict-resolver

### Conflicts Found
- [conflict type] in [file]: [brief description] — Severity: [critical/warning/info]
- ... (one line per conflict)
- Total: [N] conflicts ([X] critical, [Y] warnings, [Z] info)

### Actions Taken
- [action 1]: [what was done and why]
- [action 2]: ...

### Flagged for Human Review
- [item 1]: [why human review is needed]
- [item 2]: ...
- (or "None")

### Files Modified
- [file path] — [summary of change]
- ...

### Backup Location
ai-context.backup-[timestamp]/
```

### Console Output

If running interactively, print a summary to stdout in this format:

```
Antigravity Conflict Resolver
─────────────────────────────
Conflicts found: [N]
  Critical: [X]
  Warnings: [Y]
  Info:     [Z]

Actions taken: [N]
Flagged for human review: [N]

See today's log for full details.
```

---

## Phase 4 — Prevention Rules

Follow these rules in every agent session to minimize future conflicts:

### Read-Modify-Write for tasks.json
Always re-read `tasks.json` immediately before writing, even if you read it 30 seconds ago. Another agent may have written to it in the interim.

```
1. Read tasks.json
2. Make your change in memory
3. Write tasks.json
(Never cache a read and write to it later without re-reading)
```

### Task-Level Locking Check
Before overwriting a task entry:
1. Check the current `last_updated_by` and `updated_at`
2. If `last_updated_by` is a different agent than you, and `updated_at` is within the last 120 seconds, wait and re-read before writing
3. After writing, always update `last_updated_by` to your agent name and `updated_at` to the current ISO 8601 timestamp

### Handoff Write Protocol
Before writing to `handoffs/active.md`:
1. Read the current file
2. Check if there is an active handoff for the same task IDs you are about to write
3. If yes, and its timestamp is recent (within 5 minutes), do not overwrite — append a new block or update the existing one in place
4. If the existing handoff is stale, archive it first, then write your new handoff

### Dashboard Write Rule
Dashboard is derived state. The only permitted write operations on `dashboard.md` are:
- A full regeneration from tasks.json (Phase 2, Step 4 above)
- An automated update by a skill that has just modified tasks.json (and only to reflect that specific change)

Never edit dashboard.md manually to "fix" a discrepancy. Fix the source (tasks.json) and regenerate.

### Log Append Rule
Logs are append-only. Never:
- Delete a log entry
- Edit a past log entry's content (a correction note is acceptable, appended inline)
- Truncate a log file
- Replace a log file

When correcting a mistake in a log entry, append a correction note:
```markdown
# [conflict-resolver CORRECTION] The entry above contained an error. Correction: [what was wrong and correct value]. Logged at [timestamp].
```

---

## Examples

### Example 1 — Git Merge Conflict in tasks.json

You run `git merge feature/auth` and get a conflict in `ai-context/tasks.json`.

**Detection**: `grep -r "<<<<<<" ai-context/` confirms conflict markers in tasks.json.

**Resolution**:
1. Open tasks.json — identify the two sides of the conflict
2. Parse the task arrays from each side (HEAD vs incoming)
3. Merge: AUTH-007 appears in both — HEAD has `updated_at: 2026-04-02T10:00:00Z`, incoming has `updated_at: 2026-04-02T10:05:00Z`. Incoming wins.
4. UI-009 appears only in incoming — include it.
5. Write merged tasks.json, run `node scripts/validate-context.mjs`.
6. Regenerate dashboard.md from the merged tasks.json.
7. Append reconciliation to today's log.

### Example 2 — Task State Inconsistency

tasks.json shows `AUTH-005: status: in_progress, updated_at: 2026-04-01T14:00:00Z`.
`ai-context/logs/2026-04-01.md` has: `## [16:30:00] Completed AUTH-005 — JWT rotation fully implemented`.

**Detection**: Log timestamp (16:30) is later than tasks.json timestamp (14:00).

**Resolution**:
1. Log is newer → log's implied state wins
2. Update AUTH-005 status to `done` in tasks.json
3. Set `next_action` to `"No further action required"`
4. Update `last_updated_by` to `conflict-resolver`, `updated_at` to now
5. Regenerate dashboard.md
6. Append reconciliation log entry

### Example 3 — Stale Handoff

`handoffs/active.md` references `CRM-012` with `status: in_progress` in the handoff body.
tasks.json shows `CRM-012: status: done, updated_at: 2026-04-02T09:00:00Z`.

**Detection**: Handoff describes an in-progress task that is now done.

**Resolution**:
1. The task is done — this handoff is fully stale
2. Archive the handoff to `handoffs/archive/2026-04-02.md` with a note: `Archived by conflict-resolver — task CRM-012 is done`
3. Remove the CRM-012 block from active.md
4. Regenerate dashboard.md
5. Append reconciliation log entry

### Example 4 — Orphaned Log Reference

`ai-context/logs/2026-04-02.md` contains: `## [11:00:00] Updated INFRA-099 — deployed new worker`.
tasks.json has no task with ID `INFRA-099`.

**Detection**: task ID INFRA-099 not found in tasks.json.

**Resolution**:
1. Do not delete the log entry
2. Append inline comment: `# [conflict-resolver] INFRA-099 not found in tasks.json at reconciliation time (2026-04-02T...). Task may have been incorrectly deleted or never registered.`
3. Flag in reconciliation summary as a warning
4. Recommend creating a tasks.json entry retroactively if the work was real

---

## Constraints

- **Never discard log entries.** Logs are permanent. Corrections are always additive.
- **Never silently resolve ambiguous conflicts.** If you cannot confidently determine which version is authoritative, set the task to `review` and flag it for human review in the reconciliation output.
- **Always create a backup before bulk changes.** If resolving more than 3 files or more than 5 tasks, create a backup first.
- **Every resolution must be logged.** The reconciliation log entry is not optional.
- **Dashboard is never the source of truth.** When dashboard.md and tasks.json disagree, tasks.json wins.
- **Do not run detect-conflicts.mjs and immediately start resolving without reviewing the report.** Read the full report, then make a plan, then execute.
