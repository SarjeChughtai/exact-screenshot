# Start Agent Session

**Trigger:** `/start-session`  
**Description:** Initialize a new agent session with full context loading. Run this at the start of every session before touching any code or tasks.

---

## Steps

### 1. Load the project overview
Read `ai-context/project.md`.  
Understand the product vision, tech stack, team structure, and any standing constraints. Note anything that affects how you should work today.

### 2. Load the current dashboard
Read `ai-context/dashboard.md`.  
Note: Current Agent, Current Task ID, Last Completed Step, Next Action, and Current Blockers. This is the canonical "where things stand" snapshot.

### 3. Load all tasks
Read `ai-context/tasks.json`.  
Scan the full task list. Note every task with `status: "ready"` or `status: "in_progress"`. Sort mentally by priority (critical → high → medium → low).

### 4. Load workflow and agent rules
Read `ai-context/agents.md`.  
Internalize the rules: naming conventions, file ownership, what agents are allowed to do autonomously vs. what requires a handoff, commit policies, and any no-go zones.

### 5. Load the active handoff
Read `ai-context/handoffs/active.md`.  
This is the most important context file. Note: what the previous agent finished, what they left in progress, any blockers they flagged, and the exact next step they specified.

### 6. Load the most recent session log
List files in `ai-context/logs/` and read the most recently dated one (format: `YYYY-MM-DD.md`).  
Scan for the last few entries to understand what has changed recently. Pay attention to any unresolved issues or partial work.

### 7. Check relevant decisions
List files in `ai-context/decisions/`.  
Read any decision records that relate to your assigned task area. Do not re-litigate decisions already recorded — follow them.

### 8. Identify your task
From tasks.json, select the highest-priority task that is `"ready"` or `"in_progress"` and not blocked.  
If multiple tasks qualify, prefer `in_progress` over `ready`. If there is a tie on priority, prefer the one referenced in the active handoff.

### 9. Update the dashboard
Edit `ai-context/dashboard.md`:
- **Current Agent:** set to your agent name
- **Current Task ID:** set to the task ID you are taking on
- **Last Completed Step:** copy from the active handoff or leave as-is if unchanged
- **Current Blockers:** update if you have identified new ones; clear any that are now resolved

### 10. Announce your plan
Output a structured summary:

```
## Session Start

**Agent:** [your name]
**Task:** [TASK-ID] — [task title]
**Approach:** [brief description of how you will tackle it]
**Dependencies / Risks:** [files, services, or other tasks this depends on]
**Blockers:** [anything that would stop you — "none" if clear]
**First action:** [the very next thing you will do]
```

Do not begin work until this announcement is written. It is the shared record that the next agent will rely on.
