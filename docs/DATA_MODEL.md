# Data Model

All types defined in `src/types/index.ts`.

## Quote

Created by Internal Quote Builder or Sales Quote Builder. Stored in `AppContext.quotes`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID, unique identifier |
| `date` | `string` | ISO date of quote creation |
| `jobId` | `string` | Links to Deal.jobId. Auto-generated if blank (`CSB-xxxxx`) |
| `jobName` | `string` | Building description (e.g., "40x60 Steel Building") |
| `clientName` | `string` | Customer name |
| `clientId` | `string` | Customer account number |
| `salesRep` | `string` | Assigned sales rep name |
| `estimator` | `string` | Estimator who built the quote |
| `province` | `string` | 2-letter province code (ON, QC, BC, etc.) |
| `city` | `string` | Delivery city |
| `address` | `string` | Full delivery address |
| `postalCode` | `string` | Canadian postal code |
| `width` | `number` | Building width in feet |
| `length` | `number` | Building length in feet |
| `height` | `number` | Eave height in feet (default 14) |
| `sqft` | `number` | width × length |
| `weight` | `number` | Steel weight in lbs |
| `baseSteelCost` | `number` | Raw MBS factory cost before any markup |
| `steelAfter12` | `number` | Steel cost after supplier increase (12%) |
| `markup` | `number` | Tiered markup + any additional markup amount |
| `adjustedSteel` | `number` | steelAfter12 + markup = final steel cost |
| `engineering` | `number` | Engineering fee (base × factor + $500) |
| `foundation` | `number` | Foundation drawing cost |
| `foundationType` | `'slab' \| 'frost_wall'` | Foundation type |
| `gutters` | `number` | Gutters & downspouts cost |
| `liners` | `number` | Liner panels cost |
| `insulation` | `number` | Insulation cost (pass-through) |
| `insulationGrade` | `string` | R-value grade (e.g., "R20/R20") |
| `freight` | `number` | Freight estimate or override |
| `combinedTotal` | `number` | Sum of all line items |
| `perSqft` | `number` | combinedTotal / sqft |
| `perLb` | `number` | adjustedSteel / weight |
| `contingencyPct` | `number` | Contingency percentage (default 5%) |
| `contingency` | `number` | combinedTotal × contingencyPct/100 |
| `gstHst` | `number` | GST or HST amount |
| `qst` | `number` | QST amount (Quebec only) |
| `grandTotal` | `number` | Total including tax |
| `status` | `QuoteStatus` | Current quote status |

## QuoteStatus

`'Draft' | 'Sent' | 'Follow Up' | 'Won' | 'Lost' | 'Expired'`

## Deal

Created from "Won" quotes via QuoteLog → Convert to Deal, or seeded via `seedDeals.ts`. Stored in `AppContext.deals`.

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Primary key. Format: C26-XXX or similar |
| `jobName` | `string` | Building description |
| `clientName` | `string` | Customer name |
| `clientId` | `string` | Customer account number |
| `salesRep` | `string` | Assigned sales rep |
| `estimator` | `string` | Estimator |
| `teamLead` | `string` | Operations team lead |
| `province` | `string` | Province code |
| `city` | `string` | Delivery city |
| `address` | `string` | Full address |
| `postalCode` | `string` | Postal code |
| `width/length/height` | `number` | Building dimensions in feet |
| `sqft` | `number` | Square footage |
| `weight` | `number` | Steel weight in lbs |
| `taxRate` | `number` | Applicable tax rate |
| `taxType` | `string` | Tax type (HST, GST, GST+QST) |
| `orderType` | `string` | "Steel building" or other |
| `dateSigned` | `string` | ISO date agreement was signed |
| `dealStatus` | `DealStatus` | Current deal stage |
| `paymentStatus` | `PaymentStatus` | PAID / PARTIAL / UNPAID |
| `productionStatus` | `ProductionStage` | Factory production stage |
| `freightStatus` | `FreightStatus` | Shipping status |
| `insulationStatus` | `string` | Insulation order status |
| `deliveryDate` | `string` | Expected delivery date |
| `pickupDate` | `string` | Pickup date from factory |
| `notes` | `string` | Free-text notes |

## DealStatus

