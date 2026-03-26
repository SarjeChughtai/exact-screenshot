# Calculations

All functions in `src/lib/calculations.ts` (116 lines) and `src/lib/freightEstimate.ts` (100 lines).

---

## calculations.ts

### `lookupSteelTier(sqft: number)` → tier object
Finds the steel pricing tier for a given building sqft. Iterates through `steel_pricing.tiers` and returns the last tier where `sqft >= min_sqft`.

**Example**: 2400 sqft → tier "2000-2999" (avg_cost_sqft: $21.81, avg_wt_sqft: 7.46)

### `calcSteelCost(sqft: number)` → `{ cost: number; weight: number }`
Looks up the size tier, then:
- `cost = avg_cost_sqft × sqft × 1.12` (12% supplier increase)
- `weight = avg_wt_sqft × sqft`

**Example**: 2400 sqft → tier "2000-2999"
- Cost: $21.81 × 2400 × 1.12 = **$58,598**
- Weight: 7.46 × 2400 = **17,904 lbs**

### `calcEngineering(complexityFactors: string[])` → `number`
Sums the matching complexity factor multipliers from referenceData, then:
- `result = base_fee × totalFactor + sell_markup`
- `base_fee = $1,200`, `sell_markup = $500`

**Example**: ["Clear span up to 80ft", "1 Mezzanine"] → factors 1.0 + 1.25 = 2.25
- $1,200 × 2.25 + $500 = **$3,200**

### `calcEngineeringFromFactor(factor: number)` → `number`
Simplified version: `$1,200 × factor + $500`.

**Example**: factor 1.5 → $1,200 × 1.5 + $500 = **$2,300**

### `lookupFoundation(sqft: number, type: 'slab' | 'frost_wall')` → `number`
Looks up the foundation tier (round UP to next tier), optionally applies frost wall multiplier (1.65×), then adds $500 drawings markup.

**Example**: 2400 sqft, slab → tier 3000 → $1,700 + $500 = **$2,200**
**Example**: 2400 sqft, frost wall → $1,700 × 1.65 + $500 = **$3,305**
**Example**: 35000 sqft → 30000 tier ($5,450) + $100×5 (extra 5K sqft) = $5,950 + $500 = **$6,450**

### `lookupInsulation(grade: string)` → `number`
Returns `material_per_sqft` for the given grade, or 0 if not found.

**Example**: "R20/R20" → **$2.05/sqft**

### `calcInsulationArea(width, length, height)` → `{ wallArea, roofArea, total }`
- wallArea = 2 × (width + length) × height
- roofArea = width × length
- total = wallArea + roofArea

**Example**: 40×60×14 → walls: 2×(40+60)×14 = 2,800 sqft, roof: 2,400 sqft, total: **5,200 sqft**

### `calcFreight(distanceKm, weight, remoteLevel)` → `number`
`MAX(minimum, distanceKm × base_rate) + remote_modifier + overweight_surcharge`

- minimum = $4,000
- base_rate = $4.00/km
- overweight_threshold = 40,000 lbs → +$1,500

**Example**: 700 km, 25,000 lbs, "none"
- MAX($4,000, 700 × $4) = MAX($4,000, $2,800) = $4,000
- Remote: $0, Overweight: no → **$4,000**

**Example**: 4,400 km, 45,000 lbs, "moderate"
- MAX($4,000, $17,600) = $17,600
- Remote: +$500, Overweight: +$1,500 → **$19,600**

### `getProvinceTax(code: string)` → province object
Returns the matching province record from `tax_rates.provinces`, or defaults to first entry (Alberta).

### `calcTax(amount, provinceCode)` → `{ gstHst, qst, total }`
- HST provinces: `gstHst = amount × order_rate`, `qst = 0`
- GST+QST (Quebec): `gstHst = amount × 0.05`, `qst = amount × 0.09975`

**Example**: $100,000 in ON → HST = $100,000 × 0.13 = **$13,000**
**Example**: $100,000 in QC → GST = $5,000, QST = $9,975, total = **$14,975**

### `getMarkupRate(steelAfter12: number)` → `number`
Returns the tiered markup rate based on steel value after supplier increase.

**Example**: $45,000 → rate = **0.10** (under $50K tier)

### `calcMarkup(steelAfter12: number)` → `number`
Applies tiered rate, enforces $3K minimum margin for steel < $30K.

**Example**: $45,000 → 0.10 × $45,000 = **$4,500**
**Example**: $25,000 → 0.10 × $25,000 = $2,500 → enforced **$3,000** (minimum)

### `formatCurrency(amount)` → `string`
Canadian locale currency: `$1,234.56`

### `formatNumber(n, decimals?)` → `string`
Canadian locale number: `1,234`

### Exported Constants
- `PROVINCES`: `{ code, name }[]` from tax_rates
- `INSULATION_GRADES`: grade names from insulation_pricing
- `ENGINEERING_FACTORS`: complexity factors from engineering_fees
- `REMOTE_LEVELS`: `['none', 'moderate', 'remote', 'extreme']`

---

## freightEstimate.ts

Estimates freight distance and remote level from a postal code, city name, or address. All distances are from **Bradford, ON** (company HQ).

### Data Sources

**POSTAL_PREFIX_MAP** (16 entries): Maps the first letter of a Canadian postal code to approximate province, distance, and remote level.

| Prefix | Province | Distance | Remote |
|--------|----------|----------|--------|
| K | ON | 300 km | none |
| L | ON | 100 km | none |
| M | ON | 80 km | none |
| P | ON | 500 km | moderate |
| G | QC | 700 km | none |
| T | AB | 3,400 km | none |
| V | BC | 4,400 km | none |
| A | NL | 2,500 km | remote |
| X | NT | 4,500 km | extreme |
| Y | YT | 5,500 km | extreme |

**CITY_DISTANCES** (30 entries): Specific city overrides with more accurate distances. Includes cities from seed deals (Cherryville, Wabasca, Beresford, Baie St-Paul, etc.) and major Canadian cities.

### `estimateFreightFromLocation(input: string)` → `FreightEstimate | null`

Lookup cascade:
1. **Postal code match**: Regex `[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d` → use first letter to look up `POSTAL_PREFIX_MAP`
2. **City name match**: Lowercase input, check if it contains any key from `CITY_DISTANCES`
3. **First letter fallback**: Use the first character as a postal code prefix
4. Returns `null` if no match

**Return type**: `{ distanceKm, province, remote, method: 'postal_code' | 'city' | 'manual' }`

**Example**: "P3E 4N1" → prefix "P" → ON, 500 km, moderate
**Example**: "kamloops" → city match → BC, 4,100 km, none
**Example**: "Wabasca" → city match → AB, 4,000 km, extreme
