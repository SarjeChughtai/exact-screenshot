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

## Active Delivery Track
- Execution is currently focused on workflow continuity and domain integrity:
  - estimate edit/import/state persistence
  - RFQ continuity and estimator visibility
  - deal reversion and production-state cleanup
  - operations workspace consolidation
  - later opportunity and post-sale lifecycle modeling
- Completed in the current delivery pass:
  - estimate city and postal code support in the domain model and Supabase mapper layer
  - quick estimator active-state persistence and local draft management
  - estimate edit/reopen flow from `EstimatesLog` back into `QuickEstimator`
  - estimate-to-RFQ transfer of city, province, and postal code
  - RFQ post-submit routing back into `QuoteLog` with focused document expansion
  - estimator-specific RFQ visibility tightened in both queue and log views
  - structured RFQ details and PDF access added to expanded RFQ log rows
  - external quotes can now be reverted from deal state back to quote state from the document log

## 📍 Navigational Rules
- Dealers default to the `dealer-log` page.
- Onboarding prompts must be non-intrusive (skippable banners).
- Redirects should be handled at the page level, not global middleware, to allow partial access to unprofiled users.
