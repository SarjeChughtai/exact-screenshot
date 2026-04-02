# Conflict Types Reference

This document defines every conflict type detectable in the Antigravity Agent OS shared memory layer (`ai-context/`). Each entry includes its definition, example, severity level, detection method, and resolution precedence.

---

## Overview

| # | Type | ID | Severity | Auto-Resolvable |
|---|------|----|----------|-----------------|
| a | Git Merge Conflict | `git_merge_conflict` | **Critical** | Partially |
| b | Task State Inconsistency | `task_state_inconsistency` | Critical / Warning | Yes (unless ambiguous) |
| c | Stale Handoff | `stale_handoff` | Warning | Yes |
| d | Dashboard Drift | `dashboard_drift` | Critical / Warning / Info | Yes (regenerate) |
| e | Duplicate Task Update | `duplicate_task_update` | Warning | Partially |
| f | Orphaned Log Reference | `orphaned_log_reference` | Warning | No (human check needed) |
| g | Timestamp Anomaly | `timestamp_anomaly` | Critical / Warning / Info | Partially |

**Resolution precedence** (when two sources conflict):

```
tasks.json (newer updated_at) > logs (newer timestamp) > handoffs (newer timestamp) > dashboard (never source of truth)
```

When timestamps are equal or within 60 seconds: flag for human review.

---

## (a) Git Merge Conflict

**ID**: `git_merge_conflict`

**Definition**: One or more `ai-context/` files contain git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) from an unresolved `git merge` or `git rebase`. Affected files are unparseable by agents and scripts.

**Severity**: Critical

**Detection**:
```bash
grep -rn "^<<<<<<" ai-context/
grep -rn "^=======$" ai-context/
grep -rn "^>>>>>>>" ai-context/
```

Or via the detect-conflicts script:
```bash
node .agent/skills/conflict-resolver/scripts/detect-conflicts.mjs --pretty
```

**Example**:
```
<<<<<<< HEAD
  { "id": "AUTH-007", "status": "in_progress", "updated_at": "2026-04-02T10:00:00Z" }
=======
  { "id": "AUTH-007", "status": "done", "updated_at": "2026-04-02T10:05:00Z" }
>>>>>>> feature/auth-review
```

**Resolution Rules**:

| File | Strategy |
|------|----------|
| `tasks.json` | Parse both sides. Merge task arrays by `id`. For duplicate IDs, the version with the **later `updated_at` wins**. |
| `handoffs/active.md` | Parse handoff blocks from both sides. Keep the block with the **later `timestamp:` field**. Archive the older one. |
| `dashboard.md` | Do not merge. **Regenerate entirely** from `tasks.json` and `handoffs/active.md`. |
| `logs/YYYY-MM-DD.md` | Keep **all entries from both sides**. Merge, sort chronologically, deduplicate identical entries. |
| Any other file | Keep the `HEAD` version (local) and manually review the incoming changes. |

**Auto-resolvable**: Partially. tasks.json and logs can be auto-resolved. Handoffs require timestamp parsing. Dashboard is always regenerated. Unknown file types require human intervention.

**Prevention**: Use feature branches for experimental agent work. Merge frequently to minimize divergence. Set up the GitHub Actions validation workflow to catch conflicts before merging.

---

## (b) Task State Inconsistency

**ID**: `task_state_inconsistency`

**Definition**: The `status` field in `tasks.json` for a task contradicts what the most recent log entry implies about that task's state.

**Severity**:
- **Critical** — when the contradiction is unambiguous and the timestamp difference is more than 60 seconds
- **Warning** — when the timestamps are within 60 seconds (ambiguous authorship)

**Detection**:
Compare `tasks.json` `updated_at` with the timestamp of the latest log entry mentioning each task ID. Look for semantic contradictions:
- Log says "completed INFRA-005" but `status` is `in_progress`
- Log says "blocked CRM-012" but `status` is `done`
- Log says "deployed AUTH-007" but `status` is `pending`

**Example**:

`tasks.json`:
```json
{
  "id": "AUTH-005",
  "status": "in_progress",
  "updated_at": "2026-04-01T14:00:00Z"
}
```

`ai-context/logs/2026-04-01.md`:
```markdown
## [16:30:00] Completed AUTH-005 — JWT rotation fully implemented and reviewed
```

Log timestamp (16:30) is 2.5 hours later than tasks.json update (14:00). Log is authoritative.

**Resolution Rules**:

