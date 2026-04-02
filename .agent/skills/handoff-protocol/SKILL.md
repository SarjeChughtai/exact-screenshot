---
name: handoff-protocol
description: |
  Enforces structured, complete handoffs between agents. Activate when finishing work, switching agents, ending a session, or passing a task to another agent. Trigger phrases: "hand off to", "passing to", "done for now", "ending session", "next agent should", "handing over", "switching to Codex", "Claude takes over", "wrap up", "create a handoff", "write a handoff", "session complete", "done with my part".
---

## Goal

Ensure that when one agent finishes work and another begins, the receiving agent has every piece of context needed to continue without interruption. Zero context loss between agents is the standard.

## Instructions

### Step 1 — Confirm Completion Criteria Are Met

Before writing a handoff, verify that the work being handed off is actually complete:

- All code changes are saved (no unsaved buffers).
- Tests relevant to changed files pass (or failures are documented in the handoff).
- If a new decision was made (architecture, naming, environment, policy), it has been logged via the `decision-logger` skill.
- The task's `next_action` field in tasks.json reflects what the receiving agent should do next, not what the sending agent just did.

If any of these are unmet, resolve them before writing the handoff. A handoff written for incomplete work creates technical debt.

### Step 2 — Write the Handoff Entry

Append a new handoff block to `ai-context/handoffs/active.md`. Every handoff MUST include all of the following fields — no optional fields, no skipping:

```markdown
---
## Handoff: [FROM_AGENT] → [TO_AGENT]
timestamp: [ISO 8601 datetime, e.g., 2026-04-02T14:30:00Z]
task_ids: [AREA-NNN, AREA-NNN]

### Completed
- [Specific item 1 — be precise, not vague. "Implemented POST /api/orders route with Zod validation" not "worked on orders"]
- [Specific item 2]

### Blockers
- [Blocker description + context, or "None"]

### Exact Next Step
[Single, unambiguous action the receiving agent must take first. Example:
"Run `node scripts/migrate.mjs` to apply the pending schema migration, then update ORDER-005 status to in_progress and implement the order confirmation email in `lib/email/order-confirm.ts`."]

### Files Touched
- path/to/file1.ts — [brief description of change]
- path/to/file2.json — [brief description of change]

### Notes
[Any context that doesn't fit above: assumptions made, failed approaches tried, relevant decision records, links.]
---
```

Replace all placeholder text. Do not leave empty sections — write "None" if a section has no content.

### Step 3 — Archive Previous Handoff (If Milestone Reached)

A handoff should be archived when:
- A task moves from `in_progress` to `done`.
- A sprint milestone or significant feature is completed.
- The active handoff references a task that is no longer relevant.

To archive:
1. Cut the completed handoff block from `ai-context/handoffs/active.md`.
2. Append it to `ai-context/handoffs/archive/YYYY-MM-DD.md` (create the archive file if it does not exist).
3. Add a one-line summary in `ai-context/handoffs/active.md` under an `## Archived Today` section.

Do not delete handoff records — always move to archive.

### Step 4 — Update Task Status

For every task ID referenced in the handoff:

1. Open `ai-context/tasks.json`.
2. Update the task's `status`:
   - If work is complete and ready for review → `review`
   - If work is in progress and being handed to another agent → keep `in_progress`, update `owner`
   - If blocked → `blocked`, add blocker to `notes`
3. Update `owner` to the receiving agent's name.
4. Update `last_updated_by` to the sending agent's name.
5. Update `next_action` to match the "Exact Next Step" from the handoff.
6. Update `updated_at` to the current ISO 8601 timestamp.

### Step 5 — Append to Today's Log

Append a log entry to `ai-context/logs/YYYY-MM-DD.md` (create the file if it does not exist):

```markdown
## [HH:MM:SS] Handoff: [FROM_AGENT] → [TO_AGENT]
Task(s): [AREA-NNN]
Summary: [One sentence describing what was completed]
Next: [One sentence describing what the receiving agent will do]
```

