# Workflow Completion Phase 2 Release Checklist

Use this checklist before deploying `feature/workflow-completion-phase-2`.

## Automated checks
- `npm test`
- `npm run build`
- `npm run test:e2e`

## Smoke test environment variables
Authenticated smoke coverage is driven by local environment variables. Do not commit them.

- `SMOKE_BASE_URL`
  Use this if you want Playwright to hit an already-running environment instead of starting local Vite.
- `SMOKE_INTERNAL_EMAIL`
- `SMOKE_INTERNAL_PASSWORD`
- `SMOKE_DEALER_EMAIL`
- `SMOKE_DEALER_PASSWORD`
- Optional targeted verification:
  - `SMOKE_RFQ_ASSIGNEE`
  - `SMOKE_OPPORTUNITY_OWNER`
  - `SMOKE_OPPORTUNITY_ESTIMATOR`
  - `SMOKE_JOB_ID`
  - `SMOKE_DEALER_JOB_ID`
  - `SMOKE_MBS_FILE_NAME`
  - `SMOKE_INSULATION_FILE_NAME`
  - `SMOKE_EXPECTED_JOB_ID`
  - `SMOKE_EXPECTED_CITY`
  - `SMOKE_EXPECTED_POSTAL_CODE`

## What the automated smoke suite covers
- Unauthenticated redirect to `/auth`
- Internal login
- `/quote-log?view=log`
- `/quote-log?view=pipeline`
- RFQ assignee filter when `SMOKE_RFQ_ASSIGNEE` is provided
- `/opportunities`
- owner and estimator filters when `SMOKE_OPPORTUNITY_OWNER` or `SMOKE_OPPORTUNITY_ESTIMATOR` is provided
- `/deals`
- `/production`
- `/freight`
- Dealer login
- `/dealer-log`
- Historical quote hydration in `/internal-quote-builder` when known file names are provided

## Manual fallback checks
Run these manually if the automated suite skips authenticated checks because credentials or target data are unavailable.

### Internal account
1. Sign in to the internal portal.
2. Open `/quote-log?view=log` and confirm the RFQ log renders.
3. Open `/quote-log?view=pipeline` and confirm the pipeline renders.
4. If using an admin, owner, or operations account, verify the assignee filter changes the visible RFQ set.
5. Open `/opportunities` and verify status, owner, and estimator filters work.
6. Open `/internal-quote-builder`, pull one known MBS document and one known insulation document, and verify:
   - job ID
   - city
   - postal code
   - weight
   - supplier `$ / lb`
   - total supplier cost
7. Open `/deals`, `/production`, and `/freight` for the same job and confirm next step, blocked reason, and freight-ready state match.

### Dealer account
1. Sign in to the dealer portal.
2. Open `/dealer-log`.
3. Verify stage cards, stage filter, text search, and table/cards toggle all work.
4. Confirm the latest quote status, next action, and latest update are visible per project.
5. Confirm dealer-visible files show:
   - saved PDFs first
   - primary support files second
   - hidden duplicates only as a summary
6. Confirm internal cost-file detail is not exposed.

## Known pre-existing warnings
- Vite chunk-size warnings during build
- mixed static/dynamic import warnings for `xlsx`
- mixed static/dynamic import warnings for `pdfjs-dist`
