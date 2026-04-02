# End Agent Session

**Trigger:** `/end-session`  
**Description:** Properly close out a session with a handoff and log entry. Run this before stopping work — even if you did not finish your task. Never leave a session without completing these steps.

---

## Steps

### 1. Summarize your session
Write a brief internal summary (for your own reference as you complete the steps below):
- What you set out to do
- What you actually completed
- What you left unfinished and why
- Any surprises, decisions made, or issues encountered

### 2. Update tasks.json
Open `ai-context/tasks.json` and update every task you touched:
- `status`: reflect current state (`pending`, `in_progress`, `ready`, `review`, `done`, `blocked`)
- `next_action`: a single, specific sentence describing the exact next step
- `updated_at`: current ISO 8601 timestamp (e.g., `2026-04-02T12:00:00Z`)
- `last_updated_by`: your agent name
- `notes`: append any findings, decisions, or warnings — do not overwrite prior notes

Update `meta.last_updated` at the top of tasks.json as well.

### 3. Append a log entry
Open (or create) `ai-context/logs/YYYY-MM-DD.md` using today's date.  
Append the following block at the bottom of the file:

```markdown
## [HH:MM UTC] — [Your Agent Name]

**Action:** [1–2 sentence summary of what you did]

**Files changed:**
- [list each file you created, edited, or deleted]

**Blockers:**
- [list blockers, or "none"]

**Next step:** [exact next action for the next agent]
```

Do not edit earlier entries. Only append.

### 4. Update the active handoff
Overwrite `ai-context/handoffs/active.md` with:

```markdown
# Active Handoff

**From:** [your agent name]  
**To:** [next agent name, or "unassigned"]  
**Date:** [YYYY-MM-DD HH:MM UTC]

## Completed This Session
- [bullet list of what you finished]

## In Progress / Unfinished
- [bullet list of anything left mid-flight, with exact state]

## Blockers
- [bullet list, or "none"]

## Exact Next Step
[One clear, unambiguous sentence telling the next agent exactly what to do first.]

## Files Touched
- [list every file read or modified this session]

## Notes
[Anything the next agent should know that does not fit above.]
```

Be precise. Vague handoffs cause wasted cycles.

### 5. Update dashboard.md
Edit `ai-context/dashboard.md`:
- **Last Completed Step:** describe the last thing you finished
- **Next Action:** copy the "Exact Next Step" from your handoff
- **Current Blockers:** update to reflect current state
- **Current Agent:** set to `unassigned` (you are leaving)

### 6. Archive handoff if a milestone was reached
If you completed a significant milestone (e.g., a feature shipped, a phase closed, a major bug fixed):
1. Copy the previous `ai-context/handoffs/active.md` to `ai-context/handoffs/archive/YYYY-MM-DD-[short-description].md` before overwriting it.
2. Note the archive filename in your log entry.

Only archive on genuine milestones — not every session.

### 7. Commit context changes
If the project uses Git, stage and commit all files in `ai-context/`:

```
git add ai-context/
git commit -m "chore(context): end-session update — [TASK-ID] [brief description]"
```

Do not commit source code changes in the same commit as context changes unless they are trivially small and directly related.

---

**Do not skip steps 3 and 4.** Log and handoff are the minimum viable artifacts every session must produce.
