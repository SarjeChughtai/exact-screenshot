# GitHub Copilot Instructions

When using GitHub Copilot in this repository, follow these rules to maintain project context and ensure handoff integrity.

## 🧠 Brain First Workflow
Before starting any coding task, read:
1. `brain/active/NEXT_AGENT.md` — To see what the last agent left for you.
2. `brain/active/CURRENT_STATE.md` — To understand the current project objectives.
3. `brain/core/DECISIONS.md` — To understand architectural constraints.

## ✍️ Memory Updates
- **Checkpoint**: If a task is long, update `brain/active/CHECKPOINT.md` with your status.
- **Handoff**: Before you stop, update `brain/active/NEXT_AGENT.md` so the next agent (or human) can resume.
- **Log**: Append a summary of your session to `brain/history/SESSION_LOG.md`.

## 📜 Coding Patterns
- Use **TypeScript** for all new code.
- Follow **shadcn/ui** and **TailwindCSS** conventions.
- Never hardcode strings; use `t()` keys from `src/i18n/`.
- Refer to `CLAUDE.md` for specific business rules (markup calculations, etc.).

## ⚠️ Integrity Rule
Do not rely on the chat window for persistent memory. Always record state in the `brain/` folder.
