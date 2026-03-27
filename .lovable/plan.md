

## Plan: QuickBooks Online API Integration

### Overview
Build a proper QuickBooks Online integration using their OAuth 2.0 API to pull payment/transaction data into the Payment Ledger, replacing the placeholder `VITE_LOVABLE_QBO_SYNC_URL` approach.

### How QuickBooks API Works

QuickBooks Online uses **OAuth 2.0** for authentication. The flow is:

1. You register an app at [developer.intuit.com](https://developer.intuit.com)
2. Users authorize via OAuth, granting your app access to their QBO company
3. You receive an access token (1 hour) and refresh token (100 days)
4. You call the QBO REST API to query transactions

### What Needs to Happen

#### Step 1: Register a QuickBooks App
- Go to [developer.intuit.com/app/developer/dashboard](https://developer.intuit.com/app/developer/dashboard)
- Create an app with **Accounting** scope
- Note your **Client ID** and **Client Secret**
- Set the redirect URI to your Supabase edge function callback URL:
  `https://jvdvxmziggodjvchyvcy.supabase.co/functions/v1/qbo-callback`

#### Step 2: Store Secrets
Add two new secrets to the project:
- `QBO_CLIENT_ID` — from Intuit developer dashboard
- `QBO_CLIENT_SECRET` — from Intuit developer dashboard

#### Step 3: Create Database Table for QBO Tokens
A `qbo_tokens` table to persist OAuth tokens (encrypted at rest in Supabase):
- `id`, `realm_id` (QBO company ID), `access_token`, `refresh_token`, `expires_at`, `created_at`
- RLS: owner/admin only

#### Step 4: Create Edge Functions

**`qbo-auth`** — Initiates OAuth flow
- Generates the Intuit authorization URL with proper scopes (`com.intuit.quickbooks.accounting`)
- Returns the URL for the frontend to redirect the user

**`qbo-callback`** — Handles OAuth redirect
- Exchanges the authorization code for access/refresh tokens
- Stores tokens in `qbo_tokens` table
- Redirects user back to Settings page

**`qbo-sync`** — Pulls transactions
- Reads stored tokens, refreshes if expired
- Queries QBO API endpoints:
  - `GET /v3/company/{realmId}/query?query=SELECT * FROM Payment` (client payments)
  - `GET /v3/company/{realmId}/query?query=SELECT * FROM BillPayment` (vendor payments)
  - `GET /v3/company/{realmId}/query?query=SELECT * FROM Invoice` (for reference matching)
- Maps QBO transactions to `PaymentEntry` format using the existing mapping prompt logic
- Deduplicates against existing payments
- Inserts new entries into `payments` table

#### Step 5: Settings UI — QBO Tab
- "Connect QuickBooks" button that initiates OAuth
- Connection status indicator (connected/disconnected, company name)
- "Pull Transactions" button to trigger sync
- Date range filter for selective pulls
- Sync log showing last sync time and results

#### Step 6: Update Payment Ledger
- Replace the `VITE_LOVABLE_QBO_SYNC_URL` fetch with a call to `supabase.functions.invoke('qbo-sync')`
- Remove the env var dependency

### Technical Details

**Files to create**:
- `supabase/functions/qbo-auth/index.ts` — OAuth initiation
- `supabase/functions/qbo-callback/index.ts` — OAuth callback handler
- `supabase/functions/qbo-sync/index.ts` — Transaction pull logic
- `src/components/QBOSettings.tsx` — QuickBooks settings panel

**Files to modify**:
- `src/pages/Settings.tsx` — add QBO settings tab
- `src/pages/PaymentLedger.tsx` — update sync button to use edge function

**Database migration**: `qbo_tokens` table with RLS (owner/admin only)

**Secrets to add**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`

**QBO API base URL**: `https://quickbooks.api.intuit.com` (production) or `https://sandbox-quickbooks.api.intuit.com` (sandbox)

### Data Flow

```text
User clicks "Connect QuickBooks"
  → qbo-auth returns Intuit OAuth URL
  → User authorizes in Intuit
  → Intuit redirects to qbo-callback
  → Tokens stored in qbo_tokens

User clicks "Sync" in Payment Ledger
  → qbo-sync reads tokens, refreshes if needed
  → Queries QBO Payment + BillPayment endpoints
  → Maps to PaymentEntry format
  → Dedupes against existing payments
  → Inserts new records into payments table
```

