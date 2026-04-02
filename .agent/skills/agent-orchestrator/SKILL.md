---
name: agent-orchestrator
description: |
  Master orchestration skill. Activate when the user wants to delegate, coordinate, or distribute work across multiple AI agents (Claude, Codex, Aider, Cursor, Gemini). Trigger phrases: "delegate to", "assign to Codex", "spin up agents", "orchestrate", "coordinate agents", "multi-agent", "hand off to", "let Gemini handle", "parallel agents", "divide this work", "which agent should", "run agents on".
---

## Goal

Plan and coordinate multi-agent workflows: read project context, determine the best agent assignment for each sub-task, create structured task entries, set up handoff chains, and monitor progress to completion.

## Instructions

### Step 1 — Load Context

Read the following files in order before taking any action:

1. `ai-context/project.md` — understand the project domain, stack, and conventions
2. `ai-context/dashboard.md` — get the current sprint focus and agent assignments
3. `ai-context/tasks.json` — identify all tasks: their status, owner, and priorities
4. `ai-context/agents.md` — confirm which agents are available and their current load
5. `ai-context/handoffs/active.md` — understand what is currently in-flight

If any of these files are missing or stale (updated_at older than 24 hours), run the `context-sync` skill first.

### Step 2 — Analyze the Incoming Task

Decompose the user's request into discrete, independently executable sub-tasks. For each sub-task, determine:

- **Scope**: Is it research, planning, implementation, surgical editing, or review?
- **Dependencies**: Which sub-tasks must complete before others can start?
- **Complexity**: Is this a 15-minute task or a multi-hour task?
- **Risk**: Does it touch production, auth, or schema? Apply `safe-executor` rules.

Document the decomposition as a dependency-ordered list before proceeding.

### Step 3 — Assign Agents

Use the agent capability matrix in `references/agent-roles.md` to assign each sub-task:

| Agent   | Best For                                                         |
|---------|------------------------------------------------------------------|
| Claude  | Planning, architecture, code review, documentation, reasoning    |
| Codex   | Implementation, refactors, boilerplate generation, test writing  |
| Aider   | Surgical file edits, targeted bug fixes, inline changes          |
| Cursor  | Interactive editing sessions, rapid iteration with a human       |
| Gemini  | Research, web lookups, multi-tool workflows, content synthesis   |

Apply the following rules:
- Do not assign the same agent to more than 3 concurrent tasks unless unavoidable.
- If a task has both research and implementation components, split them across Gemini → Codex.
- All architectural decisions must pass through Claude before implementation starts.
- Review tasks are always assigned to Claude regardless of who implemented.

### Step 4 — Create Task Entries

For each sub-task, append a new entry to `ai-context/tasks.json` using this schema:

```json
{
  "id": "AREA-NNN",
  "title": "Short imperative title",
  "status": "ready",
  "priority": "high",
  "owner": "AgentName",
  "last_updated_by": "agent-orchestrator",
  "next_action": "Exact first step the assigned agent must take",
  "notes": "Context needed, links, decisions referenced",
  "area": "crm|auth|ui|api|infra|data|docs",
  "files": ["path/to/relevant/file.ts"],
  "updated_at": "2026-04-02T00:00:00Z"
}
```

Use the `task-manager` skill to validate and write each entry. ID naming convention: `AREA-NNN` (e.g., `CRM-001`, `AUTH-002`).

### Step 5 — Set Up Handoff Chain

For each agent-to-agent handoff in the workflow:

1. Write a handoff entry to `ai-context/handoffs/active.md` using the `handoff-protocol` skill.
2. Specify `from_agent`, `to_agent`, `exact_next_step`, `files_touched`, and `blockers`.
3. If the workflow is sequential (A → B → C), set each handoff to activate only after the prior task reaches `done`.
4. If the workflow is parallel (A ∥ B → C), note the merge condition in the `notes` field of task C.

### Step 6 — Brief Each Agent

Produce a concise briefing block for each assigned agent. Format:

```
## Briefing: [AgentName]
Task IDs: [AREA-NNN, AREA-NNN]
Context files to read: [list]
First action: [exact command or step]
Completion criteria: [what "done" looks like]
Handoff to: [next agent or "none"]
```

Include these briefings in `ai-context/handoffs/active.md` so any agent can self-onboard.

### Step 7 — Monitor Progress

Track progress by:
- Checking `ai-context/logs/` for today's entries from each agent.
- Verifying task statuses in `tasks.json` move through: `ready → in_progress → review → done`.
- If a task has been `in_progress` for more than the expected duration with no log entry, flag it as blocked.
- Update `ai-context/dashboard.md` to reflect current agent assignments and sprint status.

### Step 8 — Record Decisions

Any architectural or process decisions made during orchestration must be logged with the `decision-logger` skill. Do not leave decisions implicit in logs.

## Examples

**Example 1 — Simple two-agent delegation**
> User: "Gemini should research the best approach for real-time presence, then Codex implements it."

1. Create `INFRA-014` (owner: Gemini, status: ready) — research task
2. Create `INFRA-015` (owner: Codex, status: pending) — depends on INFRA-014
3. Handoff: Gemini → Codex once research decision is logged
4. Gemini briefing: read project.md, research WebSocket vs SSE vs Liveblocks, log decision
5. Codex briefing: read decision record, implement chosen approach in `lib/presence/`

**Example 2 — Parallel implementation with Claude review**
> User: "Have Codex and Aider work on the API and UI in parallel, then Claude reviews both."

1. Create `API-022` (owner: Codex) and `UI-033` (owner: Aider) — both `ready`, no dependency
2. Create `REVIEW-001` (owner: Claude, status: pending) — depends on both
3. Handoff: Codex → Claude, Aider → Claude (merge condition: both tasks done)
4. Claude briefing: diff both branches, review against architecture decisions

## Constraints

- Never start implementation sub-tasks before architecture sub-tasks for the same feature are `done`.
- Never assign `safe-executor`-gated commands to an agent without noting the approval requirement in the task's `next_action` field.
- Always update `dashboard.md` at the end of orchestration to reflect the new state.
- Do not create more than 10 tasks in a single orchestration run without user confirmation.
- All task IDs must be unique across `tasks.json`. Check before creating.
