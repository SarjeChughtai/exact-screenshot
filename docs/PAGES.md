# Pages

## Dashboard (`/`)
**Purpose**: Role-aware overview of pipeline, KPIs, active quotes, and recent deals.

**Reads**: `quotes`, `deals`, `payments`, `freight` from AppContext; `currentUser`, `hasAnyRole` from RoleContext.

**Writes**: Nothing.

**Role behavior**:
- **Sales reps**: See only their deals/quotes, get an "Active Quotes" count instead of revenue/cost stats.
- **Admin/Owner/Others**: See total revenue in, costs out, active freight, and all deals.

**Key UI**: Stat cards grid, 8-stage pipeline visualization (Lead → Complete), Active Quotes table (for quotes in Draft/Sent/Follow Up), Recent Deals table with status badges.

---

## Quick Estimator (`/estimator`)
**Purpose**: Instant ballpark pricing before requesting a factory quote.

**Reads**: Nothing from AppContext (uses calculation functions only).

**Writes**: Nothing (results are display-only, not persisted).

**Key actions**: Enter dimensions → select province/foundation/insulation/liners/gutters → check engineering complexity factors → click "Calculate Estimate". Auto freight lookup from postal code/city.

**UI**: Two-column layout — input form left, result summary right with line-by-line breakdown.

---

## Internal Quote Builder (`/internal-quote-builder`)
**Purpose**: Build internal sales quotes from MBS/Silvercote PDF cost files with supplier + tiered markups. Admin/owner tool only.

**Reads**: `deals`, `quotes` from AppContext; `settings`, `getSalesReps()` from SettingsContext.

**Writes**: `addQuote()` to AppContext.

**Key actions**:
- Multi-file drag-and-drop PDF upload (MBS steel + Silvercote insulation)
- Auto-extracts weight, $/lb, dimensions, components from MBS PDFs
- Auto-extracts insulation total from Silvercote PDFs
- Applies supplier markup (default 12%) + tiered markup
- $/lb sanity check ($2.15-$2.30 range indicator)
- Generate quote → Save to Log / Download PDF / Email
- Job ID autocomplete from existing deals

**Known issues**: PDF parsing relies on text extraction patterns that may not match all MBS file formats. The "Download PDF" button actually opens a print dialog (not a true PDF download).

---

## Sales Quote Builder (`/quote-builder`)
**Purpose**: Create external sales quotes for clients. Used by sales reps with their own markups on top of internal numbers.

**Reads**: Nothing from AppContext directly (uses calculation functions).

**Writes**: `addQuote()` to AppContext.

**Key actions**: Enter project info, steel cost, weight → auto-calculates 12% supplier increase + tiered markup + engineering + foundation + freight → Generate Quote → Save to Quote Log.

**UI**: Input form left, generated quote output right (monospace format).

---

## Quote Log (`/quote-log`)
**Purpose**: Track all quotes with status management. Convert won quotes to deals.

**Reads**: `quotes`, `deals` from AppContext.

**Writes**: `updateQuote()` (status changes), `addDeal()` (convert to deal).

**Key actions**: Change quote status via dropdown (Draft → Sent → Follow Up → Won/Lost/Expired). "Won" quotes show a "→ Deal" button to convert.

---

## Master Deals (`/deals`)
**Purpose**: Central deal management table with expandable detail rows.

**Reads**: `deals`, `payments`, `internalCosts` from AppContext; role info from RoleContext; `settings` from SettingsContext.

**Writes**: `updateDeal()` for status changes and notes.

**Key actions**: Filter by status/rep/search. Click to expand deal detail row. Admin/owner/ops can edit deal status, production status, insulation status, and notes inline.

**Role behavior**: Sales reps see only their assigned deals.

---

## Production Status (`/production`)
**Purpose**: Amalgamated view of production progress. Pulls from Master Deals, not a separate dataset.

**Reads**: `deals` from AppContext; `settings` from SettingsContext; roles from RoleContext.

**Writes**: `updateDeal()` for production status and insulation status.

**Key actions**: Admin/owner/ops can change production status and insulation status dropdowns. Progress bar visualizes stage completion.

---