| Condition | Action |
|-----------|--------|
| Log is newer than tasks.json | Update task `status` in tasks.json to match log's implied state |
| tasks.json is newer than log | Trust tasks.json. Append a clarifying note to the log. |
| Timestamps within 60 seconds | Set task to `review`, add conflict note to `notes`, flag for human |
| Both timestamps identical | Flag for human review — cannot determine authorship |

**Key rule**: A log that says "completed" always implies `done`. A log that says "started", "picked up", or "beginning" implies `in_progress`. A log that says "blocked" implies `blocked`. Handoff log entries do not imply a specific status change on their own.

**Auto-resolvable**: Yes (unless timestamps are ambiguous).

---

## (c) Stale Handoff

**ID**: `stale_handoff`

**Definition**: A handoff block in `handoffs/active.md` describes a task state that no longer matches `tasks.json`, or is over 48 hours old while the task remains `in_progress`.

**Sub-types**:
1. **State mismatch**: Handoff says task is `in_progress` but tasks.json says `done`
2. **Owner mismatch**: Handoff sends work to Agent A, but tasks.json shows Agent B owns the task
3. **Age threshold**: Handoff is >48 hours old and task is still unresolved
4. **Orphaned**: Handoff references a task ID that no longer exists in tasks.json

**Severity**: Warning (for all sub-types)

**Detection**:
- Read each handoff block's `task_ids:`
- Look up each ID in tasks.json
- Compare handoff's `timestamp:` to tasks.json `updated_at` and `status`
- Check `to:` agent in handoff headline matches tasks.json `owner`

**Example**:

`handoffs/active.md`:
```markdown
## Handoff: Codex → Claude
timestamp: 2026-04-01T09:00:00Z
task_ids: [CRM-012]

### Exact Next Step
Review CRM-012 contact deduplication algorithm...
```

`tasks.json`:
```json
{ "id": "CRM-012", "status": "done", "updated_at": "2026-04-02T11:00:00Z" }
```

Task is done — handoff is stale and should be archived.

**Resolution Rules**:

| Sub-type | Action |
|----------|--------|
| State mismatch (task done) | Archive handoff to `handoffs/archive/YYYY-MM-DD.md`. Remove from `active.md`. |
| Owner mismatch | Update handoff's `from → to` to reflect current owner. Preserve original completed work list. |
| Age threshold (>48h) | Refresh handoff: re-read tasks.json, update "Exact Next Step" from `task.next_action`, re-stamp timestamp, add reconciliation note. |
| Orphaned (task not in tasks.json) | Archive the handoff. Flag in reconciliation summary. |

**Preservation rule**: Never delete the "Completed" section of a handoff during reconciliation — it is historical record.

**Auto-resolvable**: Yes.

---

## (d) Dashboard Drift

**ID**: `dashboard_drift`

**Definition**: `dashboard.md` shows state (current agent, current task, blockers, recently completed) that does not match what `tasks.json` and `handoffs/active.md` reflect.

**Severity**:
- **Critical** — "Current Task ID" references a task that doesn't exist in tasks.json
- **Warning** — "Current Agent" doesn't match task owner, blocked section missing despite blocked tasks
- **Info** — Stale task IDs in sections like "Recently Completed" that have since changed state

**Fundamental rule**: Dashboard is **always derived state**. It is never the source of truth. When dashboard and tasks.json disagree, tasks.json wins — always.

**Detection**:
- Extract "Current Task ID" from dashboard table → verify task exists and is `in_progress` in tasks.json
- Extract "Current Agent" from dashboard table → verify an `in_progress` task has this `owner` in tasks.json
- Extract all task ID references in dashboard → verify each exists in tasks.json
- Check if tasks.json has any `blocked` tasks but dashboard has no Blocked section

**Example**:

`dashboard.md`:
```markdown
| **Current Agent** | Codex |
| **Current Task ID** | UI-007 |
```

`tasks.json`:
```json
{ "id": "UI-007", "status": "done", "owner": "Claude", "updated_at": "2026-04-02T10:00:00Z" }
```

UI-007 is done and Claude is the owner — both dashboard fields are wrong.

**Resolution Rules**:

Dashboard drift is **always resolved by regeneration**, never by patching.

Steps:
1. Read all tasks.json `in_progress` tasks → determine current agent and task
2. Read `handoffs/active.md` → determine next action
3. Read all `blocked` tasks → blockers section
4. Read all `done` tasks sorted by `updated_at` desc → recently completed (top 5)
5. Read all `ready` tasks sorted by priority → up next
6. Overwrite `dashboard.md` with regenerated content
7. Add "Last regenerated" timestamp

**Auto-resolvable**: Yes (always regenerate).

---

## (e) Duplicate Task Update

**ID**: `duplicate_task_update`

