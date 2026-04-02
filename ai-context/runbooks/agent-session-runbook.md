# Agent Session Runbook

Follow these 5 steps every time you start and end an agent session. This is the minimum required protocol — do not skip steps.

---

## Step 1: Read Context (Before Any Work)

Read these files in order. Do not skip. Each one takes under 2 minutes and prevents compounding errors.

```
ai-context/project.md        — Project goal, stack, operating rules
ai-context/tasks.json        — Current task list (statuses, owners, next actions)
ai-context/dashboard.md      — Active focus, current blockers, last completed step
ai-context/handoffs/active.md — Exactly where the last agent left off
ai-context/agents.md         — Your role, standards, and non-negotiables
```

**Before proceeding:** Confirm you understand what task you're picking up and what the exact next step is. If anything is unclear, note it and check with the human before acting.

---

## Step 2: Start Your Session

Mark the task you're working on as `in_progress`:

```bash
npm run context:task -- TASK-ID in_progress your-agent-name "Brief description of what you're starting"
```

Start a session record (optional but recommended for Supabase sync):

```bash
npm run context:session -- start your-agent-name
```

Update `dashboard.md`:
- Set **Current Agent** to your name
- Set **Current Task ID** to the task you're working
- Set **Next Action** to what you're about to do

---

## Step 3: Do the Work

As you work:
- Stay within the scope of your current task. If you discover new work, create a new task — don't expand scope silently.
- If you hit a blocker you can't resolve, stop. Mark the task `blocked` and go to Step 4 now.
- If you make a significant architectural decision, note it immediately — don't wait until the end of the session.

---

## Step 4: Update Memory (After Work)

**Always do all four sub-steps:**

### 4a. Update the task status

```bash
# If complete:
npm run context:task -- TASK-ID done your-agent-name "Completed: [what you finished]"

# If blocked:
npm run context:task -- TASK-ID blocked your-agent-name "Blocked by: [specific blocker]"

# If handing off mid-task:
npm run context:task -- TASK-ID ready your-agent-name "Ready for next agent: [what remains]"
```

### 4b. Write a log entry

```bash
npm run context:log -- your-agent-name "Summary of what you did and why" \
  --files "src/file1.ts,ai-context/tasks.json" \
  --blockers "Any blockers encountered, or omit" \
  --next "The exact next action required" \
  --task-id TASK-ID
```

### 4c. Record any decisions

```bash
npm run context:decision -- "Decision title" "What was decided" \
  --context "Why this came up" \
  --consequences "What this means going forward" \
  --decided-by your-agent-name
```

### 4d. End your session record (if you started one)

```bash
npm run context:session -- end your-agent-name "One-line summary of session outcomes"
```

---

## Step 5: Write the Handoff

Write `ai-context/handoffs/active.md` — even if you think no one is continuing:

```bash
npm run context:handoff -- your-agent-name "next-agent-or-human" "What you completed this session" \
  --files "src/file1.ts,src/file2.ts,ai-context/tasks.json" \
  --blockers "Any blockers, or None" \
  --next "The single most important next action — be specific" \
  --task-id TASK-ID
```

Then update `dashboard.md`:
- Set **Current Agent** to "unassigned" (or the next agent's name if known)
- Set **Last Completed Step** to what you just finished
- Set **Next Action** to the exact next step
- Set **Current Blockers** to "None" or describe them

Commit all changes to git:

```bash
git add ai-context/
git commit -m "context: update after [your-agent-name] session on TASK-ID"
git push
```

---

## Checklist (Paste at End of Every Session)

```
[ ] Read all 5 context files before starting
[ ] Marked task in_progress at session start
[ ] Updated task status at session end (done / blocked / ready)
[ ] Appended log entry to logs/YYYY-MM-DD.md
[ ] Recorded any decisions in decisions/
[ ] Wrote active.md handoff with exact next step
[ ] Updated dashboard.md current state
[ ] Committed and pushed all changes
[ ] (Optional) Ran context:sync to push to Supabase
```
