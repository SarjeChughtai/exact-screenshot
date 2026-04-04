# Brain Architecture: Canada Steel Memory System

## 🧠 Brain Structure
The `/brain` folder is the operational memory layer for AI agents. It ensures context persistence across different coding tools (Antigravity, Cursor, Copilot) and is compatible with Obsidian.

### /active
Includes files that track the current state and next steps of the project. Updated frequently by agents.
- `CURRENT_STATE.md`: The single source of truth for project objectives and status.
- `NEXT_AGENT.md`: Handoff instructions for the next agent session.
- `TASK_BOARD.md`: Active task list and progress tracking.
- `CHECKPOINT.md`: Quick state capture during long sessions.

### /core
Durable project knowledge and workflow rules.
- `DECISIONS.md`: Architectural and technical decisions with rationale.
- `ARCHITECTURE.md`: High-level system design and relationship between tools.
- `STANDARDS.md`: Operational standards for AI agent behavior.

### /history
Historical record of project progression.
- `SESSION_LOG.md`: Log of every interactive session.

### /templates
Standardized formats for common agent memory tasks.
- `HANDOFF_TEMPLATE.md`
- `CHECKPOINT_TEMPLATE.md`
- `TASK_TEMPLATE.md`

## 🔗 Relationship with Legacy & Antigravity Layers
This project contains multiple documentation and context layers. The `/brain` system is the primary tool-agnostic operational layer and the source of truth for current tasks.

- **Primary Operational Layer**: `/brain/` (New standards, updated here).
- **Legacy Reference Layer**: `docs/ai_context/` (Historical sessions).
- **Antigravity Coordination Layer**: `ai-context/` (Antigravity-specific artifacts).
- **Project Structure**: `docs/` (Architecture, data model, business rules).

Agents should NOT ignore legacy docs but should ALWAYS update `/brain` to ensure the next tool (e.g. Cursor or Copilot) has the most compact and actionable context.

## 🛠️ Tool Integration
- **Antigravity**: Uses `.agent/skills` and `AGENTS.md`.
- **Cursor**: References `.cursorrules`.
- **Copilot**: Uses `.github/copilot-instructions.md`.
- **Obsidian**: The repo can be opened as an Obsidian vault for human-readable project management.

## 📓 Obsidian Workflow
1. **Open Repo as Vault**: Open the root of this repository as a vault.
2. **Sidebar View**: Focus on the `/brain` folder for project management.
3. **Graph View**: Visual representation of project decisions and architectural links.
4. **Symlink (Optional)**: If you already have a main vault, symlink `/brain` into it:
   `mklink /D "path\to\your\vault\CanadaSteel_Brain" "c:\path\to\this\repo\brain"`