Keep log entries brief. Logs are a timeline, not documentation.

### Step 6 — Update dashboard.md

Open `ai-context/dashboard.md` and:
- Remove the sending agent from the "Active Agents" section.
- Add the receiving agent to the "Active Agents" section with their assigned task IDs.
- If a task moved to `done`, move it from "In Progress" to "Recently Completed".
- If a task is now `blocked`, add it to the "Blocked" section with the blocker description.

### Step 7 — Verify Receiving Agent Can Self-Onboard

Read the handoff entry you just wrote and confirm:
- The "Exact Next Step" contains enough information to act without reading the full codebase.
- The "Files Touched" list is complete (no modified files missing from the list).
- Any prerequisite knowledge (decisions made, approaches rejected) is captured in "Notes".
- The task IDs in the handoff all exist in tasks.json with correct statuses.

If the handoff passes this check, it is ready. If not, revise it.

## Examples

**Example 1 — Codex finishes implementation, hands to Claude for review**

```markdown
---
## Handoff: Codex → Claude
timestamp: 2026-04-02T16:45:00Z
task_ids: [AUTH-007]

### Completed
- Implemented JWT refresh token rotation in `lib/auth/tokens.ts`
- Added refresh endpoint at `app/api/auth/refresh/route.ts`
- Wrote 12 unit tests in `lib/auth/__tests__/tokens.test.ts` — all passing
- Updated `ai-context/decisions/jwt-refresh-strategy.md` with implementation notes

### Blockers
- None

### Exact Next Step
Review `lib/auth/tokens.ts` and `app/api/auth/refresh/route.ts` for security correctness. Pay particular attention to the token invalidation logic in `invalidateFamily()` (line 87). Update AUTH-007 status to `done` if approved, or create AUTH-008 with specific revision requests if not.

### Files Touched
- lib/auth/tokens.ts — new file, JWT rotation implementation
- app/api/auth/refresh/route.ts — new file, refresh endpoint
- lib/auth/__tests__/tokens.test.ts — new file, 12 unit tests
- ai-context/decisions/jwt-refresh-strategy.md — updated with implementation notes

### Notes
Considered using opaque tokens instead of JWTs — rejected because client-side expiry checking is needed. See decision record for full rationale.
---
```

**Example 2 — Session ending mid-task, same agent will resume**

```markdown
---
## Handoff: Claude → Claude
timestamp: 2026-04-02T23:00:00Z
task_ids: [CRM-012]

### Completed
- Designed the contact deduplication algorithm (see decisions/contact-dedup-algorithm.md)
- Scaffolded `lib/crm/dedup/` directory with placeholder files

### Blockers
- Need to confirm whether the Supabase `contacts` table has a GIN index on the `email` column before implementing the search step. Check with `psql` or Supabase dashboard.

### Exact Next Step
Confirm the GIN index exists on `contacts.email`. If yes, implement `findDuplicates()` in `lib/crm/dedup/finder.ts` following the algorithm in the decision record. If no, create a migration to add it first using the `safe-executor` skill for the migration command.

### Files Touched
- lib/crm/dedup/finder.ts — stub only, implementation pending
- lib/crm/dedup/merger.ts — stub only, implementation pending
- ai-context/decisions/contact-dedup-algorithm.md — new decision record

### Notes
The algorithm uses a multi-pass approach: exact email match → fuzzy name match → phone match. Confidence threshold is 0.85. Do not lower this threshold without a new decision record.
---
```

## Constraints

- **Never skip a required handoff field.** A handoff missing `exact_next_step` or `files_touched` is invalid.
- **Never write a handoff before updating tasks.json.** The task state must reflect the handoff before the handoff is written.
- **Handoffs are immutable once written.** If you need to correct a handoff, write a new one with a correction note — do not edit the original.
- **The "Exact Next Step" must be a single action**, not a list. If multiple steps are needed, pick the first and put the rest in "Notes".
- **Archive aggressively.** active.md should contain only handoffs for tasks currently in-flight. Completed task handoffs belong in the archive.
