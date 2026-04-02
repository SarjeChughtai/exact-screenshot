# Review Work

**Trigger:** `/review-work`  
**Description:** Review current work for quality, safety, and completeness before shipping or handing off. Run this at the end of any significant piece of work, or whenever the task reaches `review` status.

---

## Steps

### 1. Load the task and recent changes
Read the current task from `ai-context/tasks.json`.  
Read the active handoff from `ai-context/handoffs/active.md`.  
Read the most recent log entries from `ai-context/logs/YYYY-MM-DD.md`.  
Identify every file that was created or modified during this task. Read each one.

### 2. Review for quality and safety
Evaluate the changes across these six dimensions. For each, note: **pass**, **warning**, or **critical issue**.

#### 2a. Correctness
- Does the implementation match the task description and acceptance criteria?
- Are there obvious logic errors, off-by-one conditions, or unhandled edge cases?
- Does it handle empty, null, or unexpected input gracefully?

#### 2b. Auth and data integrity risks
- Are there any unprotected routes, endpoints, or operations?
- Is user input validated and sanitized before use?
- Are there any permissions or access control gaps?
- Could this change expose or corrupt data?

#### 2c. Deployment risks
- Will this change cause downtime or require a migration?
- Are there any hardcoded secrets, credentials, or environment-specific values?
- Does it depend on infrastructure or services that may not be available in all environments?

#### 2d. Environment mismatches
- Does the code assume a specific environment (local, staging, production) without checking?
- Are environment variables properly referenced and documented?
- Are there differences in behavior between environments that could cause silent failures?

#### 2e. Schema issues
- If database schema changed: is there a migration, and is it reversible?
- Do API request/response shapes match what callers expect?
- Are there any breaking changes to interfaces other code depends on?

#### 2f. Unnecessary complexity
- Is the solution significantly more complex than the problem requires?
- Are there abstractions, indirections, or patterns added that are not needed yet?
- Can any part be simplified without losing correctness?

### 3. Check shared-memory file completeness
Verify that all context files are up to date:

| File | Check |
|---|---|
| `ai-context/tasks.json` | Task status, next_action, notes, and files array all reflect current state |
| `ai-context/logs/YYYY-MM-DD.md` | Entry exists for this session's work |
| `ai-context/handoffs/active.md` | Reflects what was completed and what comes next |
| `ai-context/decisions/` | Any architectural or product decisions made during this task are recorded |
| `ai-context/dashboard.md` | Current state is accurate |

Mark each as **complete** or **needs update**.

### 4. Output your review findings
Structure your output as:

```markdown
## Review: [TASK-ID] — [Task Title]

### Critical Issues (must fix before shipping)
- [issue description, file, and line if applicable — or "none"]

### Recommended Fixes (should fix, not blocking)
- [issue and suggested fix — or "none"]

### Safe to Ship
- [list what is clean and ready — be specific]

### Context Files Needing Updates
- [list any shared-memory files that are incomplete — or "all up to date"]

### Overall Assessment
[One sentence: ship it / needs fixes / do not ship + reason]
```

Be direct. Do not soften critical issues.

### 5. If issues were found — update the task
Open `ai-context/tasks.json` and append to the task's `notes`:

```
Review by [your agent name] on [date]: [summary of critical and recommended issues]
```

Set `status` to `in_progress` (needs fixes) or leave as `review` if issues are only recommended, not critical.  
Set `next_action` to the first fix required.

### 6. If work is approved — close the task
If there are no critical issues:
- Set task `status` to `"review"` if another person or agent should sign off before shipping
- Set task `status` to `"done"` if it is ready to ship and no further approval is needed
- Append a log entry confirming approval
- Update the handoff with the approval decision

---

**Principle:** The review is only as useful as its honesty. A rubber-stamp review that misses a security issue is worse than no review.
