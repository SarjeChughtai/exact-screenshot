# Tool Change Log

This log is the practical history of workflow and tool changes in the portal. It is intended for operators, admins, and anyone verifying what changed without reading code.

## 2026-04-01
### Internal Quote Builder and job ID normalization
- Internal Quote Builder upload flow now supports selecting or creating the job ID before upload.
- The selected job ID is now used as the document association for uploaded internal-quote files instead of letting extracted file job IDs override it.
- Internal Quote Builder job selection now uses a broader shared job registry so it can surface job IDs from:
  - quotes
  - deals
  - freight
  - steel cost warehouse rows
  - insulation cost warehouse rows
  - stored imported documents
- Canonical job ID handling was added across app logic:
  - frontend canonical field: `jobId`
  - DB canonical field: `job_id`
  - legacy aliases still resolve from `projectId` and `project_id`

### Internal Quote Builder pricing and structure controls
- Internal Quote Builder now allows a manual internal markup percentage override.
- Leaving internal markup blank still uses the existing tiered internal markup schedule.
- Foundation type now supports `None` for cases like container covers.
- Internal structure type tagging was added for dataset quality:
  - `steel_building`
  - `container_cover`
  - `canopy`
  - `other`
- Structure type is now carried through warehouse/storage persistence for internal historical data.

### Gutter and liner normalization
- Internal Quote Builder now supports:
  - `Gutters & Downspouts`
  - `Roof Liner Panels`
  - `Wall Liner Panels`
- Data tracking now keeps roof and wall liners separate internally.
- The internal quote face and PDF still show a combined `Liners` figure for compatibility.
- PDF output label was updated from `Gutters` to `Gutters & Downspouts`.

### Data hydration and historical pull behavior
- Historical cost-file hydration now carries:
  - canonical job ID
  - structure type
  - gutter/downspout totals
  - roof liner totals
  - wall liner totals
- Historical retrieval still prefers corrected and warehouse-backed data.
- Manual job ID override behavior is limited to new upload association, not historical replay.

### Schema and verification
- Added migration:
  - `20260401123000_add_internal_quote_builder_normalization.sql`
- This migration adds:
  - `foundation_type = 'none'`
  - `structure_type` on `stored_documents`
  - `structure_type` on `steel_cost_data`
  - `structure_type` on `insulation_cost_data`
  - backfill of missing `job_id` from `project_id`
- Verification completed:
  - `npm test` passed
  - `npm run build` passed
- Known follow-up:
  - direct-drop MBS hydration still needs manual browser verification against a real file

## 2026-03-31
### Workflow continuity and RFQ visibility
- Quick Estimator now supports:
  - local active-state restore
  - draft save/load/delete
  - reopening saved estimates for editing
  - city and postal code fields
- Estimates Log now supports:
  - editing saved estimates directly back into Quick Estimator
  - expanded location details
- Quote RFQ now:
  - carries estimate city, province, and postal code into the RFQ form
  - routes back to RFQ Log after save
- RFQ Log now:
  - auto-focuses the newly created document when opened with `documentId`
  - shows structured RFQ details in expanded rows
  - exposes PDF access directly from the expanded RFQ section
- Estimator queue/log visibility was tightened:
  - estimator-only users now see assigned or name-matched RFQs only
- External quote lifecycle:
  - mistaken deal conversions can now be reverted back to quote state from the log

### Shared job and visibility work
- job ID selection is searchable instead of only dropdown-driven
- shared job lifecycle state filtering was added across major workflows
- job visibility is restricted by assignment for non-admin roles in key areas

### RFQ form consolidation
- dealer RFQ and internal RFQ now share a common RFQ form model
- liners, gutters, and insulation fields were normalized into the shared RFQ payload

### Messaging
- internal messaging and online presence were added
- messaging access is controlled per user profile

### Manufacturer workflow
- manufacturer board behavior is now role-aware
- manufacturer visibility rules were tightened in the database

### Documentation
- added a main portal tool user manual
- added a department manual index
- added role-specific guides for sales, estimating, operations, accounting, freight, dealer, vendor/manufacturer, and admin/owner

## How To Use This Log
- read this file first when the UI behaves differently than older screenshots or memory
- read [TOOL_USER_MANUAL.md](/c:/Users/Sarje/.gemini/antigravity/scratch/exact-screenshot-main/docs/TOOL_USER_MANUAL.md) for step-by-step usage
- read [CHANGELOG.md](/c:/Users/Sarje/.gemini/antigravity/scratch/exact-screenshot-main/docs/CHANGELOG.md) for broader engineering history if needed
