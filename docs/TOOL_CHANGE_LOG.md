# Tool Change Log

This log is the practical history of workflow and tool changes in the portal. It is intended for operators, admins, and anyone verifying what changed without reading code.

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
