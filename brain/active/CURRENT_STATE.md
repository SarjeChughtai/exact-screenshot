# Current State: Canada Steel Platform

Last updated: Apr 2, 2026

## 🎯 Objective
Complete implementation of a tool-agnostic agent memory and handoff system (`/brain`).

## 🛠️ Technology Stack
- **Frontend**: React (Vite) with TypeScript.
- **Styling**: TailwindCSS & shadcn/ui components.
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
- **State Management**: React Context (`AuthContext`, `RoleContext`, `SettingsContext`, `AppContext`).
- **i18n**: `i18next` with English/French localization.

## 🔐 Role System
Users belong to specialized portals:
- **Admin/Owner**: Full system control.
- **Internal**: Operations, Accounting, Sales.
- **Dealer**: External partners submitting RFQs.
- **Vendor**: Manufacturers and Freight providers.

## 🔄 Core Workflows
1. **Dealer Onboarding**: Signup -> Admin Approval -> Business Profile Setup (Skippable) -> Dashboard Access.
2. **RFQ Lifecycle**: Dealer Submits RFQ -> Internal Sales Reviews -> Quotes Generated -> Client Approves -> Deal P&L.
3. **Localization**: All UI labels must use `t()` keys from `en.json`/`fr.json`.

## 🧠 Brain System
- **Status**: Implementing core structure.
- **Relationship**: `/brain` is now the operational layer; `docs/ai_context/` is preserved for historical reference but linked to from here.

## 📍 Navigational Rules
- Dealers default to the `dealer-log` page.
- Onboarding prompts must be non-intrusive (skippable banners).
- Redirects should be handled at the page level, not global middleware.
- Dealer-facing project status derived from shared document, opportunity, and deal state.
- Freight is a single job-linked record (pre_sale to execution).
- Opportunity management happens from one portal-native workspace.
- Production progress calculated from normalized deal stages.
- RFQ routing stays on `/quote-log`.
- Dealer workspace routing stays on `/dealer-log`.
