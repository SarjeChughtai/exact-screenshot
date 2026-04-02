# CSB Portal

## Antigravity Workflow

This repo now includes a local Antigravity operating layer for agent coordination.

- Canonical agent state lives in `ai-context/`
- Shared skills and personas live in `.agent/` and `.agents/`
- Obsidian artifacts are generated into `ai-context/kanban-board.md` and `obsidian/generated/`
- Notion artifacts are generated into `notion/export/`
- Legacy reference context remains in `docs/ai_context/`

Common commands:

```bash
npm run context:validate:strict
npm run context:obsidian:bootstrap
npm run context:notion:export
npm run context:federation:sync
```

Before starting work, read:

- `ai-context/project.md`
- `ai-context/dashboard.md`
- `ai-context/tasks.json`
- `ai-context/handoffs/active.md`

## Environment

The repo now includes checked-in example env files:

- `.env.example` for frontend runtime variables
- `supabase/.env.example` for local Supabase Edge Function secrets

Frontend variables currently used:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_MAPS_KEY`

Edge Function secrets referenced in `supabase/functions/*`:

- `LOVABLE_API_KEY`
- `GDRIVE_SERVICE_ACCOUNT_JSON`
- `GDRIVE_FOLDER_ID`
- `GHL_API_KEY`
- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`

The local `.env` file may also contain `VITE_SUPABASE_PROJECT_ID`, but the app does not currently use it.
