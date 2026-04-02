# Sample Quote & Expected Output

This file contains a real sample quote in the format received from the factory estimator, followed by the expected parser output. Use this for testing and as a reference for field mapping.

---

## Sample Input Quote

```
Quote – 1052 – Canada Steel Buildings-SC
Client ID: N/A
Job ID: 1052
Building Size: 80' x 120' x 24'
Total Area: 9600 sq ft
Total Steel Weight: 76417 lbs
Base Steel Cost: $160,493.46
Steel $/sqft: $16.72
Engineering & Design Fee: $5,000.00
Foundation Drawing Cost: $3,200.00
Updated Steel Total: $168,693.46
Accessories (costs already included in total)
Gutters & Downspouts: $6,447.65
Liner Panels: $0.00
Insulation: Pending – $0.00
Project Summary
Combined Total: $168,693.46
Updated $/sqft: $17.57
Suggested Contingency (10%): $16,869.35
Projected Total with Contingency: $185,562.81
```

---

## Expected Parser Output

### Phase 1 — Extracted Data Summary

| Field | Value | Status |
|---|---|---|
| Job ID | 1052 | ✓ |
| Client Name | Canada Steel Buildings-SC | ✓ |
| Client ID | N/A | Not provided |
| Building Width | 80 ft | ✓ |
| Building Length | 120 ft | ✓ |
| Eave Height | 24 ft | ✓ |
| Total Area | 9,600 sq ft | ✓ (matches 80 × 120) |
| Total Steel Weight | 76,417 lbs | ✓ |
| Steel Weight / sqft | 7.96 lbs/sqft | ✓ within normal range |
| Base Steel Cost | $160,493.46 | ✓ |
| Steel $/sqft | $16.72 | ✓ |
| Engineering & Design Fee | $5,000.00 | ✓ |
| Foundation Drawing Cost | $3,200.00 | ✓ |
| Gutters & Downspouts | $6,447.65 | ✓ |
| Liner Panels | $0.00 | ⚠ Verify — included in base or not required? |
| Insulation | $0.00 (PENDING) | ⚠ Pending — final cost unknown |
| Combined Total (quoted) | $168,693.46 | ✓ |
| Updated $/sqft (quoted) | $17.57 | ✓ |
| Quote Validity | Not provided | ⚠ Missing |
| Lead Time | Not provided | ⚠ Missing |
| Special Conditions | Accessories noted as "already included in total" | ✓ |

### Phase 2a — Arithmetic Verification

| Check | Expected | Quoted | Status |
|---|---|---|---|
| Area = Width × Length | 80 × 120 = 9,600 sq ft | 9,600 sq ft | ✓ Pass |
| Steel $/sqft = Base ÷ Area | $160,493.46 ÷ 9,600 = $16.72 | $16.72 | ✓ Pass |
| Updated $/sqft = Total ÷ Area | $168,693.46 ÷ 9,600 = $17.572… ≈ $17.57 | $17.57 | ✓ Pass |
| Contingency (10%) | $168,693.46 × 0.10 = $16,869.35 | $16,869.35 | ✓ Pass |
| Projected Total | $168,693.46 + $16,869.35 = $185,562.81 | $185,562.81 | ✓ Pass |

> Note: The quote states accessories are "already included in total." The Combined Total of $168,693.46 matches the Updated Steel Total line, suggesting the accessory subtotals are informational breakouts, not additive. Arithmetic is consistent.

### Phase 2b — Markup Table

Cost base = Projected Total with Contingency = **$185,562.81**

| Markup % | Sell Price | Gross Profit | Margin | $/sq ft |
|----------|------------|-------------|--------|---------|
| 18% | $226,296.11 | $40,733.30 | 18.00% | $23.57 |
| 20% | $231,953.51 | $46,390.70 | 20.00% | $24.16 |
| 22% | $237,901.04 | $52,338.23 | 22.00% | $24.78 |
| 25% | $247,417.08 | $61,854.27 | 25.00% | $25.77 |
| 28% | $257,726.13 | $72,163.32 | 28.00% | $26.85 |
| 30% | $265,089.73 | $79,526.92 | 30.00% | $27.61 |

> Formulas: Sell Price = Cost Base ÷ (1 − Margin%); Gross Profit = Sell Price − Cost Base; $/sqft = Sell Price ÷ 9,600

