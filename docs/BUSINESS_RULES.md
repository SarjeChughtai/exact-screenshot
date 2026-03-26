# Business Rules

## Steel Pricing

1. **Source data**: 143 deduplicated MBS factory projects provide tier-based pricing.
2. **$/lb flow**: MBS cost file gives a total weight and total cost → divide for $/lb.
3. **12% supplier increase**: Applied to the $/lb rate, then multiplied by total weight. This is a mandatory cost adjustment — not a markup for profit.
4. **Tiered internal markup**: Applied to the steel value AFTER supplier increase. Tiers: 10% (under $50K), 7.5% ($50-200K), 6.5% ($200-500K), 5.5% ($500K-1M), 5% (over $1M).
5. **$3K minimum margin**: If steel after supplier increase is under $30,000, ensure at least $3,000 in markup regardless of the tier rate.
6. **$/lb sanity check**: Final $/lb (adjustedSteel / weight) should land between **$2.15 and $2.30**. The Internal Quote Builder shows a green/yellow indicator.

## Tax

1. **HST provinces**: ON (13%), NB/NL/NS/PE (15%) — single combined tax.
2. **GST-only provinces**: AB, BC, MB, SK, NT, YT, NU — PST does **not** apply to steel building orders, so only 5% GST.
3. **Quebec (GST+QST)**: GST 5% + QST 9.975% = 14.975%. Calculated separately and shown as two line items.
4. **Why PST excluded**: Provincial sales tax exemptions apply to steel building materials in these jurisdictions. The `order_rate` field in reference data already reflects the correct rate.

## Commission

1. **Sales rep commission**: 30% of Gross Profit.
2. **GP base toggle**: Per deal, admin can choose whether commission is calculated on "True" GP (real internal costs) or "Rep-Visible" GP (marked-up costs shown to the rep). This lets the company protect true margins while still paying fair commission.
3. **Payout schedule**: Commission is paid in three stages tied to client deposit markers:
   - **1st Deposit (30% paid)**: Rep receives 50% of total commission
   - **2nd Deposit (70% paid)**: Rep receives 25% of total commission
   - **3rd/Final (100% paid)**: Rep receives remaining 25%
4. **Owner payouts**: 3 owners, each gets 5% of **TRUE** Gross Profit (never the marked-up version). Triggered at the 70% client payment marker (2nd deposit).
5. **Estimator payout**: 5% of TRUE Gross Profit. Also triggered at the 70% marker.

## Factory Payments (TSC)

1. **Schedule**: 15% / 50% / 35% of the factory contract value (trueMaterial from InternalCosts).
2. **Triggers**: 
   - 15% — to begin work and lock in pricing
   - 50% — to begin production
   - 35% — due before pickup / shipping
3. The Vendor Payments page automatically shows the expected amounts based on this schedule.

## Insulation

1. **Pass-through at cost**: No markup applied. Silvercote material prices already include a 12.5% supplier markup.
2. **Delivery excluded**: Insulation delivery cost varies by location and is quoted separately. The app uses `material_per_sqft` only.
3. **Area calculation**: Total insulation area = wall area (2 × (W+L) × H) + roof area (W × L).

## Foundation

1. **Slab vs. Frost Wall**: Frost wall costs 65% more than slab (multiplier: 1.65×).
2. **Tier lookup**: Round UP to the next 1,000 sqft tier. A 2,400 sqft building uses the 3,000 sqft tier.
3. **+$500 markup**: Applied to all foundation costs (drawings markup).
4. **Over 30K sqft**: Add $100 per additional 1,000 sqft above 30,000.

## Engineering

1. **Base fee**: $1,200 (8 hours × $150/hr).
2. **Complexity factor**: Multiplier based on building features. Multiple factors can apply (summed in Estimator, single factor in Quote Builder).
3. **+$500 sell markup**: Added on top of the calculated fee.
4. **Formula**: `$1,200 × factor + $500`

## Freight

1. **Formula**: `MAX($4,000, distance_km × $4.00) + remote_modifier + overweight_surcharge`
2. **Always FTL**: Full truckload, unshared flatbed.
3. **Origin**: Bradford, ON.
4. **Overweight**: If building steel exceeds 40,000 lbs, add $1,500 surcharge.
5. **Remote modifiers**: None ($0), Moderate (+$500), Remote (+$1,500), Extreme (+$3,000).
6. **Auto-estimate**: Postal code or city name triggers automatic distance lookup from the freight estimate module.
7. **Override**: Freight Board actual cost overrides the estimate once updated.

## Role-Based Access

1. **Admin**: Full access to everything. Can see compliance notes, audit trails, all costs.
2. **Owner**: Full access to all menus and data.
3. **Accounting**: Financials, payments, ledger, HST, commission statements.
4. **Operations**: Deal status editing, internal cost amounts, production status.
5. **Sales Reps**: Quick Estimator, external Quote Builder, Quote Log. Can only see **their own** deals and quotes. Never see true internal costs or true margins.
6. **Freight**: Freight Board only. Can edit freight cost details (actual freight, carrier, status). No pricing or profit info exposed.
7. **Multi-role**: Users can hold multiple roles simultaneously. Access is the union of all assigned roles.

## What Reps Cannot See

- True internal material costs
- True GP or margin percentages
- Owner/estimator commission amounts
- Internal Quote Builder (admin/owner only)
- Other reps' deals or quotes
- Payment ledger details
- HST position
