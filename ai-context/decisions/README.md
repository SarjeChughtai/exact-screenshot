# Decisions

This directory contains architecture, policy, and design decisions made during the project.

## Purpose

Decisions capture the "why" behind significant choices — not just what was built, but why it was built that way. This prevents future agents (and future you) from relitigating settled questions or making changes without understanding the context that led to a decision.

## When to Record a Decision

Record a decision when:
- You chose one technology, architecture, or approach over meaningful alternatives
- You made a tradeoff (e.g., simplicity vs. performance, consistency vs. speed)
- You established a pattern or convention that other code will follow
- You deprecated or reversed a previous decision

Do NOT record decisions for:
- Trivial implementation details with no meaningful alternative
- Pure stylistic choices already covered by a linter or formatter
- Obvious choices with no real tradeoff

## File Naming

Use the format: `YYYY-MM-DD-short-slug.md`

Examples:
- `2026-04-02-use-supabase-for-persistence.md`
- `2026-04-15-rls-policy-service-role-only.md`
- `2026-05-01-deprecate-legacy-sync-endpoint.md`

## Decision Template

See `../templates/decision-template.md` for the full template, or create one via:

```bash
npm run context:decision -- "Decision title" "The decision we made" --context "Why this came up" --consequences "What this means going forward" --decided-by "agent-name"
```

## Statuses

| Status | Meaning |
|---|---|
| `proposed` | Under discussion — not yet finalized |
| `accepted` | Active and in force — follow this decision |
| `deprecated` | No longer applies — see the replacement decision or notes |

## Index

_No decisions recorded yet. Add files to this directory as decisions are made._
