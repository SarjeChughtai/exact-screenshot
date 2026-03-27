

## Plan: Pull Contacts & Opportunities from GoHighLevel CRM

### Overview
Create an edge function that pulls contacts and opportunities from GoHighLevel's v2 API using the private integration token, and a Settings UI to trigger syncs and view imported data. Also back up all current Supabase data to downloadable JSON.

### 1. Store the GHL API Token
- Add secret `GHL_API_KEY` with value `pit-01197edb-2669-4639-bbc8-651146fbb2d5` using the secrets tool

### 2. Create Edge Function: `ghl-sync`
**File**: `supabase/functions/ghl-sync/index.ts`

Operations:
- `pull-contacts`: GET from `https://services.leadconnectorhq.com/contacts/` with Bearer token + `Version: 2021-07-28` header. Returns paginated contacts (name, email, phone, company, tags).
- `pull-opportunities`: GET from `https://services.leadconnectorhq.com/opportunities/search` to pull pipeline deals.
- `get-location`: GET `/locations/search` to discover the GHL location ID (required for all other calls).

Auth: Validates JWT in code, checks admin/owner role. CORS headers included.

### 3. Database: `ghl_contacts` Table
Store pulled CRM data locally for reference/lookup:

```text
ghl_contacts (
  id uuid PK,
  ghl_id text UNIQUE NOT NULL,
  name text,
  email text,
  phone text,
  company text,
  tags text[],
  raw_data jsonb,
  synced_at timestamptz default now()
)
```

RLS: admin/owner can read, insert, update, delete.

### 4. Database: `ghl_opportunities` Table

```text
ghl_opportunities (
  id uuid PK,
  ghl_id text UNIQUE NOT NULL,
  name text,
  pipeline_name text,
  stage_name text,
  status text,
  monetary_value numeric default 0,
  contact_ghl_id text,
  raw_data jsonb,
  synced_at timestamptz default now()
)
```

Same RLS as contacts.

### 5. Settings UI: CRM Tab
Add a "CRM" tab in Settings (admin/owner only):
- "Pull Contacts from CRM" button — calls edge function, upserts into `ghl_contacts`
- "Pull Opportunities from CRM" button — same for opportunities
- Display last sync timestamp
- Table showing pulled contacts count and opportunities count

### 6. Data Backup
Back up all Supabase tables (deals, quotes, payments, internal_costs, production, freight, user_roles, ghl_contacts, ghl_opportunities) as timestamped JSON files to `/mnt/documents/backup/`.

### 7. Tracking Script (from previous plan)
Add the msgsndr.com tracking script to `index.html`.

---

### Technical Details

**Files to create**:
- `supabase/functions/ghl-sync/index.ts`

**Files to modify**:
- `index.html` — tracking script
- `src/pages/Settings.tsx` — add CRM tab with pull buttons and sync status

**Database migration**: Create `ghl_contacts` and `ghl_opportunities` tables with RLS

**Secret to add**: `GHL_API_KEY`

