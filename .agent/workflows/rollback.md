# Rollback Context Changes

**Trigger:** `/rollback`  
**Description:** Revert the last context change — handoff, task update, log entry, or decision — using Git history. Run whenever a bad write, accidental overwrite, or incorrect state update needs to be undone without losing surrounding context.

All `ai-context/` mutations are tracked by Git. This workflow walks back any single change (or a range) safely, with a mandatory diff review before anything is restored. Every rollback is itself logged and committed, so the undo is part of the permanent record.

---

## Steps

### 1. Ask What to Roll Back

Present the user or calling agent with a menu of rollback targets:

```
What would you like to roll back?

  a) Last handoff          — restore ai-context/handoffs/active.md to its previous state
  b) Last task update      — restore ai-context/tasks.json to its previous state
  c) Last log entry        — remove the most recent entry from today's log file
  d) Last decision         — restore or remove the most recent file in ai-context/decisions/
  e) All context changes since [timestamp or commit] — bulk revert a date range or commit range
```

Wait for an explicit selection before proceeding. Do not guess or assume the target.

---

### 2. Rollback: Last Handoff

**Target file:** `ai-context/handoffs/active.md`

**Step 2a — Find recent commits touching the file:**
```bash
git log --oneline -5 -- ai-context/handoffs/active.md
```
Show the output to the user. Identify the most recent commit (HEAD) and the one before it (HEAD~1).

**Step 2b — Show the diff:**
```bash
git diff HEAD~1 HEAD -- ai-context/handoffs/active.md
```
Present the full diff. Lines prefixed with `-` will be restored; lines prefixed with `+` will be removed.

**Step 2c — Confirm before acting:**
Ask: _"This will restore active.md to its state at [commit hash / message]. Proceed? (yes / no)"_ Do not proceed without explicit confirmation.

**Step 2d — Restore:**
```bash
git checkout HEAD~1 -- ai-context/handoffs/active.md
```

**Step 2e — Verify the restored file:**
Read `ai-context/handoffs/active.md` and confirm it parses correctly (valid YAML frontmatter, no truncated lines, no merge markers).

**Step 2f — Log and commit:**
Append a rollback entry to today's log (see Step 7), then:
```bash
git add ai-context/handoffs/active.md ai-context/logs/YYYY-MM-DD.md
git commit -m "rollback: reverted handoffs/active.md to [commit hash] per user request"
```

---

### 3. Rollback: Last Task Update

**Target file:** `ai-context/tasks.json`

**Step 3a — Find recent commits:**
```bash
git log --oneline -5 -- ai-context/tasks.json
```
Show the output. Identify HEAD and HEAD~1.

**Step 3b — Show what changed:**
```bash
git diff HEAD~1 HEAD -- ai-context/tasks.json
```
Parse the diff and summarize in plain language:
- Which task IDs appear in the diff
- What field(s) changed (`status`, `owner`, `priority`, `notes`, etc.)
- Old value → New value for each changed field

Example summary:
```
Changed tasks:
  • TASK-014: status changed from "ready" → "in_progress"
  • TASK-014: owner changed from null → "Codex"
```

**Step 3c — Confirm before acting:**
Ask: _"This will restore tasks.json to its state at [commit hash / message], undoing the changes listed above. Proceed? (yes / no)"_


**Step 3d — Safety check — task reference integrity:**
Before restoring, check whether any other file (e.g., `dashboard.md`, `handoffs/active.md`) references the tasks that would be changed. If so, warn:
```
⚠ Warning: dashboard.md references TASK-014 (current agent assignment).
  Rolling back tasks.json may create an inconsistency. Consider also rolling back dashboard.md,
  or update it manually after this rollback.
```
Still allow the user to proceed, but the warning must appear.

**Step 3e — Restore:**
```bash
git checkout HEAD~1 -- ai-context/tasks.json
```

**Step 3f — Log and commit:**
Append a rollback entry to today's log (see Step 7), then:
```bash
git add ai-context/tasks.json ai-context/logs/YYYY-MM-DD.md
git commit -m "rollback: reverted tasks.json to [commit hash] per user request"
```

---

### 4. Rollback: Last Log Entry

