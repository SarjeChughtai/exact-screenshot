# Logging Standards

These rules govern how agents write log entries. Logs are the audit trail of this multi-agent system. They must be honest, specific, and useful to a future reader who has no context about what happened in your session.

---

## Core Principle

**A log entry that says "made progress on task" is worthless. A log entry that says what changed, why, what broke, and what comes next is valuable.**

Write logs for the future reader who is trying to understand what happened — not to signal that you did work.

---

## Required Fields per Log Entry

Every log entry must include:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 datetime (include timezone) |
| `agent_name` | Name/identifier of the agent writing this entry |
| `action_summary` | One or two sentences describing what was done |
| `files_changed` | List of files created, modified, or deleted (with full paths) |
| `blockers` | Current blockers, or `none` |
| `next_step` | The next concrete action to be taken |

Additionally, **reference the relevant task ID** from `tasks.json` in every entry.

---

## Log Entry Format

```markdown
## <ISO 8601 timestamp>

**Agent:** <agent_name>
**Task:** <task_id> — <task_title>

### Summary
<One to three sentences describing what was done in this session.>

### Files Changed
- `<path/to/file>` — <what changed>
- `<path/to/file>` — <what changed>

### Blockers
<Description of blockers, or `none`>

### Next Step
<The next concrete action to be taken.>
```

---

## File Naming

Log files live in `ai-context/logs/` and are named by date:

```
ai-context/logs/YYYY-MM-DD.md
```

- Use the date in the agent's operating timezone, formatted as `YYYY-MM-DD`.
- If a file for that date already exists, **append** to it — never overwrite it.
- If no file exists for that date, create it with a top-level heading: `# Log: YYYY-MM-DD`

---

## Append-Only

**Never overwrite a log file.** Log files are append-only. Each new session appends a new entry below the previous ones. The file grows over time and becomes a complete record of the day's work.

If you need to correct a previous log entry (e.g., you recorded something as complete that was not), add a **correction entry** with a new timestamp — do not edit the original.

---

## Specificity Rules

- **Confirmed vs. inferred** — Be explicit about what you directly verified versus what you believe to be true. Use language like "confirmed by reading the file" or "inferred from the error message — not yet verified."
- **File paths** — Always use full relative paths from the project root. Do not write "the config file" — write `config/environments/production.yml`.
- **Task IDs** — Always reference the task ID from `tasks.json`, not just the task title. Titles change; IDs should not.
- **Error messages** — If a command failed, include the actual error message or a precise description of it. Do not summarize vaguely.

---

## What Not to Log

- Do not log internal reasoning or chain-of-thought.
- Do not log actions you considered but did not take.
- Do not log things that had no effect on shared state.
- Do not write entries that only say a task is "in progress" without specifics.

Log what changed, why it changed, what is broken, and what comes next. Everything else is noise.
