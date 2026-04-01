# Freight Manual

## Main tools
- `RFQ Board`
- `Freight Board`
- deal and quote records where freight data is referenced

## Standard workflow
1. Review jobs that are ready for freight attention.
2. Post or manage freight RFQs.
3. Track pickup date, delivery date, and destination.
4. Update freight status as the job progresses.
5. Use the blocked reason and next step to decide what upstream milestone is still missing.

## What to verify
- job ID
- pickup date
- delivery date
- drop-off location
- estimated versus actual freight cost
- assigned freight rep if one exists
- milestone progress, freight-ready state, and blocked reason on execution rows
- primary visible document-set counts and saved PDFs on the same job

## Access model
- freight and operations users should see freight-relevant work
- other roles should not rely on freight views for full job visibility

## Modes
- `Pre-Sale Estimate`: used before the job becomes a deal
- `Execution Freight`: used only for deal-stage work once freight posting begins

## Common mistakes to avoid
- booking freight before the job is actually freight-ready
- using stale location or delivery data from an earlier quote version