## Internal Costs (`/internal-costs`)
**Purpose**: True vs. rep-visible cost breakdown per deal. Inline editable.

**Reads**: `deals`, `internalCosts` from AppContext.

**Writes**: `addInternalCost()`, `updateInternalCost()`.

**Key actions**: Initialize costs for a deal → edit true/rep values for material, structural/foundation drawings, freight, insulation → set sale price → toggle showRepCosts.

---

## Projected Financials (`/financials`)
**Purpose**: Projected GP and margin per deal, auto-populated from Internal Costs.

**Reads**: `deals`, `internalCosts` from AppContext.

**Writes**: Nothing.

**Key info**: Shows sale price, total costs (true or rep based on toggle), GP, margin %, tax estimate, $/sqft.

---

## Payment Ledger (`/payment-ledger`)
**Purpose**: Record all money in and out — the single source of truth for payments.

**Reads**: `payments`, `deals` from AppContext.

**Writes**: `addPayment()`, `deletePayment()`.

**Key actions**: Add payment form with job ID, direction (in/out), type, amount, method, reference number. Auto-calculates tax from deal's province. Delete individual payments.

---

## Client Payments (`/client-payments`)
**Purpose**: Summary of client payments per deal, auto-aggregated from Payment Ledger.

**Reads**: `deals`, `payments` from AppContext.

**Writes**: Nothing.

**Key info**: Total received, HST collected, payment count, last payment date, payment status per deal.

---

## Vendor Payments (`/vendor-payments`)
**Purpose**: TSC factory payment tracking with 15/50/35 schedule.

**Reads**: `deals`, `payments`, `internalCosts` from AppContext.

**Writes**: Nothing.

**Key info**: TSC contract value (from trueMaterial), scheduled payments (15%, 50%, 35%), actual vendor payments broken out by type (drawings, insulation, freight).

---

## Deal P&L (`/deal-pl`)
**Purpose**: Cash position per deal — client money in minus vendor money out.

**Reads**: `deals`, `payments` from AppContext.

**Writes**: Nothing.

**Key actions**: Click deal row to expand and see individual payment details. Shows net cash position summary for active and cancelled deals.

---

## Monthly HST (`/monthly-hst`)
**Purpose**: Tax collected vs. tax paid by month — net HST position.

**Reads**: `payments` from AppContext.

**Writes**: Nothing.

**Key info**: Groups payments by YYYY-MM, sums tax collected (client payments) vs. tax paid (vendor payments), calculates net position. Shows "Owes" or "Credit" status.

---

## Commission & Profit (`/commission`)
**Purpose**: Commission overview across all deals with payout stage tracking.

**Reads**: `deals`, `internalCosts`, `payments` from AppContext; role info from RoleContext.

**Writes**: Nothing.

**Key actions**: Admin/owner can toggle between true GP and rep-visible GP via switch. Shows per-deal: sale price, GP, total rep commission (30%), payout by stage (50/25/25), owner commission (3×5%), estimator commission (5%).

**Role behavior**: Sales reps see only their own deals.

---

## Commission Statement (`/commission-statement`)
**Purpose**: Generate printable commission statement for a specific deal.

**Reads**: `deals`, `internalCosts`, `payments` from AppContext.

**Writes**: Nothing.

**Key actions**: Select deal → see GP calculation, 30% commission, payout stages, what's eligible based on client payment percentage, track paid/unpaid stages. Download button for printing. Shows owner (3×5%) and estimator (5%) payouts triggered at 70% marker.

---

## Freight Board (`/freight`)
**Purpose**: Freight coordinator view with no pricing/profit information exposed.

**Reads**: `deals`, `freight`, `internalCosts`, `payments` from AppContext.

**Writes**: `updateFreight()` for status changes.

**Key info**: Per-deal freight: building size, weight, province, estimated vs. actual freight, variance, paid status, carrier, status dropdown.

---

## Settings (`/settings`)
**Purpose**: Global configuration for the platform.

**Reads**: `settings` from SettingsContext; entire `AppContext` state for export.

**Writes**: `updateSettings()`.

**Key actions**: Edit supplier increase %, manage personnel (sales reps, estimators, team leads), customize status dropdown lists, export/import all data as JSON backup.