**Target file:** `ai-context/logs/YYYY-MM-DD.md` (today's date)

Log files are **append-only** and should never be fully restored via `git checkout` — doing so would erase all entries from the current session. Instead, surgically remove only the last entry.

**Step 4a — Identify the log file:**
Path: `ai-context/logs/YYYY-MM-DD.md`. If the file does not exist, report: _"No log file exists for today. Nothing to roll back."_ and stop.

**Step 4b — Read the file and identify the last entry:**
Log entries are separated by `---` horizontal rules. The last entry is everything after the final `---` separator (or after the final `## HH:MM` heading). Show it to the user.

**Step 4c — Confirm before acting:**
Ask: _"This will permanently remove the last log entry shown above. Cannot be undone via git. Proceed? (yes / no)"_

**Step 4d — Remove the last entry:**
Trim the file content to exclude the last entry. Preserve all preceding content exactly, including any trailing `---` separator that belongs to the previous entry.

Do this programmatically — do not use `git checkout` on the log file.

**Step 4e — Write the trimmed file:**
Overwrite `ai-context/logs/YYYY-MM-DD.md` with the trimmed content.

**Step 4f — Log and commit:**

> **Special rule:** Because the rollback target IS the log file, do not append a rollback entry to the file you just trimmed. Instead, append a one-line comment at the very end of the file:
> ```
> <!-- rollback performed at HH:MM — last entry removed by [agent] -->
> ```
> Then commit:
> ```bash
> git add ai-context/logs/YYYY-MM-DD.md
> git commit -m "rollback: removed last log entry from YYYY-MM-DD.md per user request"
> ```

---

### 5. Rollback: Last Decision

**Target directory:** `ai-context/decisions/`

**Step 5a — Find the most recent decision by commit time:**
```bash
git log --oneline -10 -- ai-context/decisions/
```
Identify the most recently committed decision file (first in output).

**Step 5b — Determine the action needed:**
- **New file** (commit added it): rollback action is `git rm`.
- **Modified file** (commit changed it): rollback action is `git checkout HEAD~1`.

Show the user which file is affected and what action will be taken.

**Step 5c — Show the content:**
Display the full content of the decision file (or the diff, if it was modified rather than created).

**Step 5d — Confirm before acting:**
Ask: _"This will [remove / restore previous version of] ai-context/decisions/[filename]. Proceed? (yes / no)"_

**Step 5e — Execute the rollback:**

For a newly added file (remove it):
```bash
git rm ai-context/decisions/[filename]
```

For a modified file (restore previous version):
```bash
git checkout HEAD~1 -- ai-context/decisions/[filename]
```

**Step 5f — Log and commit:**
Append a rollback entry to today's log (see Step 7), then:
```bash
git add -A
git commit -m "rollback: reverted ai-context/decisions/[filename] per user request"
```

---

### 6. Rollback: All Context Changes Since [Timestamp or Commit]

This is a bulk rollback. It reverts the entire `ai-context/` directory to its state at a specific point in time.

**Step 6a — Identify the target:**
User provides either a timestamp (e.g., `"2026-04-01 14:00"`) or a commit hash (e.g., `"a3f9c12"`).

**Step 6b — Find all commits in the range:**
```bash
git log --since="TIMESTAMP" --oneline -- ai-context/
```
Or for a commit-based range:
```bash
git log COMMIT..HEAD --oneline -- ai-context/
```
Show the full list of commits that will be undone.

**Step 6c — Show a summary of all changes:**
For each file touched, show its path, number of commits affecting it, and a brief description. Example:
```
Files to revert:
  • ai-context/tasks.json           — 3 commits (task status updates)
  • ai-context/handoffs/active.md   — 1 commit (handoff from Codex to Claude)
  • ai-context/dashboard.md         — 2 commits (sprint dashboard updates)
```

**Step 6d — Confirm before acting:**
This is a destructive bulk operation. Require explicit confirmation:
```
⚠ This will revert ALL of the above files to their state at [TIMESTAMP / COMMIT].
  [N] commits of context history will be undone.
  This cannot be automatically undone — a manual re-application would be required.
  
  Type "yes, revert all" to proceed, or anything else to cancel.
```

Only proceed if the user types "yes, revert all" (or an unambiguous equivalent).

**Step 6e — Execute the bulk rollback:**
```bash
git checkout COMMIT -- ai-context/
```
Where `COMMIT` is the target commit hash (the last commit before the range begins).

**Step 6f — Log and commit:**
Append a rollback entry to today's log (see Step 7), then:
```bash
git add ai-context/
git commit -m "rollback: reverted ai-context/ to [commit hash] — undid [N] commits per user request"
```

---

### 7. Post-Rollback Actions (All Rollback Types)

After any successful rollback, perform ALL of the following steps:

**Step 7a — Append a rollback log entry:**

Open today's log file (`ai-context/logs/YYYY-MM-DD.md`). Append:

```markdown
## [HH:MM] Rollback Performed

**Agent:** [agent name]
**Action:** Rolled back [what was reverted]
**Target commit / state:** [commit hash or description]
**Reason:** Per user request via /rollback workflow
**Files affected:** [list of files changed]
**Verified:** [yes / no — result of Step 7c]
```

> Exception: If the rollback target was the log file itself (Step 4), follow the special logging rule in Step 4f instead.

**Step 7b — Update dashboard.md if needed:**

If the rollback affects current sprint state, update `ai-context/dashboard.md`: correct Current Task ID, Current Agent, Last Completed Step, and note the rollback in Recent Activity if that section exists.

**Step 7c — Verify restored files:**

Run context validation to confirm the restored state is internally consistent:

```bash
node .agent/skills/context-sync/scripts/validate-context.mjs
```

If validation fails, report the specific errors to the user. Do not suppress or ignore validation failures — surface them clearly and suggest corrective action.

**Step 7d — Final commit (if not already committed):**
```bash
git add ai-context/
git commit -m "rollback: post-rollback log and dashboard update — [what was reverted]"
```

---

## Safety Rules

1. **Always show the diff before reverting.** Never restore a file without first displaying what will change.

2. **Always require explicit confirmation.** A vague "ok" or "sure" is sufficient. Silence, ellipsis, or no response is not.

3. **Never roll back the rollback log entry itself.** If the most recent log entry is a rollback record, refuse and warn: _"Rolling back a rollback log entry would create an untracked gap in the audit trail. If you need to correct the log, edit it manually and commit with a clear message."_

4. **Warn on task reference integrity.** Before reverting `tasks.json`, check if any other context file references the affected task IDs. Display a warning if a conflict exists (see Step 3d).

5. **Never use `git checkout` on log files.** Log files are append-only records. Always trim programmatically (Step 4).

6. **Do not chain rollbacks silently.** If rolling back one file reveals another is now inconsistent, surface it — do not automatically roll back the second file without a separate confirmation.

7. **One rollback at a time.** Do not perform a bulk rollback (Step 6) and a targeted rollback (Steps 2–5) in the same invocation. Handle them sequentially with a confirmation gate between each.
