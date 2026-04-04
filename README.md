# CSB Portal

## 🧠 Brain Memory System

This repository uses a structured, tool-agnostic agent memory and handoff system in the `/brain` folder.

- **Operational Memory**: `/brain/active/`
- **Project Context**: `/brain/active/CURRENT_STATE.md`
- **Handoffs**: `/brain/active/NEXT_AGENT.md`
- **Durable Decisions**: `/brain/core/DECISIONS.md`
- **Historical Logs**: `/brain/history/SESSION_LOG.md`

### Workflow Compliance
Agents must follow the operational standards defined in `/brain/core/STANDARDS.md`.

Before starting work, read:
1. `/brain/active/NEXT_AGENT.md`
2. `/brain/active/CURRENT_STATE.md`
3. `/brain/core/DECISIONS.md`

### 📓 Obsidian Vault
The root of this repository can be opened as an Obsidian vault for project management.
- Detailed instructions: `BRAIN_SYSTEM.md`

---

## Antigravity Workflow

This repo includes multiple context layers:
- **Primary Operational Layer**: `/brain/` (New standard)
- **Legacy Reference Layer**: `docs/ai_context/`
- **Antigravity Coordination Layer**: `ai-context/`
- **Obsidian Artifacts**: `obsidian/generated/`
- **Notion Artifacts**: `notion/export/`


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
