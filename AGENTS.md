# Agent Instructions & Memory Rules

This file serves as the universal instruction manual for any AI agent working on the Canada Steel Portal repo.

## 🧠 The Brain System
This repository uses a structured memory system in the `/brain` folder. All agents MUST respect this system to ensure continuity across tools (Antigravity, Cursor, Copilot, etc.).

### Mandatory Workflow
1. **Startup**: Read `/brain/active/NEXT_AGENT.md` and `/brain/active/CURRENT_STATE.md`.
2. **Context**: Read `/brain/core/DECISIONS.md` and `/brain/core/STANDARDS.md`.
3. **Execution**: Perform the assigned task.
4. **Checkpoint**: Update `/brain/active/CHECKPOINT.md` and `/brain/active/CURRENT_STATE.md` after meaningful steps.
5. **Handoff**: Before stopping, update `/brain/active/NEXT_AGENT.md` and append to `/brain/history/SESSION_LOG.md`.

## 📜 Key Documentation
- **Current State**: [CURRENT_STATE.md](brain/active/CURRENT_STATE.md)
- **Decisions**: [DECISIONS.md](brain/core/DECISIONS.md)
- **Standards**: [STANDARDS.md](brain/core/STANDARDS.md)
- **Task Board**: [TASK_BOARD.md](brain/active/TASK_BOARD.md)

## 🛠️ Tool-Specific Rules
- **Antigravity**: Follow the skills defined in `.agent/skills`. Use `/brain` for all persistent memory.
- **Cursor**: Respect `.cursorrules`. It is configured to prioritize `/brain`.
- **Copilot**: Follow `.github/copilot-instructions.md`.

## ⚠️ Critical Rule
**NO AGENT SHOULD RELY ONLY ON CHAT HISTORY.** 
If it isn't in `/brain`, it doesn't exist for the next agent. Always write your progress to the files.
