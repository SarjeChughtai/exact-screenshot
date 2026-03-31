# Current State: Canada Steel Platform

Last updated: Mar 31, 2026

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

## 📍 Navigational Rules
- Dealers default to the `dealer-log` page.
- Onboarding prompts must be non-intrusive (skippable banners).
- Redirects should be handled at the page level, not global middleware, to allow partial access to unprofiled users.
