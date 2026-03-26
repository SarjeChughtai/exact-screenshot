# Changelog

## [1.0.0] — 2026-03-25

### Initial Build
- Dashboard with role-aware pipeline KPIs and 8-stage deal visualization
- Quick Estimator (143 MBS project data, complexity checkboxes, slab/frost wall, auto freight from postal code)
- Sales Quote Builder ($/lb engine, tiered markup, tax calc, freight override)
- Internal Quote Builder (multi-file PDF upload for MBS + Silvercote, supplier + tiered markup, $/lb sanity check, compliance notes)
- Quote Log with status tracking and Won → Deal conversion
- Master Deals with 8 seed deals (real client data), expandable detail rows, inline editing
- Production Status — amalgamated view with progress bars driven by configurable status lists
- Internal Costs — true vs. rep-visible cost table with inline editing
- Projected Financials — auto-populated GP/margin from Internal Costs
- Payment Ledger — full CRUD with auto tax calculation from deal province
- Client Payments — per-deal aggregation from ledger
- Vendor Payments — TSC 15/50/35 schedule tracking
- Monthly HST — tax collected vs. paid net position
- Deal P&L — cash position per deal with expandable payment details
- Freight Board — coordinator view without pricing info, status management
- Commission & Profit — 30% rep commission with payout stage tracking, true/rep GP toggle
- Commission Statement — per-deal printable statement with owner (3×5%) and estimator (5%) payouts
- Role-based access control (Admin, Owner, Accounting, Operations, Sales Rep, Freight) with multi-role support
- Freight estimation from postal code / city name with 30 city overrides
- Collapsible sidebar with 6 grouped menu sections and role picker
- Settings page — personnel management, status customization, data export/import
- Reference data: 143 steel projects (14 tiers), 48 insulation quotes (10 grades), 13 provinces, freight benchmarks
