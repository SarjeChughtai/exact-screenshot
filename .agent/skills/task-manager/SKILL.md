---
name: task-manager
description: |
  Create, read, update, and complete tasks in ai-context/tasks.json. Activate when managing the task backlog, creating new tasks, updating task status, changing ownership, prioritizing work, or marking tasks done. Trigger phrases: "create a task", "add a task", "update task", "mark as done", "change priority", "assign to", "task status", "new task for", "complete task", "archive task", "what tasks are", "prioritize", "task list", "open tasks", "update the task", "block task".
---

## Goal

Maintain `ai-context/tasks.json` as the single authoritative source of task state. Every operation on a task must leave the file valid, consistent, and reflective of real work state.

## Instructions

### Task Schema

Every task object in `tasks.json` must conform to this schema:

```json
{
  "id": "AREA-NNN",
  "title": "Short imperative description of work to be done",
  "status": "pending | ready | in_progress | blocked | review | done | archived",
  "priority": "low | medium | high | critical",
  "owner": "Claude | Codex | Aider | Cursor | Gemini | human",
  "last_updated_by": "agent-or-skill-name",
  "next_action": "Exact next step to advance this task",
  "notes": "Context, decisions referenced, dependencies, links",
  "area": "crm | auth | ui | api | infra | data | docs | (custom)",
  "files": ["relative/path/to/file.ts"],
  "updated_at": "2026-04-02T00:00:00Z"
}
```

**Required fields:** `id`, `title`, `status`, `priority`, `owner`, `last_updated_by`, `next_action`, `notes`, `updated_at`

**Optional but strongly recommended:** `area`, `files`

### Task ID Naming Convention

Format: `AREA-NNN` where:
- `AREA` is the uppercase area code (3–6 characters): `CRM`, `AUTH`, `UI`, `API`, `INFRA`, `DATA`, `DOCS`
- `NNN` is a zero-padded sequential number starting at `001` within the area

Examples: `CRM-001`, `AUTH-023`, `UI-007`, `INFRA-014`

To determine the next ID in an area: read tasks.json, filter by area, find the highest number, increment by 1.

### Valid Status Transitions

```
pending → ready
ready → in_progress
in_progress → review
in_progress → blocked
blocked → ready (when blocker is resolved)
blocked → in_progress
review → done
review → in_progress (revision requested)
done → archived
in_progress → done (only when code, context, log, and handoff are all updated — see Definition of Done)
```

**Forbidden transitions:** Do not move a task backward from `done` to any active state. Instead, create a new task for the follow-up work.

### Definition of Done

A task is `done` only when ALL of the following are true:

1. **Code updated** — the implementation, fix, or change is committed or saved
2. **Task state updated** — this task in tasks.json has `status: done` and `updated_at` is current
3. **Log appended** — a completion entry exists in today's `ai-context/logs/YYYY-MM-DD.md`
4. **Handoff refreshed** — `ai-context/handoffs/active.md` reflects the new state (or the handoff is archived if no further work follows)
5. **Decisions recorded** — any decisions made during this task are in `ai-context/decisions/`

If any of these are missing, the task is `review`, not `done`.

### Operations

#### CREATE — Adding a New Task

1. Read `tasks.json` to find the next available ID in the relevant area.
2. Build the task object following the schema. All required fields must be populated.
3. Set `status` to `pending` (not yet ready to work) or `ready` (can be picked up immediately).
4. Set `last_updated_by` to the agent or skill creating the task (e.g., `task-manager`).
5. Set `updated_at` to the current ISO 8601 timestamp.
6. Append the object to the tasks array in `tasks.json`.
7. Validate the updated file using `context-sync`'s validator if available.
8. Update `ai-context/dashboard.md` if the task is `critical` or `high` priority.

#### READ — Querying Tasks

When retrieving tasks, filter and present them in priority order:
1. `critical` in_progress
2. `high` in_progress
3. `critical` ready
4. `high` ready
5. `critical` / `high` blocked (flag blockers)
6. `medium` / `low` in_progress
7. `medium` / `low` ready

Present each task with: ID, title, status, priority, owner, next_action.

#### UPDATE — Changing Task Fields

1. Read `tasks.json`.
2. Find the task by ID (exact match on `id` field).
3. Update only the specified fields. Never clear fields that were not explicitly changed.
4. Always update `last_updated_by` and `updated_at` when modifying any field.
5. If updating `status`, verify the transition is valid per the status transition rules above.
6. If updating `owner`, also update `next_action` to reflect what the new owner should do.
7. Write the updated `tasks.json`.
8. If the status change is significant (e.g., → `done`, → `blocked`), follow the handoff-protocol.

#### COMPLETE — Marking a Task Done

1. Verify all Definition of Done criteria (see above). If any are missing, do not mark done.
2. Update `status` to `done`.
3. Set `next_action` to `"No further action required"`.
4. Update `last_updated_by` and `updated_at`.
5. Append completion to today's log.
6. Update `dashboard.md` to move the task to "Recently Completed".
7. Archive the handoff for this task if one exists in `handoffs/active.md`.

#### PRIORITIZE — Changing Priorities

1. When escalating to `critical`: notify via dashboard.md and flag to the orchestrator.
2. When de-prioritizing: update `priority` and add context in `notes` explaining why.
3. Never change a task's priority without updating `notes` to explain the change.
4. After reprioritizing, re-sort tasks in dashboard.md's display order.

#### ARCHIVE — Retiring Old Tasks

1. Move tasks to `archived` only when they are `done` AND older than the current sprint.
2. Never delete task entries from `tasks.json`. Archiving is the only retirement action.
3. Update `dashboard.md` to remove archived tasks from active views.

## Examples

**Example 1 — Creating a new task**

User: "Create a task for Codex to add email validation to the signup form."

```json
{
  "id": "UI-008",
  "title": "Add email validation to signup form",
  "status": "ready",
  "priority": "high",
  "owner": "Codex",
  "last_updated_by": "task-manager",
  "next_action": "Add Zod email validation to the SignupForm component in `components/auth/SignupForm.tsx` and display inline error messages",
  "notes": "Use the Zod schema pattern established in AUTH-003. Error messages must match the UX spec in decisions/form-validation-ux.md if it exists.",
  "area": "ui",
  "files": ["components/auth/SignupForm.tsx"],
  "updated_at": "2026-04-02T10:00:00Z"
}
```

**Example 2 — Blocking a task**

User: "AUTH-005 is blocked, waiting for the security audit."

1. Update `status` → `blocked`
2. Update `notes` → append "Blocked: awaiting security audit completion. Resume when audit report received."
3. Update `next_action` → "Wait for security audit report, then implement recommendations in lib/auth/"
4. Update `last_updated_by` and `updated_at`
5. Append to dashboard.md blocked section

**Example 3 — Query active tasks**

User: "What are the open tasks?"

Read tasks.json, filter status NOT IN [done, archived], sort by priority, present:

```
CRITICAL
  None

HIGH (in_progress)
  AUTH-007 [Codex] — Implement JWT refresh rotation
    Next: Write unit tests for token invalidation

HIGH (ready)
  UI-008 [Codex] — Add email validation to signup form
    Next: Add Zod validation to SignupForm.tsx

BLOCKED
  AUTH-005 — Waiting for security audit
```

## Constraints

- Never write a task without all required fields populated.
- Never use a task ID that already exists in tasks.json.
- Never mark a task `done` without satisfying the full Definition of Done.
- Never delete a task record. Use `archived` status.
- Do not modify `updated_at` without also updating `last_updated_by`.
- When the `status` field changes, the `next_action` field must also be updated to reflect the new state of work.
