# RFQ Continuity And Estimator Visibility

## Status
- Planned

## User roles
- `sales_rep`
- `estimator`
- `admin`
- `owner`

## Business problem
- RFQ creation is not visibly continuous.
- Estimator queues are not restricted tightly enough.
- RFQ detail views are too generic for review work.

## Current behavior
- RFQ save stays on the form page.
- PDFs are generated and attached, but the log detail view is payload-heavy.
- Estimator queue filtering is driven by status more than assignee identity.

## Target behavior
- RFQ save routes to the created log entry and highlights it.
- Quote Log supports log and pipeline views with admin user filtering.
- Estimator-only views show only assigned or explicitly submitted RFQs.
- Expanded RFQ detail view shows normalized building/location/accessory data plus PDF actions.

## Files and impact
- `src/pages/QuoteRFQ.tsx`
- `src/pages/QuoteLog.tsx`
- `src/components/RFQWorkflowQueues.tsx`
- `src/components/DocumentLogTable.tsx`

## Schema/model impact
- None in the first pass

## Tests needed
- Estimator queue filtering
- RFQ row focus/highlight on redirect
- Expanded RFQ detail rendering

## Risk
- Medium
