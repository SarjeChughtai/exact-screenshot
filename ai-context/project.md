# Project Overview

## Name
CSB Portal

## Goal
Internal steel building sales management platform. React + TypeScript + Tailwind + shadcn/ui + Supabase.

## Primary Stack
- **Frontend**: React (Vite) with TypeScript.
- **Styling**: TailwindCSS & shadcn/ui components.
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
- **State Management**: React Context (AuthContext, RoleContext, SettingsContext, AppContext).
- **i18n**: i18next with English/French localization.
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage)
- State: AppContext.tsx wraps Supabase reads/writes
- Routing: React Router v6
- Deployment: Lovable/Vercel
- Code workspace: Antigravity master pack bridge mode
- Canonical coordination state: ai-context/
- Legacy context retained in docs/ai_context/

## Current Focus
- estimate edit/import/state persistence
- RFQ continuity and estimator visibility
- deal reversion and production-state cleanup

## Operating Rules
1. Read `ai-context/project.md`, `tasks.json`, `dashboard.md`, `handoffs/active.md`, and `agents.md` before starting work.
2. Keep `ai-context/` as the forward-looking coordination layer; do not overwrite `docs/ai_context/`.
3. Treat `docs/ai_context/` and `antigravity-god-mode/` as preserved legacy references unless a migration task explicitly says otherwise.
4. Update `tasks.json`, the daily log, and the active handoff whenever work materially changes state.
5. Record durable architectural decisions in `ai-context/decisions/`.

## Legacy Sources
- `CLAUDE.md`
- `docs/ai_context/current_state.md`
- `docs/ai_context/decision_log.md`
- `docs/ai_context/session_logs.md`