**Definition**: The same task was updated by two different agents within a 60-second window, creating a potential race condition where one agent's changes may have silently overwritten another's.

**Severity**: Warning

**Detection**:
- Scan log files for two entries referencing the same task ID within 60 seconds
- Compare `last_updated_by` field in tasks.json with what the log entries report

**Example**:

`ai-context/logs/2026-04-02.md`:
```markdown
## [14:30:00] Claude updated AUTH-007 — set status to review
...
## [14:30:45] Codex updated AUTH-007 — set status to in_progress
```

Both agents updated AUTH-007 within 45 seconds. One update overwrote the other.

**Resolution Rules**:

| Field type | Rule |
|------------|------|
| `status` | Apply the **later timestamp's** value |
| `next_action` | Apply the **later timestamp's** value. Preserve the overwritten value in `notes`. |
| `notes` | **Concatenate both** with separator: `--- [Agent, timestamp] ---` |
| `owner` | Apply the **later timestamp's** value |
| `priority` | Apply the **later timestamp's** value. Require a note explaining the change. |
| Any field | If timestamps within 60s **and** values conflict: set to `review`, flag for human |

**60-second rule**: If two conflicting updates both occurred within 60 seconds of each other and you cannot determine which is authoritative (e.g., no secondary source like a log entry), set the task to `review` status and require human decision. Never silently discard a change.

**Prevention**:
- Always re-read tasks.json immediately before writing
- Check `last_updated_by` and `updated_at` before overwriting a task
- If `last_updated_by` is a different agent and `updated_at` is within 120 seconds of now, wait 5 seconds and re-read

**Auto-resolvable**: Partially. Field-level merges can be automated. Status conflicts within 60 seconds require human review.

---

## (f) Orphaned Log Reference

**ID**: `orphaned_log_reference`

**Definition**: A log entry references a task ID that does not exist in `tasks.json`. This indicates either a task was incorrectly deleted (a policy violation — tasks must only be archived, never deleted), a task was created in a branch that was never merged, or a log entry was copied from another project.

**Severity**: Warning

**Detection**:
- Scan all log files for task ID patterns (`[A-Z]+-\d{3,}`)
- For each referenced task ID, verify it exists in tasks.json
- IDs that appear in logs but not in tasks.json are orphaned

**Example**:

`ai-context/logs/2026-04-02.md`:
```markdown
## [11:00:00] Updated INFRA-099 — deployed new worker node
Task: INFRA-099
```

`tasks.json`: no task with ID `INFRA-099` exists.

INFRA-099 is orphaned — either it was deleted (violation), or it existed on a branch that wasn't merged.

**Resolution Rules**:

1. **Never delete the log entry** — logs are append-only
2. Append an inline comment immediately after the orphaned entry:
   ```
   # [conflict-resolver] Task INFRA-099 not found in tasks.json at [timestamp].
   # Task may have been deleted (policy violation) or exists only on an unmerged branch.
   # Preserved for audit. Consider restoring the task record if the work was real.
   ```
3. Flag in the reconciliation summary as a warning
4. **If the work was real**, recommend creating a retroactive tasks.json entry with `status: done` and `updated_at` matching the log entry date
5. **If this is a deleted task**, investigate who deleted it and why (git log is your friend)

**Human review required**: Yes — cannot auto-determine whether the task should be restored.

**Auto-resolvable**: No.

---

## (g) Timestamp Anomaly

**ID**: `timestamp_anomaly`

**Sub-types**:

### g1. Future Timestamp

**Definition**: A task's `updated_at` value is after the current UTC time.

**Severity**: Warning

**Cause**: Clock skew between machines, manually entered wrong date, or copy-paste error from a future-dated template.

**Example**:
```json
{ "id": "SYS-001", "updated_at": "2027-01-01T00:00:00Z" }
```
Current time is 2026-04-02 — timestamp is 9 months in the future.

**Resolution**: Replace with `new Date().toISOString()`. Append to task `notes`: `[conflict-resolver] updated_at was in the future (${original value}). Corrected to ${new value}. Possible clock skew or manual entry error.`

---

### g2. Out-of-Order Log Sequence

**Definition**: Entries within a single log file are not in ascending chronological order by their `## [HH:MM:SS]` timestamp headers.

**Severity**: Info

**Cause**: Two agents appended to the same log file concurrently, or an entry was manually inserted at the wrong position.

**Example**:
```markdown
## [14:30:00] Claude: Started review of AUTH-007
## [12:15:00] Codex: Completed AUTH-006      ← out of order
## [14:45:00] Claude: Review complete
```

