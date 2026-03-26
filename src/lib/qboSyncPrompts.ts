export type QboMappingResult = {
  jobId: string | null;
  direction: 'Client Payment IN' | 'Vendor Payment OUT' | 'Refund IN' | 'Refund OUT';
  type: 'Deposit' | 'Progress Payment' | 'Final Payment' | 'Freight' | 'Insulation' | 'Drawings' | 'Other';
  referenceNumber: string;
  amountExclTax: number | null;
  province: string | null;
  notes: string;
};

// Lovable/Perplexity prompt: map a QuickBooks transaction to a PaymentEntry-like structure.
export const qbTransactionMappingPrompt = `
You are helping map QuickBooks transaction data into Canada Steel Buildings payment records.

INPUT
- Transaction fields: date, description, memo, payee/payer name, document number/reference, amount (and any tax fields if provided).
- Additional context available to the model: a list of known job IDs, client names, and client/vendor names.

TASK
1) Identify the best matching jobId using job id strings, client/vendor name similarity, and common description patterns.
2) Determine direction:
   - Client Payment IN
   - Vendor Payment OUT
   - Refund IN
   - Refund OUT
3) Determine payment type:
   - Deposit / Progress Payment / Final Payment when the description indicates stage (15%/50%/35% or 30%/70% markers)
   - Freight / Insulation / Drawings when the description indicates those categories
   - Otherwise Other.
4) Extract referenceNumber (cheque number / invoice / doc number) if present; otherwise use the closest available reference in the input.
5) Extract amountExclTax if amount + tax are provided; otherwise set amountExclTax to null.
6) Estimate province when it is inferable from job context; otherwise set province to null.
7) Provide notes describing your reasoning briefly.

OUTPUT (STRICT JSON)
Return a single JSON object matching this schema:
{
  "jobId": string | null,
  "direction": "Client Payment IN" | "Vendor Payment OUT" | "Refund IN" | "Refund OUT",
  "type": "Deposit" | "Progress Payment" | "Final Payment" | "Freight" | "Insulation" | "Drawings" | "Other",
  "referenceNumber": string,
  "amountExclTax": number | null,
  "province": string | null,
  "notes": string
}

Rules
- If jobId is uncertain, set jobId to null and explain in notes.
- Do not output non-JSON text.
`.trim();

// Lovable/Perplexity prompt: decide whether a transaction already exists in our ledger.
export const qbDedupePrompt = `
You are helping deduplicate QuickBooks transactions into a payment ledger.

INPUT
- One candidate transaction (same fields as mapping task).
- A list of existing ledger entries (each has: jobId, date, direction, type, amountExclTax, referenceNumber).

TASK
Find if the candidate likely already exists.

DEDUPLICATION STRATEGY
Use a composite key with fuzzy matching:
- jobId match (or strong client/vendor name match when jobId is null in candidate)
- date match (exact date; allow +/- 1 day if reference matches)
- direction match
- type match
- amountExclTax match within a small tolerance (e.g. +/- 1%)
- referenceNumber match (strong signal); if reference is blank, use description similarity.

OUTPUT (STRICT JSON)
Return:
{
  "isDuplicate": boolean,
  "matchedEntryId": string | null,
  "confidence": number (0 to 1),
  "reason": string
}

Rules
- Do not output non-JSON text.
`.trim();

