# Reference Data

All reference data lives in `src/data/referenceData.json` (680 lines).

## Steel Pricing (`steel_pricing`)

**Source**: 143 deduplicated MBS projects, March 2026.

14 size tiers from 0 sqft to 30,000+ sqft. Each tier contains:

| Field | Description |
|-------|-------------|
| `min_sqft` | Minimum sqft for this tier (inclusive) |
| `label` | Human-readable range |
| `avg_cost_sqft` | Average cost per sqft from MBS data |
| `avg_wt_sqft` | Average weight per sqft (lbs) |
| `projects` | Number of projects in this tier |
| `min_cost` / `max_cost` | Cost range in the dataset |
| `avg_price_lb` | Average $/lb for reference |

**Lookup logic** (VLOOKUP-style): Find the largest `min_sqft` ≤ building sqft. Implemented in `lookupSteelTier()` at `calculations.ts:5-13`.

**Key tiers**:
- 0-999 sqft: $33.98/sqft, 10.97 lb/sqft (36 projects)
- 2000-2999: $21.81/sqft, 7.46 lb/sqft (21 projects)
- 10000-14999: $16.23/sqft, 3.62 lb/sqft (6 projects)
- 30000+: $22.32/sqft, 11.32 lb/sqft (1 project)

## Insulation Pricing (`insulation_pricing`)

**Source**: 48 deduplicated Silvercote quotes, March 2026.

10 R-value grades. Material prices already include 12.5% supplier markup. Delivery excluded (varies by location).

| Field | Description |
|-------|-------------|
| `grade` | R-value combination (e.g., "R20/R20" = wall/roof) |
| `material_per_sqft` | Material cost per sqft (used in calculations) |
| `total_per_sqft` | Material + delivery per sqft (for reference only) |
| `avg_delivery` | Average delivery cost across quotes |
| `quotes` | Number of quotes in this grade |

**Most common grade**: R20/R20 at $2.05/sqft material (20 quotes). The app uses `material_per_sqft` only because delivery is quoted separately.

## Foundation Schedule (`foundation_schedule`)

**Source**: Canada Steel internal schedule.

28 tiers from 3,000 to 30,000 sqft in 1,000 sqft increments.

- **Slab cost**: Ranges from $1,700 (≤3,000 sqft) to $5,450 (30,000 sqft)
- **Frost wall multiplier**: 1.65× slab cost. Based on $1,500-$1,700 slab vs $2,500-$3,200 frost wall quotes.
- **Over 30K rule**: Add $100 per additional 1,000 sqft above 30,000
- **+$500 markup**: Added to all foundation costs (via `markup_rules.drawings_markup`)

**Lookup**: Always round UP to next tier. Implemented in `lookupFoundation()` at `calculations.ts:35-54`.

## Engineering Fees (`engineering_fees`)

| Setting | Value |
|---------|-------|
| Base hours | 8 |
| Rate per hour | $150 |
| **Base fee** | **$1,200** |
| **Sell markup** | **+$500** |

**Formula**: `base_fee × complexity_factor + sell_markup`

**Complexity factors** (12 items):

| Factor | Multiplier |
|--------|-----------|
| Clear span up to 80ft | 1.0× (default) |
| Clear span 80-120ft | 1.5× |
| 2-3 buildings combined | 1.5× |
| 4-5 buildings combined | 2.0× |
| Crane up to 10T (brackets) | 1.5× |
| Crane up to 50T (columns) | 2.0× |
| 1 Mezzanine | 1.25× |
| 2-4 Mezzanines same elevation | 1.5× |
| Fascia / Parapets / Canopy | 1.25× |
| Large openings (sliding/bi-fold/hydraulic) | 1.5× |
| Jack Beams | 1.25× |
| Custom loadings | 1.25× |

In Quick Estimator, multiple factors are summed. In Quote Builder, a single factor number is entered.

## Tax Rates (`tax_rates`)

13 provinces/territories. For steel building orders:

| Type | Provinces | Rate | Notes |
|------|-----------|------|-------|
| **HST** | NB, NL, NS, PE | 15% | Single combined tax |
| **HST** | ON | 13% | Single combined tax |
| **GST+QST** | QC | 5% GST + 9.975% QST = 14.975% | Calculated separately |
| **GST only** | AB, BC, MB, SK, NT, YT, NU | 5% | PST does not apply to steel orders |

The `order_rate` field gives the total tax rate applicable to steel building orders. BC/SK/MB have PST but it doesn't apply to steel orders, so `order_rate = 0.05` (GST only).

## Freight Logic (`freight_logic`)

**Origin**: Bradford, ON (company HQ).

**Formula**: `MAX($4,000, distance_km × $4.00) + remote_modifier + overweight_surcharge`

| Setting | Value |
|---------|-------|
| Base rate per km | $4.00 |
| Minimum | $4,000 |
| Overweight threshold | 40,000 lbs |
| Overweight surcharge | $1,500 |
| Truck type | FTL unshared flatbed (always) |

**Remote modifiers**:
- None: $0
- Moderate: +$500
- Remote: +$1,500
- Extreme: +$3,000

**Benchmarks**:
- Small Ontario: $4,000-$6,000 (< 500 km)
- Mid Ontario / Quebec: $5,500-$8,000 (500-1,000 km)
- Prairies: $7,000-$12,000 (2,000-3,500 km)
- BC Interior: $8,000-$14,000 (3,500-4,500 km)
- Maritimes: $6,000-$10,000 (1,200-1,800 km)
- Newfoundland: $12,000-$18,000 (includes ferry)

## Markup Rules (`markup_rules`)

### Supplier Increase
12% applied to $/lb from MBS cost file, then multiplied by weight. This is the base cost adjustment before any internal markup.

### Internal Markup Tiers (on steel after supplier increase)
| Steel Value | Markup Rate |
|-------------|-------------|
| Under $50K | 10% |
| $50K-$200K | 7.5% |
| $200K-$500K | 6.5% |
| $500K-$1M | 5.5% |
| Over $1M | 5% |

### Minimum Margin
If steel after supplier increase < $30,000, ensure at least $3,000 margin.

### Other Markups
- **Drawings markup**: +$500 added to engineering and foundation costs
- **Internal margin on estimator**: 5% applied to subtotal in Quick Estimator only (not in Quote Builder where tiers handle it)
- **Insulation markup**: 0% — Silvercote prices pass through at cost (already include 12.5% supplier markup)
- **Target $/lb range**: $2.15-$2.30 (sanity check on final steel price per pound)

## Commission Rules (`commission_rules`)

### Sales Rep
- **Rate**: 30% of Gross Profit
- **GP base toggle**: Per deal, use "True" (real internal GP) or "Rep-Visible" (marked-up costs GP)
- **Payout schedule**:
  - 1st Deposit (client pays 30%): Rep gets 50% of total commission
  - 2nd Deposit (client pays 70%): Rep gets 25% of total commission
  - 3rd/Final (client pays 100%): Rep gets remaining 25%

### Owners
- 3 owners, each gets 5% of TRUE Gross Profit
- Triggered at 2nd deposit (70% client payment marker)
- Always based on true GP, never marked-up

### Estimator
- 5% of TRUE Gross Profit
- Triggered at 2nd deposit (70% marker)

## Factory Schedule (`factory_schedule`)

Supplier: TSC (The Steel Company)

| Stage | % of Contract | Trigger |
|-------|--------------|---------|
| 1st Payment | 15% | To begin work and secure price |
| 2nd Payment | 50% | To begin production |
| Final Payment | 35% | Due upon pickup / before shipping |
