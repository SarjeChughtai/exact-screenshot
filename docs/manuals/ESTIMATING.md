# Estimating Manual

## Main tools
- `RFQ Workflow Queues`
- `RFQ Log`
- `Quote RFQ`
- `Import Review`
- `Internal Quote Builder`

## Scope
Estimators work only on RFQs assigned to them or explicitly tied to their estimator identity in estimator-only views.

## Standard workflow
1. Open the estimator queue.
2. Start estimate work on the assigned RFQ.
3. Upload cost files if supplier documents exist.
4. Review extraction accuracy.
5. Submit the RFQ to operations once estimate work is complete.

## What to verify before handoff
- building dimensions
- openings
- location
- liners, gutters, insulation
- attached supplier cost files
- saved RFQ PDF

## Import Review guidance
Check for:
- wrong steel weight
- wrong cost/lb
- wrong total cost
- wrong width, length, height, or pitch
- wrong city or province
- duplicate uploads for the same job and file type

Use:
- `Approve` for clean extraction
- `Edit & Correct` when a parse is structurally close but incorrect
- `Reject` when the file should not be used

## Queue actions
### Start Estimate
- marks the RFQ as in estimator ownership

### Upload Cost Files
- use for MBS or insulation supplier files that should travel with the RFQ

### Submit To Operations
- only use after the estimator work is actually complete

## Common mistakes to avoid
- submitting to operations without cost files or corrected data
- assuming every uploaded file parsed correctly
- working from the wrong duplicate file set
