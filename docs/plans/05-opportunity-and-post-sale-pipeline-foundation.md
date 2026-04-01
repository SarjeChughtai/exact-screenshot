# Opportunity And Post-Sale Pipeline Foundation

## Status
- Design-first, deferred

## User roles
- `sales_rep`
- `estimator`
- `operations`
- `accounting`
- `owner`
- `admin`

## Business problem
- RFQs, quotes, dealer requests, and deals do not share a stable parent CRM object.
- Post-sale milestones are implicit instead of modeled.

## Current behavior
- Records share `jobId`, but there is no opportunity object or lifecycle owner.

## Target behavior
- Define `opportunities` as the parent lifecycle object for RFQs, quotes, and deals.
- Track potential revenue and lifecycle state: `open`, `won`, `lost`, `abandoned`.
- Define the post-sale milestone model before implementation.

## Files and impact
- Docs first
- Later: migrations, types, context, deal pages, and workflow pages

## Schema/model impact
- New `opportunities` table plus link fields in a later phase

## Tests needed
- Lifecycle integrity
- Deal conversion and reversion path coverage
- Opportunity visibility and permission rules

## Risk
- High
