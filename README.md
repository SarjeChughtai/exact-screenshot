# CSB Portal

## Environment

The repo now includes checked-in example env files:

- `.env.example` for frontend runtime variables
- `supabase/.env.example` for local Supabase Edge Function secrets

Frontend variables currently used:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_MAPS_KEY`

Edge Function secrets referenced in `supabase/functions/*`:

- `LOVABLE_API_KEY`
- `GDRIVE_SERVICE_ACCOUNT_JSON`
- `GDRIVE_FOLDER_ID`
- `GHL_API_KEY`
- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`

The local `.env` file may also contain `VITE_SUPABASE_PROJECT_ID`, but the app does not currently use it.
