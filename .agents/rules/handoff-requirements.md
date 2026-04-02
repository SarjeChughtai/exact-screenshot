# Handoff Requirements

These rules govern how agents transfer context to one another. Handoffs are the primary coordination mechanism in this multi-agent system. A poor handoff creates confusion, duplicated work, or lost context. A complete handoff allows the next agent to start immediately without asking questions.

---

## Core Principle

**A task is not done when the code is written. It is done when the next agent has everything they need to continue.**

---

## Required Handoff Fields

Every handoff document written to `ai-context/handoffs/active.md` must include all of the following:

| Field | Description |
|-------|-------------|
| `from_agent` | Name/identifier of the agent writing this handoff |
| `to_agent` | Name/identifier of the intended recipient (or `any` if open) |
| `timestamp` | ISO 8601 datetime of when the handoff was written |
| `completed` | Bulleted list of what was actually finished in this session |
| `blockers` | Bulleted list of known blockers; `none` if there are none |
| `exact_next_step` | A single, unambiguous action the next agent should take first |
| `files_touched` | List of every file that was created, modified, or deleted |

No field may be omitted. If a field has no content, write `none` — do not leave it blank or skip it.

---

## Handoff Format

```markdown
# Handoff

**From:** <agent_name>
**To:** <agent_name_or_any>
**Timestamp:** <ISO 8601>

## Completed
- <what was done>
- <what was done>

## Blockers
- <blocker> OR none

## Exact Next Step
<One specific, unambiguous action the next agent should take first.>

## Files Touched
- <path/to/file> — <brief description of change>
- <path/to/file> — <brief description of change>

## Context
<Any additional context the next agent needs. What decisions were made? What is the current state of the system? What should they watch out for?>
```

---

## Handoff Rules

### Explicitness
- Handoffs must be **explicit**, never implied. Do not assume the next agent will figure out where you left off from reading code comments or commit messages.
- Write the handoff as if the next agent has zero prior context about this task.

### Timing
- **Update `handoffs/active.md` before stopping** — even if stopping mid-task due to a blocker, time constraint, or error.
- A handoff written after stopping (from memory) is less reliable than one written at the moment of stopping.

### Archiving
- If a milestone was reached (a feature is complete, a phase is done, a significant task closed), **archive the previous handoff** before writing the new one.
- Move the old `active.md` to `ai-context/handoffs/archive/YYYY-MM-DD-<brief-slug>.md`.
- Then write the new `active.md` from scratch.

---

## Definition of Done

A task is complete **only when all five of the following are true:**

1. **Code updated** — The implementation change has been made and is correct.
2. **Task state updated** — `ai-context/tasks.json` reflects the new status.
3. **Log appended** — A log entry has been added to `ai-context/logs/YYYY-MM-DD.md`.
4. **Handoff refreshed** — `ai-context/handoffs/active.md` is current and complete.
5. **Decisions recorded** — Any non-trivial decision made during the task is in `ai-context/decisions/`.

Completing four of five is not done. All five must be satisfied.
