# Operations Manual

## Main tools
- `Internal Quote Log`
- `Internal Quote Builder`
- `Import Review`
- `Draft Log`
- `Master Deals`
- `Production Status`
- `Internal Costs`

## Standard workflow
1. Open the operations queue from RFQ workflow.
2. Launch the RFQ into `Internal Quote Builder`.
3. Confirm imported supplier data and job information.
4. Correct supplier extraction issues in `Import Review` if needed.
5. Save and finalize the internal quote.
6. Support the transition to external quote and deal execution.
7. Maintain live production state on active deals.

## Internal Quote Builder
Use this tool to:
- import RFQ job data
- pull historical supplier files
- upload new MBS and insulation files
- calculate supplier cost, markup, freight, insulation, and contingency
- generate the internal quote PDF

Before saving an internal quote:
- confirm job ID
- confirm client name and client ID
- verify dimensions for each building tab
- verify steel weight, supplier cost/lb, and total supplier cost
- verify freight and location-derived values

## Import Review
Use Import Review as the correction gate for uploaded supplier files.

Best practice:
- correct the warehouse/source extraction first
- then rebuild or refresh the internal quote if needed
- prefer the primary visible document set when duplicates exist
- treat hidden duplicates as audit artifacts, not default operator inputs

## RFQ Workspace
- use `Quote Log` in `pipeline` mode for queue-style RFQ movement across sales, estimating, and operations
- use `Quote Log` in `log` mode for detailed RFQ review, saved PDF checks, and document actions
- admin, owner, and operations users can filter RFQs by estimator assignee from the same route

## Draft Log
Use when internal quote work is incomplete and should not be finalized yet.

## Production Status
Current rule:
- treat the deal record as the main production state until the future opportunity redesign lands
- use milestone count, next step, and blocked reason to understand why a deal is or is not freight-ready

## Opportunities
- use `Opportunities` as the internal CRM home for shared job lifecycle status
- filter by sales rep and estimator when reviewing load or ownership

## Common mistakes to avoid
- building an internal quote against the wrong job ID
- using an older duplicate supplier file
- skipping review for `needs_review` imports
- updating production stages based on assumption rather than confirmed progress
