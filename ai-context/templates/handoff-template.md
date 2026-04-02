# Handoff Template

Copy this template to `ai-context/handoffs/active.md` at the end of every agent session where another agent or human will continue the work.

The previous `active.md` should be moved to `handoffs/archive/YYYY-MM-DD-from-to.md` before overwriting.

---

## Template

```markdown
---
from: [agent-name]
to: [next-agent-name or "human"]
task_id: [AREA-NNN]
status: open
created_at: [ISO timestamp]
---

# Handoff: [from] → [to]

## Completed
[What was accomplished in this session. Be specific — list the things you actually finished.
Not "worked on auth" but "implemented JWT validation middleware in src/middleware/auth.ts,
added tests in tests/auth.test.ts, all passing".]

## Blockers
[Anything that prevented full completion, or that might block the next agent.
Be precise — what is the blocker, where does it exist, and what information is needed to resolve it?
If none, write "None".]

## Exact Next Step
[The single most important action the next agent should take. This should be so specific
that there is no ambiguity. Not "continue the work" — instead:
"Open src/api/users.ts, implement the updateUser endpoint at line 87 per the spec in docs/api.md"]

## Files Touched
- [path/to/file1.ts]
- [path/to/file2.ts]
- [ai-context/tasks.json]
- [ai-context/logs/YYYY-MM-DD.md]
```

---

## Archiving the Previous Handoff

Before writing a new `active.md`, move the old one:

```bash
mv ai-context/handoffs/active.md \
   ai-context/handoffs/archive/YYYY-MM-DD-from-to.md
```

Or use git to track it — the history is preserved automatically.

---

## What Makes a Good Handoff

| Good | Bad |
|---|---|
| "Implement `POST /api/orders` in `src/routes/orders.ts` — stub is at line 42" | "Continue the orders feature" |
| "Blocked: Stripe webhook secret not in `.env.example` — ask human to add it" | "There might be a config issue" |
| Lists every modified file | "Various files" |
| States what was tested and passed | Assumes tests were run |
| Names the exact branch and commit if relevant | Assumes the next agent knows |
