# Agent Roles and Rules

This project uses the Antigravity master pack as shared agent infrastructure.

## Shared Rules
1. Read the full `ai-context/` bundle before starting work.
2. Keep bridge-mode coordination in `ai-context/`; keep `docs/ai_context/` intact as legacy reference.
3. Update structured state before ending a session: task, log, dashboard, and handoff.
4. Escalate blockers explicitly instead of leaving silent partial work.

## Curated Personas
- `.agent/agents/orchestrator.md`
- `.agent/agents/project-planner.md`
- `.agent/agents/frontend-specialist.md`
- `.agent/agents/backend-specialist.md`
- `.agent/agents/database-architect.md`
- `.agent/agents/debugger.md`
- `.agent/agents/qa-automation-engineer.md`
- `.agent/agents/documentation-writer.md`
- `.agent/agents/security-auditor.md`
- `.agent/agents/performance-optimizer.md`

## Shared Skills
- Use the linked `.agent/skills/` catalog as the default skill surface for planning, implementation, review, debugging, deployment, and repo coordination.
- Treat Notion automation and Supabase automation as optional adapters, not canonical memory stores.

## Bridge-Mode Notes
- `ai-context/` is the forward-looking agent operating surface.
- `docs/ai_context/` remains the preserved historical record from the pre-master-pack workflow.
- `antigravity-god-mode/` remains untouched and available for reference when specialized prompts are needed.
