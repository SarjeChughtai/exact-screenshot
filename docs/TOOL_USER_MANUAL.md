# Portal Tool User Manual

Last updated: March 31, 2026

## Purpose
This manual is the operator reference for the Canada Steel portal. Use it to understand what each tool does, who should use it, and the expected workflow through the app.

Department-specific guides:
- [Manual Index](/c:/Users/Sarje/.gemini/antigravity/scratch/exact-screenshot-main/docs/manuals/INDEX.md)
- use the index when you want a shorter role-based guide instead of the full cross-portal manual

## Roles
- `admin` / `owner`: full access across all modules and records
- `sales_rep`: sales pipeline, estimates, RFQs, quotes, and assigned jobs
- `estimator`: assigned RFQs, estimate queue, and estimator handoff work
- `operations`: internal quote builder, import review, production, deal execution
- `accounting`: payments, financials, commission statements, deal visibility
- `dealer`: dealer RFQ submission and dealer request history
- `manufacturer`: manufacturer RFQ/bid board for assigned manufacturer work
- `freight`: freight board and assigned freight jobs

## Main Navigation
### Overview
- `Dashboard`: high-level role-based summary
- `Messages`: internal messaging and online presence, if enabled for the user

### Quotes
- `Quick Estimator`: fast budget estimate before a full RFQ
- `Estimates Log`: saved estimates with edit and RFQ import actions
- `Quote RFQ`: create or update internal RFQs
- `RFQ Log`: RFQs, dealer RFQs, and external quotes in one lifecycle view
- `Sales Quote Builder`: external quote creation

### Operations
- `Internal Quote Log`: saved internal quote documents
- `Internal Quote Builder`: create internal costing from RFQs and cost files
- `Import Review`: review and correct extracted supplier document data
- `Draft Log`: saved drafts for internal quote work

### Deals
- `Master Deals`: active post-sale jobs
- `Production Status`: production stage tracking
- `Internal Costs`: true-cost tracking
- `Commission & Profit`: commission and gross-profit view
- `Deal Exposure (P&L)`: exposure and profitability reporting

### Financials
- `Payment Ledger`, `Client Payments`, `Vendor Payments`, `Projected Financials`, `Monthly HST`, `Commission Statement`

### Freight
- `RFQ Board`: freight RFQ posting
- `Freight Board`: booked and active freight work

### Dealer / Vendor
- `Dealer RFQ`, `My Requests`
- `Vendor Board` / `Manufacturer Board`

## Tool Instructions
### 1. Quick Estimator
Use when a sales user needs a fast price range before a formal RFQ.

How to use:
1. Enter client, sales rep, building size, pitch, and location.
2. Use `Lookup` in the freight area if you have a city or postal code.
3. Add insulation, gutters, liners, and engineering factors as needed.
4. Click `Calculate Estimate`.
5. Save the estimate with `Save Estimate` or move to RFQ with `Convert to RFQ`.

Current continuity features:
- unsaved estimator state is kept locally in the browser
- drafts can be saved, reloaded, and deleted
- saved estimates can be reopened for editing
- city, province, and postal code flow into RFQ import

When to use `Save Draft`:
- you are mid-work and do not want to create a formal saved estimate yet

When to use `Save Estimate`:
- you want the estimate in the log as a formal sales record

### 2. Estimates Log
Use to manage saved estimates.

Available actions:
- `Edit`: reopens the estimate in Quick Estimator
- `Import to RFQ`: opens Quote RFQ with the estimate data loaded
- expand a row to review pitch, client ID, city, province, and postal code

### 3. Quote RFQ
Use to create an internal RFQ that estimating and operations will work from.

How to use:
1. Start from scratch or import an estimate.
2. Confirm client, job, building, location, openings, accessories, liners, gutters, and insulation.
3. Submit the RFQ.

Expected result:
- the RFQ is saved in the shared document model
- a PDF is generated and attached
- the app routes you back to the RFQ log and opens the created row

### 4. RFQ Log
Use to review RFQs, dealer RFQs, and external quotes.

What is available:
- row expansion for structured RFQ details
- direct PDF access
- document editing
- quote-to-deal conversion for external quotes
- deal reversion back to quote if a deal was created by mistake

Estimator behavior:
- estimator-only users see only RFQs assigned to them or matching their estimator identity

### 5. RFQ Workflow Queues
Use the queue cards to move RFQs between sales, estimator, and operations handoff steps.

