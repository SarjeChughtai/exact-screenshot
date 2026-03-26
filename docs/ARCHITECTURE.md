# Architecture

## State Management

### AppContext (`src/context/AppContext.tsx`)

Central state store holding six collections:

| Collection | Type | Key Field |
|------------|------|-----------|
| `quotes` | `Quote[]` | `id` (UUID) |
| `deals` | `Deal[]` | `jobId` |
| `internalCosts` | `InternalCost[]` | `jobId` |
| `payments` | `PaymentEntry[]` | `id` (UUID) |
| `production` | `ProductionRecord[]` | `jobId` |
| `freight` | `FreightRecord[]` | `jobId` |

**Persistence**: All state is serialized to `localStorage` key `canada_steel_state` on every mutation via `saveState()` (line 45-47). On load, `loadState()` (line 30-43) reads from localStorage and seeds deals from `SEED_DEALS` if none exist.

**Mutation pattern**: Every mutator calls `update(fn)` (line 54-60) which applies a pure function to state, saves to localStorage, and triggers re-render.

Available mutations: `addQuote`, `updateQuote`, `addDeal`, `updateDeal`, `addInternalCost`, `updateInternalCost`, `addPayment`, `updatePayment`, `deletePayment`, `addProduction`, `updateProduction`, `addFreight`, `updateFreight`.

### RoleContext (`src/context/RoleContext.tsx`)

Manages current user identity and role-based access control.

**Roles**: `admin`, `owner`, `accounting`, `operations`, `sales_rep`, `freight`

**Persistence**: User profile stored in `localStorage` key `canada_steel_user`. Defaults to Admin.

**Access Control**: `MODULE_ACCESS` map (line 20-39) defines which roles can access each module. `canAccess(module)` checks if any of the user's roles are in the allowed list.

Users can hold multiple roles simultaneously. The sidebar filters menu items via `canAccess()`.

### SettingsContext (`src/context/SettingsContext.tsx`)

Global configuration: markup tiers, personnel list, status dropdown values, freight/engineering defaults.

**Persistence**: `localStorage` key `canada_steel_settings`. Falls back to `DEFAULT_SETTINGS`.

## Data Flow

```
User Input (forms/uploads)
    ↓
Page Component (e.g., InternalQuoteBuilder)
    ↓
calculations.ts / freightEstimate.ts (compute values)
    ↓
AppContext mutator (e.g., addQuote)
    ↓
localStorage (persisted)
    ↓
Display Pages (Dashboard, QuoteLog, DealPL, etc.)
```

Key flows:
1. **Quick Estimator** → ballpark price (not saved)
2. **Internal Quote Builder** → `addQuote()` → Quote Log
3. **Sales Quote Builder** → `addQuote()` → Quote Log
4. **Quote Log** → "Won" status → `addDeal()` → Master Deals
5. **Payment Ledger** → `addPayment()` → auto-populates ClientPayments, VendorPayments, MonthlyHST, DealPL
6. **Internal Costs** → `addInternalCost()` → feeds CommissionProfit, ProjectedFinancials, CommissionStatement

## Routing

Defined in `src/App.tsx` (lines 42-62):

| Route | Component | Module |
|-------|-----------|--------|
| `/` | Dashboard | dashboard |
| `/estimator` | QuickEstimator | estimator |
| `/internal-quote-builder` | InternalQuoteBuilder | internal-quote-builder |
| `/quote-builder` | QuoteBuilder | quote-builder |
| `/quote-log` | QuoteLog | quote-log |
| `/deals` | MasterDeals | deals |
| `/internal-costs` | InternalCosts | internal-costs |
| `/financials` | ProjectedFinancials | financials |
| `/payment-ledger` | PaymentLedger | payment-ledger |
| `/client-payments` | ClientPayments | client-payments |
| `/vendor-payments` | VendorPayments | vendor-payments |
| `/deal-pl` | DealPL | deal-pl |
| `/monthly-hst` | MonthlyHST | monthly-hst |
| `/freight` | FreightBoard | freight |
| `/production` | ProductionStatus | production |
| `/commission` | CommissionProfit | commission |
| `/commission-statement` | CommissionStatement | commission-statement |
| `/settings` | Settings | settings |
| `*` | NotFound | — |

## Provider Hierarchy

```
QueryClientProvider
  └── TooltipProvider
      └── RoleProvider
          └── SettingsProvider
              └── AppProvider
                  └── BrowserRouter
                      └── Layout (Sidebar + content)
                          └── Routes
```

## Sidebar Navigation

`src/components/AppSidebar.tsx` organizes routes into 6 collapsible groups: Overview, Quotes, Deals, Financials, Freight, System. Groups auto-expand if they contain the active route. The sidebar footer includes a role picker for demo/dev switching.
