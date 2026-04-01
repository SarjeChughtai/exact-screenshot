# Operations Workspace And Import Reliability

## Status
- Planned

## User roles
- `operations`
- `admin`
- `owner`

## Business problem
- Operations tools are scattered.
- Import and cost-calculation complaints are not protected by regression coverage.

## Current behavior
- Internal Quote Builder, Draft Log, and Import Review are separate sidebar items.
- Parser and builder logic exists, but failures reported by users are not covered by tests.
- Duplicate-document handling is still undefined in the UI.

## Target behavior
- Group operations tooling together in the sidebar.
- Audit and fix parser-to-builder mapping for weight, `$ / lb`, total cost, and job ID loading.
- Add regression tests before making duplicate-document logic changes.

## Files and impact
- `src/components/AppSidebar.tsx`
- `src/pages/InternalQuoteBuilder.tsx`
- `src/pages/ImportReview.tsx`
- `src/lib/pdfParsers.ts`

## Schema/model impact
- None in this increment

## Tests needed
- Parser extraction regression tests
- Internal quote import/mapping tests

## Risk
- Low to medium
