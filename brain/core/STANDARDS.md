# Operational Standards: AI Memory & Handoff

These standards must be followed by all AI agents (Antigravity, Cursor, Copilot, etc.) interacting with this repository.

## 📖 Read Order Before Work
Before performing any coding or detailed planning, agents MUST read in this order:
1. `/brain/active/NEXT_AGENT.md` (Immediate priority)
2. `/brain/active/CURRENT_STATE.md` (Objective & Constraints)
3. `/brain/core/DECISIONS.md` (Architectural Context)
4. `/brain/active/TASK_BOARD.md` (Active Worklist)

## ✍️ Checkpoint Rules
Agents MUST update memory at least once per hour or after:
- Every meaningful project step.
- Major file edits (more than 5 files).
- Before large outputs or risky architectural changes.
- Whenever the session is getting long or token count is high.

### Steps to Checkpoint:
1. Update `/brain/active/CHECKPOINT.md`.
2. Update `/brain/active/CURRENT_STATE.md` if the overarching status has changed.
3. Update `/brain/history/SESSION_LOG.md` with relevant details for the current task.

## 🛑 Stop & Handoff Rules
Before concluding a session, agents MUST:
1. Update `/brain/active/CURRENT_STATE.md` with the final status.
2. Populate `/brain/active/NEXT_AGENT.md` using the `HANDOFF_TEMPLATE.md`.
3. Append a summary of the session to `/brain/history/SESSION_LOG.md`.
4. Ensure the `TASK_BOARD.md` accurately reflects the work completed and what is pending.

## 🛠️ Tool-Specific Compliance
- **Cursor**: Use `.cursorrules` to enforce these standards.
- **Antigravity**: Use `AGENTS.md` and related skills.
- **Copilot**: Use `.github/copilot-instructions.md`.

## 📜 Content Quality
- **Concise**: No fluff. Only status and facts.
- **Durable**: Avoid language that only makes sense in the current chat history.
- **Linked**: Reference other files in `/brain` or `docs/` using relative paths.