`'Lead' | 'Quoted' | 'Pending Payment' | 'In Progress' | 'In Production' | 'Shipped' | 'Delivered' | 'Complete' | 'Cancelled' | 'On Hold'`

## PaymentStatus

`'PAID' | 'PARTIAL' | 'UNPAID'`

## FreightStatus

`'Pending' | 'Booked' | 'In Transit' | 'Delivered'`

## ProductionStage

`'Submitted' | 'Acknowledged' | 'In Production' | 'QC Complete' | 'Ship Ready' | 'Shipped' | 'Delivered'`

## InternalCost

True vs. rep-visible cost breakdown per deal. Stored in `AppContext.internalCosts`.

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Links to Deal.jobId |
| `trueMaterial` | `number` | Actual factory steel cost |
| `trueStructuralDrawing` | `number` | Actual structural drawing cost |
| `trueFoundationDrawing` | `number` | Actual foundation drawing cost |
| `trueFreight` | `number` | Actual freight cost |
| `trueInsulation` | `number` | Actual insulation cost |
| `repMaterial` | `number` | Rep-visible steel cost (marked up) |
| `repStructuralDrawing` | `number` | Rep-visible structural drawing cost |
| `repFoundationDrawing` | `number` | Rep-visible foundation drawing cost |
| `repFreight` | `number` | Rep-visible freight cost |
| `repInsulation` | `number` | Rep-visible insulation cost |
| `salePrice` | `number` | Final sale price to client |
| `showRepCosts` | `boolean` | Toggle: use rep costs for commission calc |

## PaymentEntry

Individual payment record. Stored in `AppContext.payments`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `date` | `string` | Payment date |
| `jobId` | `string` | Links to Deal.jobId |
| `clientVendorName` | `string` | Who paid / who was paid |
| `direction` | `PaymentDirection` | Money flow direction |
| `type` | `PaymentType` | Category of payment |
| `amountExclTax` | `number` | Amount before tax |
| `province` | `string` | Province for tax calc |
| `taxRate` | `number` | Applied tax rate |
| `taxAmount` | `number` | Tax amount |
| `totalInclTax` | `number` | Amount + tax |
| `paymentMethod` | `string` | e.g., "Cheque", "E-Transfer" |
| `referenceNumber` | `string` | Cheque #, confirmation # |
| `qbSynced` | `boolean` | QuickBooks sync status |
| `notes` | `string` | Free-text notes |

## PaymentDirection

`'Client Payment IN' | 'Vendor Payment OUT' | 'Refund IN' | 'Refund OUT'`

## PaymentType

`'Deposit' | 'Progress Payment' | 'Final Payment' | 'Freight' | 'Insulation' | 'Drawings' | 'Other'`

## ProductionRecord

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Links to Deal |
| `submitted` – `delivered` | `boolean` | Stage completion flags |
| `drawingsStatus` | `string` | Drawing progress |
| `insulationStatus` | `string` | Insulation order status |

## FreightRecord

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Links to Deal |
| `clientName` | `string` | Customer name |
| `buildingSize` | `string` | e.g., "40x60" |
| `weight` | `number` | Steel weight in lbs |
| `pickupAddress` | `string` | Factory pickup location |
| `deliveryAddress` | `string` | Client delivery address |
| `estDistance` | `number` | Estimated distance in km |
| `estFreight` | `number` | Estimated freight cost |
| `actualFreight` | `number` | Actual freight cost (overrides estimate) |
| `paid` | `boolean` | Whether freight has been paid |
| `carrier` | `string` | Carrier name |
| `status` | `FreightStatus` | Shipping status |

## Relationships

```
Quote.jobId ──→ Deal.jobId ──→ InternalCost.jobId
                            ──→ PaymentEntry.jobId
                            ──→ ProductionRecord.jobId
                            ──→ FreightRecord.jobId
```

All linked by `jobId`. A Quote can exist without a Deal (pre-conversion). A Deal may have zero or more of each related record.

## Seed Data

`src/data/seedDeals.ts` contains 8 real deals from the Canada Steel order tracker:
- 2 cancelled QC deals (Gratien Menard)
- 3 in-progress deals (BC, NB, AB)
- 2 in-progress ON deals
- 1 lead (BC, 60x200)

Sales reps: Neil Waxford (7 deals), Robert Brown (1 deal). All are steel building orders with real addresses, postal codes, and notes.
