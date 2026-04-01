# Estimate Workflow Continuity

## Status
- In progress

## User roles
- `sales_rep`
- `admin`
- `owner`

## Business problem
- Estimate work is not resumable.
- Saved estimates cannot be reopened in Quick Estimator for editing.
- Estimate drafts are not accessible in the estimator UI.
- Estimate location data is incomplete and does not fully transfer into RFQ.

## Current behavior
- Quick Estimator can save an estimate and route it into RFQ.
- Estimates Log only supports RFQ import and delete.
- Active estimator state is not restored on reopen.
- `Estimate` only stores `province`.

## Target behavior
- Quick Estimator restores active local state.
- Quick Estimator exposes saved drafts with load and delete actions.
- Quick Estimator can load an existing estimate for editing.
- Estimates Log supports edit routing back into Quick Estimator.
- Estimates store `city`, `province`, and `postalCode`.
- RFQ import from estimates carries all three location fields.

## Files and impact
- `src/pages/QuickEstimator.tsx`
- `src/pages/EstimatesLog.tsx`
- `src/lib/rfqForm.ts`
- `src/lib/supabaseMappers.ts`
- `src/types/index.ts`
- `supabase/migrations/*add_estimate_location_fields.sql`

## Schema/model impact
- Add `city` and `postal_code` to `public.estimates`.
- Extend `Estimate` and mapper logic.
- Keep estimator drafts in localStorage for v1.

## Tests needed
- Estimate row mapper round-trip with `city` and `postalCode`.
- Estimate-to-RFQ location transfer.
- Draft storage/load helper behavior.

## Risk
- Low to medium