**Resolution**: Re-sort all entries by timestamp. Append at end: `# [conflict-resolver] Entries re-sorted at ${timestamp} due to out-of-order sequence.`

---

### g3. Stale In-Progress Task

**Definition**: A task has `status: in_progress` and `updated_at` older than 72 hours.

**Severity**: Warning

**Cause**: Agent crashed, session ended without handoff, or task was forgotten.

**Example**:
```json
{ "id": "INFRA-003", "status": "in_progress", "updated_at": "2026-03-28T09:00:00Z" }
```
If current date is 2026-04-02, this task has been `in_progress` for 5 days.

**Resolution**: Do not auto-change status (the agent may genuinely be working on it). Append to `notes`: `[conflict-resolver WARNING] Task has been in_progress for ${N} hours as of ${timestamp}. Verify this task is still actively being worked.` Flag in reconciliation summary for human review.

---

### g4. Invalid Timestamp Format

**Definition**: An `updated_at` field contains a value that is not a valid ISO 8601 datetime string.

**Severity**: Critical

**Example**:
```json
{ "id": "CRM-001", "updated_at": "April 2nd" }
```

**Resolution**: Replace with the current ISO 8601 timestamp. Append to notes: `[conflict-resolver] updated_at contained invalid value "${original}". Replaced with current timestamp.`

---

## Resolution Precedence Rules

When two sources of information conflict, apply this hierarchy:

### Tier 1 — Most Authoritative
- `tasks.json` with a **newer `updated_at`** timestamp
- A log entry with a **newer timestamp** than the tasks.json `updated_at`

### Tier 2 — Secondary Authority
- `handoffs/active.md` with a newer `timestamp:` field than tasks.json
- A completed handoff block where the task has transitioned state

### Tier 3 — Derived State (Never Authoritative)
- `dashboard.md` — always regenerated, never used to resolve conflicts

### Tie-Breaking Rules

| Scenario | Rule |
|----------|------|
| Two tasks.json versions, same `updated_at` | Compare field by field. Merge notes. Flag status conflicts for human. |
| Log and tasks.json within 60 seconds | Set task to `review`. Flag for human. |
| Two handoff blocks for same task | Later `timestamp:` wins. Archive older. |
| Orphaned reference | Preserve log. Do not infer task state. |
| Future timestamp | Replace with current time. Log the correction. |

---

## Severity Level Definitions

### Critical
The conflict makes one or more shared files unparseable or renders the state irreconcilably wrong. Agents **cannot safely continue work** until this is resolved. Example: git merge conflict markers in tasks.json, a "Current Task ID" that doesn't exist.

### Warning
The conflict creates inconsistency that could cause agents to make wrong decisions, but files are still parseable. Should be resolved **before starting the next agent session**. Example: stale handoff, task status mismatch, dashboard drift.

### Info
A minor anomaly that doesn't affect current operation but indicates a process violation or data quality issue. Resolve opportunistically. Example: out-of-order log entries, missing optional fields in tasks.json.

---

## Conflict Frequency by Scenario

| Scenario | Likely Conflict Types |
|----------|-----------------------|
| `git merge` after parallel branches | `git_merge_conflict`, `task_state_inconsistency`, `dashboard_drift` |
| Two agents active simultaneously | `duplicate_task_update`, `task_state_inconsistency` |
| Agent session crash / no handoff | `stale_handoff`, `timestamp_anomaly` (stale in_progress) |
| Starting a new session after 48h+ | `stale_handoff`, `dashboard_drift`, `timestamp_anomaly` |
| Manual file editing | `timestamp_anomaly` (invalid format), `orphaned_log_reference` |
| Clock skew between machines | `timestamp_anomaly` (future timestamp), `task_state_inconsistency` |

---

## Quick Reference: Conflict Detector Output

The detect-conflicts script outputs a JSON report in this shape:

```json
{
  "generated_at": "2026-04-02T00:00:00.000Z",
  "repo_root": "/path/to/repo",
  "conflicts": [
    {
      "type": "task_state_inconsistency",
      "file": "ai-context/tasks.json",
      "description": "Task AUTH-007 has status 'in_progress' but latest log implies 'done'",
      "severity": "critical",
      "suggested_resolution": "Update AUTH-007 status to 'done' in tasks.json",
      "taskId": "AUTH-007"
    }
  ],
  "detection_errors": [],
  "summary": {
    "total": 1,
    "critical": 1,
    "warnings": 0,
    "info": 0
  }
}
```

**Exit codes**:
- `0` — no conflicts, or only info-level
- `1` — critical conflicts found
- `2` — warnings found, no criticals (only when `--quiet` flag used)