### Phase 3 — Full Internal Email

```
Subject: INTERNAL – Pricing summary for Job 1052 – Canada Steel Buildings-SC

Hi Team,

Here's the internal breakdown for Job 1052 – Canada Steel Buildings-SC. Do not share this email or its contents with the client.

─────────────────────────────────────────────
## 1. Project Overview
─────────────────────────────────────────────

- Client ID:          N/A
- Job ID:             1052
- Building size:      80' × 120' × 24' (W × L × Eave)
- Total area:         9,600 sq ft
- Total steel weight: 76,417 lbs  (7.96 lbs/sq ft)
- Quote validity:     Not stated
- Lead time:          Not stated


─────────────────────────────────────────────
## 2. Internal Cost Breakdown
─────────────────────────────────────────────

  - Base steel cost:                 $160,493.46
  - Engineering & design fee:          $5,000.00
  - Foundation drawing cost:           $3,200.00
  - Gutters & downspouts:              $6,447.65
  - Liner panels:                          $0.00  ← included in base / not separately charged
  - Insulation:                        PENDING – $0.00  ⚠ confirm with estimator

Combined total internal cost:   $168,693.46
Cost per sq ft:                 $17.57/sq ft


─────────────────────────────────────────────
## 3. Contingency
─────────────────────────────────────────────

- Suggested contingency (10%):               $16,869.35
- Projected total with contingency:         $185,562.81

This is our cost floor. All sell prices below must exceed this figure.


─────────────────────────────────────────────
## 4. Markup Options (based on projected total with contingency)
─────────────────────────────────────────────

| Markup % | Sell Price       | Gross Profit     | Margin  | $/sq ft  |
|----------|-----------------|-----------------|---------|----------|
| 18%      | $226,296.11      | $40,733.30       | 18.00%  | $23.57   |
| 20%      | $231,953.51      | $46,390.70       | 20.00%  | $24.16   |
| 22%      | $237,901.04      | $52,338.23       | 22.00%  | $24.78   |
| 25%      | $247,417.08      | $61,854.27       | 25.00%  | $25.77   |
| 28%      | $257,726.13      | $72,163.32       | 28.00%  | $26.85   |
| 30%      | $265,089.73      | $79,526.92       | 30.00%  | $27.61   |

Target range: 18–30% gross margin.
Highlight your preferred tier when quoting the client.


─────────────────────────────────────────────
## 5. Talking Points for Client
─────────────────────────────────────────────

Use these when presenting the project to the client. Do NOT reference internal costs.

1. This is a fully engineered 80' × 120' clear-span structure with a generous 24-foot eave height — ideal for equipment clearance, mezzanines, or high-bay racking.
2. At 9,600 sq ft, the building offers substantial usable floor area in a single open-bay layout with no interior columns.
3. The steel package includes gutters and downspouts, so the exterior drainage system is fully integrated — no separate allowance needed.
4. Pre-engineered construction significantly reduces on-site labour time and eliminates most structural uncertainty before ground is even broken.
5. Engineering and foundation drawings are included in the package, giving you permit-ready documentation from the start.


─────────────────────────────────────────────
## 6. Watch Out
─────────────────────────────────────────────

  ⚠ INSULATION is listed as PENDING ($0.00) — final cost is unknown. Do not quote the client until insulation pricing is confirmed. This could meaningfully increase the cost base.
  ⚠ LINER PANELS show $0.00 — confirm with the estimator whether this is included in the base steel cost or simply not part of this spec.
  ⚠ NO QUOTE EXPIRY DATE provided — steel pricing can change. Confirm validity window with the factory before presenting to the client.
  ⚠ NO LEAD TIME stated — confirm production schedule and delivery window before making any timeline commitments to the client.
  ⚠ STEEL WEIGHT of 76,417 lbs (7.96 lbs/sqft) is within the normal range for this building size, but is on the heavier side — may indicate heavier snow/wind loads or custom specs. Verify with estimator.


─────────────────────────────────────────────
Prepared by AI Agent | April 2, 2026 at 12:34 AM EDT
INTERNAL USE ONLY – Canada Steel Buildings, Vaughan, ON
─────────────────────────────────────────────
```
