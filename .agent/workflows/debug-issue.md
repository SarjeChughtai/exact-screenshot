# Debug Issue

**Trigger:** `/debug-issue`  
**Description:** Systematic debugging workflow for any error, failure, or unexpected behavior. Follow steps in order — do not skip ahead to applying a fix.

---

## Steps

### 1. Load the task and error context
Read the current task from `ai-context/tasks.json`.  
Gather the full error: message, stack trace, the action that triggered it, and the environment it occurred in (local, staging, production).  
If the error was reported by another agent, read the relevant log entries in `ai-context/logs/` and the active handoff in `ai-context/handoffs/active.md`.

### 2. Identify likely causes — do not guess randomly
Before reading any code, reason through the most probable causes based on what you know:

- What changed recently? (Check recent log entries and git history)
- What does the error message literally say?
- Is this a configuration issue, a logic issue, a dependency issue, or a data issue?

Write out your top 2–3 hypotheses, ordered by likelihood. Label them explicitly:

```
Hypothesis A (most likely): [description]
Hypothesis B: [description]
Hypothesis C (least likely): [description]
```

### 3. Inspect relevant files
Based on your hypotheses, read the specific files most likely to contain the issue:
- Config files and environment variable definitions
- The code path that the error originates from
- Any schema or migration files if a data shape is involved
- Dependencies or services the failing code calls

Be targeted. Do not read unrelated code.

As you inspect each file, annotate your hypotheses:
- **Confirmed** — you found direct evidence
- **Ruled out** — evidence contradicts this hypothesis
- **Still possible** — no evidence either way

### 4. Be explicit about what is confirmed vs. inferred
Before proposing a fix, write a short diagnosis:

```
## Diagnosis

**Root cause (confirmed):** [what you know for certain is wrong]
**Contributing factors (inferred):** [what you suspect but cannot fully verify]
**Ruled out:** [what you checked and eliminated]
```

Do not present inferences as confirmed facts.

### 5. Propose the smallest testable fix
Describe the fix precisely:
- Which file(s) will change
- Exactly what will change (diff-level specificity)
- Why this fix addresses the root cause
- What side effects, if any, are possible

Prefer surgical fixes. Do not refactor while debugging unless the refactor is the fix.

### 6. Apply the fix — when confidence is reasonable
Apply the fix only when you have at least one confirmed hypothesis and a clear, targeted change.  
If you have no confirmed hypothesis and are still guessing, do not apply a fix. Instead, go to step 9 and hand off with full debug context.

### 7. Verify the fix works
Test the fix in the same environment where the issue occurred:
- Reproduce the original failing condition
- Confirm it no longer fails
- Check for regressions in adjacent functionality

If the fix does not resolve the issue, return to step 2 with the new information. Update your hypotheses.

### 8. Update task, log, and handoff
**tasks.json:** Update the task status and `next_action`. Add a `notes` entry summarizing root cause and fix.

**Log entry** in `ai-context/logs/YYYY-MM-DD.md`:

```markdown
## [HH:MM UTC] — [Your Agent Name]

**Action:** Debugged [TASK-ID] — [one-line description of issue]

**Root cause:** [confirmed cause]
**Fix applied:** [description of change]
**Files changed:** [list]
**Verified:** [yes / no — and why if no]
**Remaining risk:** [any side effects or follow-up needed]
```

**Handoff** (`ai-context/handoffs/active.md`): Update with full debug context so the next agent does not restart from zero.

### 9. If the issue crosses agent boundaries
If the root cause lies in code or systems owned by a different agent or team:
1. Do not attempt a fix in their domain without coordination
2. Document everything you found: hypotheses, evidence, files inspected, exact failure point
3. Update the task status to `blocked`
4. Write a handoff with: the exact question that needs answering, what you have already ruled out, and which agent/area owns the solution

---

**Rule:** A debug session with no confirmed hypothesis and no handoff is wasted work. Always leave the system more informed than you found it.
