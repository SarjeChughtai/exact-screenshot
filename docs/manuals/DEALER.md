# Dealer Manual

## Main tools
- `Dealer RFQ`
- `My Requests` on `/dealer-log`
- dealer profile settings

## Dealer home: `/dealer-log`
`/dealer-log` is now the dealer workspace, not just a request list.

Each project shows:
- current stage
- latest quote status
- next expected dealer-visible action
- latest update timestamp
- saved PDFs
- primary visible support files
- hidden duplicate count as a summary only

## Filters and views
- `Stage` filters the workspace by lifecycle stage.
- `Search` matches job ID, client name, and job name.
- `Cards` is the default project-workspace view.
- `Table` keeps the expandable row view for deeper detail.

Supported dealer stages:
- `Request Submitted`
- `Estimating`
- `Quote Ready`
- `Won`
- `Lost`
- `In Production`
- `Freight Booked`
- `Delivered`

## Standard workflow
1. Keep the dealer profile current.
2. Submit RFQs through `Dealer RFQ`.
3. Track request and project status in `/dealer-log`.
4. Open the latest PDF or support file directly from the project card or expanded row.
5. Start a new RFQ from the workspace when a new request is needed.

## Document visibility rules
Dealers can see:
- saved PDFs tied to the same job
- primary visible support files tied to the same job

Dealers cannot see:
- hidden duplicate files as selectable items
- internal cost-file review detail
- internal duplicate-resolution controls

## Dealer RFQ checklist
- client name
- location
- building dimensions
- roof style and pitch
- liners, gutters, insulation, notes

## Best practices
- keep contact email and phone current so operations can follow up
- search `/dealer-log` before creating a new RFQ for the same project
- review the latest stage and quote status before asking for an update
- use saved PDFs in the workspace as the current customer-facing document set

## Common mistakes to avoid
- duplicate submissions for the same job
- relying on older support files when a newer PDF is already attached
- assuming hidden duplicate counts mean files are missing; they only indicate non-primary duplicates are being kept out of normal dealer flow
- out-of-date dealer profile details