Queue stages:
- `Sales Queue`: submitted RFQs moving through estimating and internal quoting
- `Estimator Queue`: estimator-owned RFQs awaiting work
- `Operations Queue`: estimate-complete RFQs waiting for internal quote creation

Typical estimator flow:
1. Open the estimator queue item.
2. Click `Start Estimate`.
3. Upload cost files if needed.
4. Click `Submit To Operations`.

### 6. Internal Quote Builder
Use to turn RFQs and supplier cost documents into an internal quote.

Common workflows:
- open from an RFQ in the Operations Queue
- import a historical supplier file
- upload new MBS or insulation files
- review generated cost breakdown
- generate and store the internal quote PDF

Important inputs:
- job ID
- client and location
- steel cost data
- insulation
- freight
- contingency

Notes:
- builder state is locally restorable
- single-slope dimensions are supported
- historical files can be pulled from the document gallery

### 7. Import Review
Use when supplier file extraction needs verification or correction.

What to look for:
- parse failures
- wrong weight
- wrong cost/lb
- wrong building dimensions
- wrong location
- duplicate uploads for the same job and file type

Primary actions:
- approve a clean extraction
- edit and correct extracted values
- reject invalid files
- download the original uploaded document

After correction:
- the corrected values are written back to warehouse tables
- the review status changes to `corrected`

### 8. Sales Quote Builder
Use to create the customer-facing quote after internal costing is ready.

Typical path:
1. start from an internal quote or source document
2. confirm markup and totals
3. generate the external quote
4. send it to the client
5. convert to deal once won

### 9. Master Deals
Use to manage jobs after a quote is won.

Typical actions:
- review signed work
- update deal status
- move into production and freight workflows
- coordinate with internal costs, payments, and commissions

### 10. Production Status
Use to track the current production phase for active deals.

Current guidance:
- treat the deal record as the main live production state
- use this tool to reflect the real job stage, not forecasted intent

### 11. Payment and Financial Tools
- `Payment Ledger`: all inbound and outbound transaction records
- `Client Payments`: customer-side payment summary
- `Vendor Payments`: vendor-side payment summary
- `Projected Financials`: forecasted job outcomes
- `Commission Statement`: commission reporting

### 12. Freight Tools
- `RFQ Board`: freight RFQ workflow
- `Freight Board`: active freight execution board

Use freight tools only after the job is at the appropriate lifecycle stage or when a pre-sale freight estimate is needed.

### 13. Dealer Tools
- `Dealer RFQ`: dealer-submitted RFQ form
- `My Requests`: dealer history and request visibility

Dealer best practice:
- keep dealer profile information current so client and contact info prefills correctly

### 14. Vendor / Manufacturer Board
Use this for manufacturer RFQs and manufacturer bid responses.

Behavior:
- internal roles can create manufacturer RFQs and review bids
- manufacturer users see manufacturer-specific board labels and restricted visibility

## Recommended End-to-End Workflow
### Sales to RFQ
1. Build a quick estimate.
2. Save or edit it in the Estimates Log.
3. Import it into Quote RFQ.
4. Submit the RFQ and confirm it appears in RFQ Log.

### RFQ to Operations
1. Estimator opens assigned RFQ in the queue.
2. Starts estimate work and uploads cost files.
3. Submits to operations.
4. Operations opens the RFQ in Internal Quote Builder.

### Quote to Deal
1. Build internal quote.
2. Build external quote.
3. Send quote to client.
4. Convert won quote to deal.
5. If a deal was created by mistake, revert it back to quote from RFQ Log.

## Known Current Limits
- opportunity lifecycle is not implemented yet as a first-class object
- some operations/import reliability work is still being hardened
- chunk-size warnings still exist in the frontend build

## Troubleshooting
### My estimate is gone
- first check the `Workflow Continuity` section in Quick Estimator
- load a draft or saved estimate
- if the browser storage was cleared, local drafts will be lost

### I cannot see an RFQ as an estimator
- check that the RFQ is assigned to your estimator user or estimator name
- estimator-only views intentionally hide RFQs not assigned to you

### I cannot find the PDF
- open the document row in RFQ Log
- use the `PDF` or `Open Saved PDF` action

### An imported supplier file looks wrong
- open `Import Review`
- expand the row
- use `Edit & Correct`
- approve or reject after review
