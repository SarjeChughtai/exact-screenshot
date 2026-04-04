# The Brain Memory System

This repository uses a structured, tool-agnostic agent memory and handoff system located in the `/brain` folder.

## 🎯 Purpose
The Brain system ensures that different AI coding tools (Antigravity, Cursor, Copilot, etc.) and human developers can switch between each other without losing project context.

## 🧠 Structure
- **/active**: Real-time state tracking.
    - `CURRENT_STATE.md`: Project objective and status.
    - `NEXT_AGENT.md`: Handoff for the next session.
    - `TASK_BOARD.md`: Active tasks.
    - `CHECKPOINT.md`: Quick session state capture.
- **/core**: Permanent project knowledge.
    - `DECISIONS.md`: Architectural choices and rationale.
    - `ARCHITECTURE.md`: High-level system overview.
    - `STANDARDS.md`: Operational coding and memory standards.
- **/history**: Past sessions and logs.
    - `SESSION_LOG.md`: Log of every session.
- **/templates**: Standardized formats for memory files.

## 📘 How to Use with Obsidian
The `/brain` folder is designed to be compatible with Obsidian.

### Recommended Workflow
1. **Open as Vault**: Open the project root as an Obsidian vault.
2. **Focus on /brain**: Use the `/brain` directory to manage your development workflow.
3. **Internal Links**: Files in `/brain` use relative markdown links, making them easy to navigate in Obsidian.
4. **Symlink (Optional)**: If you want to merge this brain into a main vault:
   `mklink /D "path\to\your\vault\CanadaSteel_Brain" "c:\path\to\this\repo\brain"`

## 🛑 Operational Order
All agents and tools MUST:
1. **Read** `brain/active/NEXT_AGENT.md` and `brain/active/CURRENT_STATE.md` before work.
2. **Update** `brain/active/CHECKPOINT.md` during work.
3. **Finalize** `brain/active/NEXT_AGENT.md` and `brain/history/SESSION_LOG.md` before stopping.

## 🔗 Legacy Docs
The project formerly used `docs/ai_context/`. This is now the historical and reference layer. The operational layer is now in `/brain`.
