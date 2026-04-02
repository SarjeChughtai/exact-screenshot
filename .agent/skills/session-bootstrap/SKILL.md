---
name: session-bootstrap
description: |
  Standard session startup procedure for all agents. Activate at the beginning of every new agent session to load context, identify the highest-priority work, and declare intent before taking any action. Trigger phrases: "start session", "begin session", "bootstrap", "starting up", "new session", "load context", "orient yourself", "get up to speed", "what should I work on", "beginning of session", "session start", "initialize", "what's the current state".
---

## Goal

In under 2 minutes, load all relevant context, identify the highest-priority actionable task, and produce a clear session declaration so that any observer (human or agent) knows exactly what will happen next.

## Instructions

### Step 1 — Read ai-context/project.md

Load the project identity document. Extract and note:
- Project name and description
- Tech stack (framework, database, auth, deployment)
- Current phase (e.g., MVP, beta, production)
- Conventions: naming, file structure, testing approach
- Any hard constraints or rules (e.g., "never commit to main directly")

If this file does not exist, stop and create a minimal version before proceeding. A session without project context is a session at risk.

### Step 2 — Read ai-context/dashboard.md

Load the sprint dashboard. Note:
- Current sprint goal or focus area
- Which agents are currently active and what they own
- Any items in the "Blocked" section
- Any items in the "Recently Completed" section (useful for understanding what just happened)

If the dashboard looks stale (last update > 8 hours ago) or inconsistent with what you know, flag it and run `context-sync` before continuing.

### Step 3 — Read ai-context/tasks.json

Load all tasks. Build a mental model of:
- How many tasks are `in_progress` — are there too many open threads?
- Which tasks are `critical` or `high` priority and `ready`
- Which tasks are `blocked` and why
- Which tasks are in `review` and waiting for an agent

Do not start working yet. This read is for orientation only.

### Step 4 — Read ai-context/agents.md

Load the agent registry. Confirm:
- Which agents are listed as available
- Which agents are listed as currently assigned to tasks
- Whether the current agent (you) is listed, and if so, what you were last assigned to

If you are listed as already having an `in_progress` task from a previous session, that task takes priority unless explicitly overridden.

### Step 5 — Read ai-context/handoffs/active.md

Load the active handoff registry. Identify:
- Any handoff addressed to you (matching `to_agent` with your agent name)
- The `exact_next_step` from any handoff addressed to you
- Any handoffs that appear stale (timestamp > 24 hours with no log activity)

If a handoff exists addressed to you, this defines your first action for the session. Do not choose a different task until the handoff task is complete or explicitly deprioritized.

### Step 6 — Read the Latest Log File

List files in `ai-context/logs/`. Read the most recent log file (sort by filename, descending). Note:
- What happened in the last session
- Whether any tasks were completed or blocked
- Whether any decisions were made that you should be aware of
- Any errors or issues that were encountered and their resolution status

If the log is from more than 48 hours ago, note that there may be a significant gap and proceed cautiously.

### Step 7 — Read Relevant Decision Records

Based on the tasks you identified as likely to work on in Step 3, scan `ai-context/decisions/` for decision records related to those task areas. Read any records that:
- Share the same `area` as your likely task (e.g., if working on AUTH tasks, read auth-related decisions)
- Are referenced in the task's `notes` field
- Were created or updated in the most recent log session

You do not need to read all decisions — only those relevant to your current session's work.

### Step 8 — Identify Highest-Priority Task

Apply this priority order to determine what to work on:

1. **Handoff addressed to you** — if active.md has a handoff with your name as `to_agent`, this is your task.
2. **Your in-progress tasks** — if you have a task already `in_progress` from a previous session, resume it.
3. **Critical + ready** — if neither of the above, take the highest-priority `ready` task with `priority: critical`.
4. **High + ready** — if no critical tasks, take `priority: high` and `status: ready`.
5. **Review tasks** — if you are Claude, check for any tasks in `review` status awaiting your evaluation.
6. **Consult human** — if nothing is clearly next, surface the options and ask.

Do not start work on a `pending` task. `Pending` means it is not yet ready to execute — surface it to the orchestrator instead.

### Step 9 — Announce Your Session Plan

Before taking any action on actual work, produce a session declaration in this format:

```
## Session Start — [AgentName] — [YYYY-MM-DDTHH:MM:SS]

**Project:** [Project name from project.md]
**Sprint Focus:** [From dashboard.md]

**My Task This Session:**
[AREA-NNN] — [Task title]
Priority: [priority] | Status: [status]

**First Action:**
[Exact first step I will take, matching the task's next_action or handoff's exact_next_step]

**Files I Will Touch:**
- [path/to/file.ts]

**Estimated Completion:**
[This session / Next session / Unknown]

**Blockers:**
[None / Description of any known blocker]
```

This declaration is for transparency. It allows any agent or human monitoring the session to immediately understand the plan and intervene if the priority is wrong.

### Step 10 — Update dashboard.md

Before starting any task work:
1. Add yourself to the "Active Agents" section of `dashboard.md` with your assigned task ID.
2. Update the "Session Started" timestamp.
3. If resuming a task that was listed as unassigned or stale, reclaim ownership in tasks.json (update `owner` and `last_updated_by`).

Now proceed with your session's work.

## Examples

**Example 1 — Clean handoff pickup**

Session reads active.md and finds:
```
Handoff: Codex → Claude | Task: AUTH-007 | Exact Next Step: Review lib/auth/tokens.ts for security correctness...
```

Session declaration:
```
## Session Start — Claude — 2026-04-02T09:00:00Z

**Project:** Antigravity CRM
**Sprint Focus:** Auth hardening and MFA preparation

**My Task This Session:**
[AUTH-007] — Implement JWT refresh rotation
Priority: critical | Status: review

**First Action:**
Review lib/auth/tokens.ts, specifically the invalidateFamily() function at line 87, for security correctness.

**Files I Will Touch:**
- lib/auth/tokens.ts (read + review comments)
- ai-context/tasks.json (status update)
- ai-context/handoffs/active.md (archive on completion)

**Estimated Completion:** This session

**Blockers:** None
```

**Example 2 — No handoff, choosing from backlog**

No handoffs addressed to Claude. tasks.json shows:
- `CRM-014` — high, ready, unowned — "Build CSV export for contacts"
- `UI-010` — medium, ready — "Polish empty state components"

Session declaration picks `CRM-014` as higher priority, announces it, and proceeds.

## Constraints

- Never skip Steps 1–5. Reading project.md, dashboard.md, tasks.json, agents.md, and handoffs/active.md is mandatory every session.
- Never begin task work before producing the session declaration (Step 9).
- Never pick a `pending` task. Only `ready` or `in_progress` tasks may be started.
- If the context files are inconsistent with each other (e.g., dashboard says task X is done but tasks.json shows in_progress), run `context-sync` before declaring your session plan.
- The session declaration must include a specific `first_action` — not a vague intention.
