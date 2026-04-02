# Internal Sales Email Template

Use this template exactly. Replace every `{PLACEHOLDER}` with the correct value before sending. No placeholder should appear in the final email.

---

```
Subject: INTERNAL – Pricing summary for Job {JOB_ID} – {CLIENT_NAME}

Hi {REP_NAME},

Here's the internal breakdown for Job {JOB_ID} – {CLIENT_NAME}. Do not share this email or its contents with the client.

─────────────────────────────────────────────
## 1. Project Overview
─────────────────────────────────────────────

- Client ID:          {CLIENT_ID}
- Job ID:             {JOB_ID}
- Building size:      {WIDTH}' × {LENGTH}' × {EAVE_HEIGHT}' (W × L × Eave)
- Total area:         {AREA} sq ft
- Total steel weight: {WEIGHT} lbs  ({WEIGHT_PER_SQFT} lbs/sq ft)
- Quote validity:     {QUOTE_VALIDITY}
- Lead time:          {LEAD_TIME}


─────────────────────────────────────────────
## 2. Internal Cost Breakdown
─────────────────────────────────────────────

{ITEMIZED_COSTS}

Combined total internal cost:   {COMBINED_TOTAL}
Cost per sq ft:                 {COST_PER_SQFT}/sq ft


─────────────────────────────────────────────
## 3. Contingency
─────────────────────────────────────────────

- Suggested contingency ({CONTINGENCY_PCT}%):    {CONTINGENCY_AMOUNT}
- Projected total with contingency:              {TOTAL_WITH_CONTINGENCY}

This is our cost floor. All sell prices below must exceed this figure.


─────────────────────────────────────────────
## 4. Markup Options (based on projected total with contingency)
─────────────────────────────────────────────

| Markup % | Sell Price       | Gross Profit     | Margin  | $/sq ft  |
|----------|-----------------|-----------------|---------|----------|
{MARKUP_TABLE_ROWS}

Target range: 18–30% gross margin.
Highlight your preferred tier when quoting the client.


─────────────────────────────────────────────
## 5. Talking Points for Client
─────────────────────────────────────────────

Use these when presenting the project to the client. Do NOT reference internal costs.

{TALKING_POINTS}


─────────────────────────────────────────────
## 6. Watch Out
─────────────────────────────────────────────

{WATCH_OUTS}


─────────────────────────────────────────────
Prepared by AI Agent | {TIMESTAMP}
INTERNAL USE ONLY – Canada Steel Buildings, Vaughan, ON
─────────────────────────────────────────────
```

---

## Placeholder Reference

| Placeholder | Source |
|---|---|
| `{JOB_ID}` | Extracted from quote |
| `{CLIENT_NAME}` | Extracted from quote |
| `{REP_NAME}` | Provided by user; default to "Team" |
| `{CLIENT_ID}` | Extracted from quote; "N/A" if not present |
| `{WIDTH}` | Building width in feet |
| `{LENGTH}` | Building length in feet |
| `{EAVE_HEIGHT}` | Eave height in feet |
| `{AREA}` | Total sq ft (calculated if missing) |
| `{WEIGHT}` | Total steel weight in lbs |
| `{WEIGHT_PER_SQFT}` | Weight ÷ Area, rounded to 2 decimal places |
| `{QUOTE_VALIDITY}` | Expiration date from quote; "Not stated" if missing |
| `{LEAD_TIME}` | Delivery window from quote; "Not stated" if missing |
| `{ITEMIZED_COSTS}` | Bulleted list of every cost line item with amounts |
| `{COMBINED_TOTAL}` | Sum of all costs, formatted as $X,XXX.XX |
| `{COST_PER_SQFT}` | Combined Total ÷ Area, formatted as $XX.XX |
| `{CONTINGENCY_PCT}` | 10 (default) or user-specified value |
| `{CONTINGENCY_AMOUNT}` | Combined Total × Contingency Rate |
| `{TOTAL_WITH_CONTINGENCY}` | Combined Total + Contingency Amount |
| `{MARKUP_TABLE_ROWS}` | Six rows for 18%, 20%, 22%, 25%, 28%, 30% tiers |
| `{TALKING_POINTS}` | 3–5 client-facing value statements (no cost data) |
| `{WATCH_OUTS}` | Bulleted list of risks, pending items, missing data |
| `{TIMESTAMP}` | Current date and time in "Month D, YYYY at H:MM AM/PM TZ" format |

## Itemized Costs Format

Format `{ITEMIZED_COSTS}` as a bulleted list, aligned for readability:

```
  - Base steel cost:              $160,493.46
  - Engineering & design fee:      $5,000.00
  - Foundation drawing cost:       $3,200.00
  - Gutters & downspouts:          $6,447.65
  - Liner panels:                      $0.00  ← included, no separate charge
  - Insulation:                    PENDING – $0.00  ⚠ confirm with estimator
```

## Watch Out Format

Format `{WATCH_OUTS}` as a bulleted list:

```
  ⚠ Insulation is listed as PENDING ($0.00) – final cost unknown. Get confirmation before quoting the client.
  ⚠ Liner panels show $0.00 – confirm whether this is included in base steel or simply not required.
  ⚠ No quote expiry date provided – verify pricing validity with the factory before presenting to client.
  ⚠ No lead time stated – confirm production and delivery schedule before committing to a client timeline.
```
