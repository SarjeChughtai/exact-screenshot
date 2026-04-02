# Decision Template

Use this template for any significant architectural, technical, or policy decision.

Save the file as `decisions/YYYY-MM-DD-short-slug.md`.

Create via CLI:
```bash
npm run context:decision -- "Decision title" "The decision we made" \
  --context "Why this came up" \
  --consequences "What this means going forward" \
  --files "path/to/relevant/file.ts" \
  --decided-by "your-agent-name"
```

---

## Template

```markdown
---
title: [Decision title]
status: accepted
decided_by: [agent-name or "human"]
created_at: [ISO timestamp]
---

# Decision: [Decision title]

## Context
[Why did this decision need to be made? What was the situation, what problem were you solving,
what constraints existed? Include any relevant background a future agent would need to understand
why this wasn't obvious.]

## Options Considered
[Optional but recommended — what alternatives did you evaluate?]

1. **Option A:** [Description] — Pros: [...] Cons: [...]
2. **Option B:** [Description] — Pros: [...] Cons: [...]
3. **Option C (chosen):** [Description] — Pros: [...] Cons: [...]

## Decision
[What was decided? State it clearly and unambiguously. This is the part future agents will
act on — make it actionable.]

## Consequences
[What does this decision mean going forward?
- What becomes easier or harder?
- What patterns or conventions now apply?
- What would need to change if this decision were reversed?]

## Related Files
- [path/to/relevant/file.ts]
- [path/to/schema.sql]
```

---

## When This Decision Should Be Revisited

Consider updating status to `deprecated` and creating a new decision when:
- The underlying problem changes significantly
- A new constraint makes the decision no longer valid
- A better option becomes available (new library, changed requirements)
- The decision caused unexpected negative consequences

Never silently reverse a decision — always record the deprecation and the replacement.
