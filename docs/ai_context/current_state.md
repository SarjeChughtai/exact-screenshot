# Current State: Canada Steel Platform

> [!IMPORTANT]
> **This file is now legacy.** The active operational project state is now maintained in [/brain/active/CURRENT_STATE.md](../../brain/active/CURRENT_STATE.md). Refer to that file for the most up-to-date information.

Last updated: Apr 1, 2026
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
  - operations tooling is now grouped under an explicit Operations workspace in the sidebar
  - import review now detects duplicate document groups and lets operators mark one primary visible set
  - operator-facing document pickers now hide non-primary duplicate files by default
  - internal quote builder now prefers warehouse-normalized historical document data over raw AI output
  - portal-native opportunity and deal milestone groundwork has been added to the domain model, mapper layer, and app state
  - freight board now shows pickup, delivery, drop-off, execution mode, and milestone-derived freight readiness
  - dealer portal now includes a project tracker view in `DealerLog` with derived lifecycle stages and direct PDF access
  - freight now supports a manual pre-sale estimate flow and editable execution/pre-sale posting directly from `FreightBoard`
  - quote and RFQ logs now expose basic portal-native opportunity status controls (`open`, `lost`, `abandoned`) from the document workflow
  - a dedicated `Opportunities` workspace now exists for internal CRM lifecycle management across RFQs, quotes, deals, and freight readiness
  - production state is now explicitly normalized around `deals.productionStatus`, with the legacy `production` table treated as a synchronized shadow record
  - quote, deal, and freight screens now deep-link into opportunities and freight workflows using query-param launch points
  - internal and dealer-facing document views now surface primary visible file sets, hidden duplicate counts, and direct file/PDF access without forcing a jump back into import review
  - the opportunities workspace now supports both table and CRM-style board views while preserving the same lifecycle controls and launch actions
  - `QuoteLog` now acts as a single RFQ workspace with explicit `log` and `pipeline` modes on the same route
  - internal RFQ users can filter the shared RFQ workspace by estimator assignee, while estimator-only users remain locked to their own assigned/submitted RFQs
  - internal quote historical document pulls now use deterministic precedence: warehouse rows, corrected quote-file data, stored-document parsed data, raw AI output, then parser fallback
  - `deals`, `production`, `freight`, and `opportunities` now share the same derived post-sale signals for next step, blocked reason, freight-ready state, and milestone progress
  - `MasterDeals` and `FreightBoard` now expose document-vault summaries using the same primary-visible-set / hidden-duplicate language already used in logs and opportunities
  - the opportunities workspace now supports internal filtering by sales rep owner and estimator in both table and board workflows
  - `DealerLog` is now a full dealer workspace with normalized project rows, stage filtering, text search, and `cards` / `table` views on the same route
  - each dealer project now exposes current stage, latest quote status, next dealer-visible action, latest activity timestamp, and dealer-safe document summaries
  - Playwright verification is now repo-local and no longer depends on the missing `lovable-agent-playwright-config` package
  - authenticated smoke coverage now lives in `tests/e2e/workflow-smoke.spec.ts`, gated by local env credentials and optional target data
  - branch release verification is documented in `docs/WORKFLOW_COMPLETION_PHASE_2_RELEASE_CHECKLIST.md`

## 📍 Navigational Rules
- Dealers default to the `dealer-log` page.
- Onboarding prompts must be non-intrusive (skippable banners).
- Redirects should be handled at the page level, not global middleware, to allow partial access to unprofiled users.
- Dealer-facing project status should be derived from shared document, opportunity, and deal state rather than maintained as a separate parallel record.
- Freight should remain a single job-linked record that can move from `pre_sale` to `execution`, rather than creating duplicate freight rows for one job.
- Opportunity management should happen from one portal-native workspace, with quote/deal pages acting as launch points rather than competing sources of lifecycle truth.
- Production progress should be calculated from normalized deal stages, even when the UI uses custom configured display labels.
- RFQ routing should stay on `/quote-log`; `view=log|pipeline`, `documentId`, and `assignee` query params are the supported deep-link pattern for RFQ workspace navigation.
- Dealer workspace routing should stay on `/dealer-log`; `stage`, `search`, and `view` are the supported query params for dealer workflow navigation.
