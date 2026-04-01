# Production And Deal Lifecycle Integrity

## Status
- Planned

## User roles
- `operations`
- `sales_rep`
- `admin`
- `owner`

## Business problem
- Mistaken deal conversions are hard to unwind.
- Production lifecycle ownership is split across two domain models.

## Current behavior
- External quotes convert into deals.
- There is no clean revert path back to quote.
- Production UI updates `deals.productionStatus` while a separate `production` table also exists.

## Target behavior
- Deals created from quotes can be reverted back to the source quote.
- Source quote regains `quote_sent` workflow and `Sent` status.
- `deals` remains the temporary canonical production state until a larger redesign lands.

## Files and impact
- `src/components/DocumentLogTable.tsx`
- `src/pages/MasterDeals.tsx`
- `src/context/AppContext.tsx`
- `src/pages/ProductionStatus.tsx`

## Schema/model impact
- None in the first pass

## Tests needed
- Quote -> deal -> quote transition
- Production status persistence on deals

## Risk
- Medium
