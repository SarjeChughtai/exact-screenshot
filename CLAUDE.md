# CLAUDE.md — Canada Steel Buildings ERP

## Project Overview
Internal steel building sales management platform. React + TypeScript + Tailwind + shadcn/ui + Supabase.

### 🧠 Operational Memory
This project uses the `/brain` folder for all agent context, tasks, and state.
Before any work, always read:
1. `brain/active/NEXT_AGENT.md`
2. `brain/active/CURRENT_STATE.md`
3. `brain/core/STANDARDS.md`

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage)
- State: AppContext.tsx wraps Supabase reads/writes
- Routing: React Router v6
- Deployment: Lovable/Vercel

## Key Files
- `src/context/AppContext.tsx` — all Supabase CRUD, state management
- `src/context/SettingsContext.tsx` — configurable markups (editable in Settings page)
- `src/context/RoleContext.tsx` — role-based access control
- `src/context/AuthContext.tsx` — Supabase auth
- `src/lib/calculations.ts` — pricing formulas, tax lookups, markup engine
- `src/lib/freightEstimate.ts` — postal code → distance estimation
- `src/lib/supabaseMappers.ts` — camelCase ↔ snake_case for Supabase
- `src/data/referenceData.json` — steel tiers, insulation grades, tax rates, all reference data
- `src/types/index.ts` — all TypeScript interfaces
- `src/integrations/supabase/types.ts` — auto-generated Supabase schema types

## Conventions
- All currency: CAD `$XX,XXX.XX` format
- Dates: YYYY-MM-DD
- Supabase columns: snake_case. App types: camelCase. Mappers convert between them.
- Every new Supabase table needs: types in types.ts, mappers in supabaseMappers.ts, context functions in AppContext.tsx
- RLS policy for new tables: allow all authenticated users full CRUD

## Business Rules (DO NOT CHANGE)
- Supplier increase: 12% on $/lb
- Tiered markup: <$50K=10%, $50-200K=7.5%, $200-500K=6.5%, $500K-1M=5.5%, >$1M=5%
- Min margin: $3K if steel < $30K
- Insulation: 0% markup (pass-through, already 12.5% from supplier)
- Drawings: +$500 markup each
- Engineering: $1,200 base × complexity factor + $500
- Foundation: schedule lookup, frost wall = slab × 1.65, +$500
- Freight: MAX($4K, km×$4) + remote + overweight
- Tax: HST for ON/NB/NL/NS/PE. GST only for AB/BC/MB/SK/NT/YT/NU. GST+QST for QC.
- Commission: 30% of GP, paid 50/25/25% at 30/70/100% client payment markers
