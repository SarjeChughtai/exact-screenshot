# Handoff Checklist

Quick reference for the `handoff-protocol` skill. Run through this list before every handoff.

---

## Pre-Handoff (Before Writing Anything)

- [ ] All code changes are saved and committed (or explicitly noted as uncommitted in the handoff)
- [ ] Tests for modified files pass — or failures are documented with context
- [ ] Any new decisions (architecture, naming, environment, policy) have a decision record in `ai-context/decisions/`
- [ ] The task's current status in `tasks.json` accurately reflects the state of work

---

## Handoff Entry (Required Fields — All Must Be Present)

- [ ] `from_agent` — who is handing off
- [ ] `to_agent` — who is receiving (be specific: "Claude", "Codex", not "the next agent")
- [ ] `timestamp` — current ISO 8601 datetime (e.g., `2026-04-02T14:30:00Z`)
- [ ] `task_ids` — all task IDs this handoff covers (from tasks.json)
- [ ] `completed` — at least one specific completed item (not vague; name the file/function/endpoint)
- [ ] `blockers` — either a description of blockers or explicitly "None"
- [ ] `exact_next_step` — single, unambiguous action for the receiving agent to take first
- [ ] `files_touched` — every file that was created, modified, or deleted, with a one-line description

---

## Post-Handoff Updates

- [ ] `ai-context/tasks.json` updated:
  - [ ] `status` updated (in_progress → review, or owner changed)
  - [ ] `owner` changed to receiving agent
  - [ ] `last_updated_by` set to sending agent
  - [ ] `next_action` matches the handoff's "Exact Next Step"
  - [ ] `updated_at` set to current timestamp

- [ ] `ai-context/handoffs/active.md` updated with new handoff block
- [ ] Previous handoff archived (if task reached a milestone)
- [ ] `ai-context/logs/YYYY-MM-DD.md` appended with handoff summary line
- [ ] `ai-context/dashboard.md` updated:
  - [ ] Sending agent removed from "Active Agents" (if session ending)
  - [ ] Receiving agent added with task IDs
  - [ ] Completed tasks moved to "Recently Completed" section
  - [ ] Blocked tasks moved to "Blocked" section if applicable

---

## Quality Check (Read the Handoff Before Sending)

- [ ] "Exact Next Step" can be executed without reading additional files beyond those listed in "Files Touched"
- [ ] No ambiguous pronouns ("it", "that thing") — all references are explicit
- [ ] Any rejected approaches or assumptions are captured in "Notes"
- [ ] The receiving agent could start working in under 2 minutes using only the handoff

---

## Common Mistakes to Avoid

| Mistake | Correct Approach |
|---------|-----------------|
| "Worked on the auth module" | "Implemented `validateRefreshToken()` in `lib/auth/tokens.ts`, lines 45-92" |
| Leaving `next_action` as "Continue implementation" | "Implement `createOrder()` in `lib/orders/create.ts` following the schema in ORDER-005 notes" |
| Forgetting to update `tasks.json` | Always update tasks.json BEFORE writing the handoff |
| Writing a handoff and forgetting the archive | Check if any previously active handoffs are now obsolete and move them to archive |
| Listing files touched as "various files" | List every file individually — no exceptions |
