# Context Discipline

These rules govern how agents read and write shared memory. The context files are the coordination layer of this multi-agent system. Keeping them accurate and current is a core responsibility of every agent.

---

## Core Principle

**Chat history is ephemeral. The context files are the memory of this system.** Every agent must treat `ai-context/` as the source of truth and maintain it accordingly.

---

## Before Starting Work

Every agent must read the following files before taking any action on a task:

| File | Purpose |
|------|---------|
| `ai-context/project.md` | Project goals, architecture, guiding principles |
| `ai-context/dashboard.md` | Active sprint, agent assignments, overall status |
| `ai-context/tasks.json` | Structured task list with statuses, owners, metadata |
| `ai-context/agents.md` | Agent roster, capabilities, current assignments |
| `ai-context/handoffs/active.md` | Most recent handoff from the previous agent |

- If a file is missing, note that explicitly before proceeding.
- Do not substitute prior chat context for these files.
- Do not assume the context from a previous session is still accurate — always re-read.

---

## After Meaningful Work

Every agent must update shared memory after completing any meaningful unit of work.

**What counts as meaningful work:**
- Completing a task or subtask
- Modifying any file
- Discovering a blocker or unexpected condition
- Making a non-trivial decision
- Stopping mid-task for any reason

**What must be updated:**
1. `ai-context/tasks.json` — Reflect the new task status and any updated metadata.
2. `ai-context/logs/YYYY-MM-DD.md` — Append a log entry. Never overwrite.
3. `ai-context/handoffs/active.md` — Overwrite with the current handoff document.
4. `ai-context/decisions/` — Add a decision record if a non-trivial decision was made.

---

## Prohibitions

- **Never keep important context only in chat history.** If it matters, write it to a file.
- **Never close a task without updating `tasks.json`.** A task is incomplete until the file says it is complete.
- **Never stop working without refreshing `handoffs/active.md`.** The next agent must be able to pick up where you left off.
- **Never remove useful handoff context without replacing it.** If you archive a handoff, the replacement must be equally complete.
- **Never bury task information in free-form notes.** Tasks must remain structured in `tasks.json`, not scattered across markdown prose.

---

## Task Structure

Tasks live in `ai-context/tasks.json` as structured JSON. Every task must have:

- `id` — Unique identifier
- `title` — Short human-readable name
- `status` — One of: `pending`, `in_progress`, `blocked`, `complete`
- `owner` — Which agent or human is responsible
- `created_at` — ISO 8601 timestamp
- `updated_at` — ISO 8601 timestamp (updated every time the task changes)
- `blockers` — Array of blocking issues, empty if none
- `notes` — Optional freeform field for context that doesn't fit elsewhere

Do not use free-form markdown files as a substitute for structured task tracking.

---

## Decision Records

Non-trivial decisions must be recorded in `ai-context/decisions/`. A decision is non-trivial if:

- It affects architecture, data model, or system boundaries
- It changes a convention or pattern used across multiple files
- It chooses one approach over a meaningful alternative
- It will not be obvious to the next agent why it was made

Decision records do not need to be long. A filename, a one-sentence summary of the choice, and a brief rationale are sufficient.

---

## Log Discipline

Logs in `ai-context/logs/` must be appended — never overwritten. See `logging-standards.md` for the required format.
