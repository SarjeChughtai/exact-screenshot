# Webhook Setup Guide

This guide covers configuring Slack webhooks, Supabase email notifications, and custom webhook endpoints for the Antigravity Agent OS notification system.

---

## Overview

The notification system fires HTTP POST requests when agent events occur. All webhook configuration lives in `ai-context/webhooks.json`. Notifications are fire-and-forget — failures are logged but never block agent work.

**Supported destinations:**
- Slack (via Incoming Webhooks with Block Kit formatting)
- Supabase email (via the `send-notification` edge function)
- Custom endpoints (any URL that accepts JSON POST)

---

## Step 1 — Create webhooks.json

Create `ai-context/webhooks.json` with your hook configurations:

```json
{
  "hooks": [
    {
      "id": "slack-updates",
      "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "events": ["task.done", "task.blocked", "handoff.created"],
      "enabled": true,
      "format": "slack"
    },
    {
      "id": "email-critical",
      "url": "https://YOUR_PROJECT.supabase.co/functions/v1/send-notification",
      "events": ["task.blocked", "conflict.detected"],
      "enabled": true,
      "format": "json"
    }
  ],
  "last_updated": "2026-04-02T00:00:00Z"
}
```

Start with one hook and verify it works before adding more.

---

## Step 2A — Slack Setup

### Create a Slack Incoming Webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and sign in to your Slack workspace
2. Click **Create New App** → **From scratch**
3. Name it something like `Antigravity Agent OS`
4. Select your workspace and click **Create App**
5. In the left sidebar, click **Incoming Webhooks**
6. Toggle **Activate Incoming Webhooks** to **On**
7. Click **Add New Webhook to Workspace**
8. Select the target channel (e.g., `#agent-updates` or `#dev-notifications`)
9. Click **Allow**
10. Copy the webhook URL — it looks like: `https://hooks.slack.com/services/T.../B.../...`

### Add to webhooks.json

```json
{
  "id": "slack-updates",
  "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
  "events": ["task.done", "task.blocked", "handoff.created", "session.started"],
  "enabled": true,
  "format": "slack"
}
```

### Test the Slack hook

```bash
node scripts/notify.mjs test --hook-id slack-updates
```

Expected output in Slack:
```
✅ Task Completed
Task: TEST-001 | Agent: System
Title: Test notification from Antigravity Agent OS
```

### Recommended Slack event configuration

For a low-noise setup, start with:
```json
"events": ["task.done", "task.blocked", "handoff.created"]
```

For full visibility during active development:
```json
"events": ["task.done", "task.blocked", "task.status_changed", "handoff.created", "session.started", "session.ended", "conflict.detected"]
```

---

## Step 2B — Supabase Email Setup

The `send-notification` edge function stores all notifications in a database table and optionally sends email for high-priority events (`task.blocked`, `conflict.detected`, `rollback.performed`).

### Step 1 — Create the Database Table

Run this SQL in your Supabase project → SQL Editor:

```sql
-- Notification delivery log
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  event       text not null,
  agent       text not null,
  task_id     text,
  title       text,
  old_status  text,
  new_status  text,
  summary     text,
  project     text,
  repo        text,
  raw_payload jsonb not null,
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists notifications_event_idx
  on public.notifications (event, created_at desc);

create index if not exists notifications_task_idx
  on public.notifications (task_id, created_at desc);

-- Enable RLS
alter table public.notifications enable row level security;

-- Allow service role full access (used by the edge function)
create policy "service_role_all" on public.notifications
  for all to service_role using (true) with check (true);
```

### Step 2 — Deploy the Edge Function

```bash
# From your project root
supabase functions deploy send-notification
```

If you haven't linked your project yet:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-notification
```

### Step 3 — Configure Environment Variables (Optional Email)

If you want email delivery for critical events, set these in **Supabase Dashboard → Project Settings → Edge Functions → Environment Variables**:

| Variable | Value | Required for email |
|---|---|---|
| `NOTIFICATION_EMAIL_TO` | `yourname@example.com` | Yes |
| `SMTP_HOST` | `smtp.gmail.com` | Yes |
| `SMTP_PORT` | `587` | Yes |
| `SMTP_USER` | `yourapp@gmail.com` | Yes |
| `SMTP_PASS` | App-specific password | Yes |
| `SMTP_FROM` | `yourapp@gmail.com` | No (defaults to SMTP_USER) |

**Gmail setup note:** Use an [App Password](https://support.google.com/accounts/answer/185833), not your Google account password. Enable 2-factor authentication first, then generate an app password.

### Step 4 — Add to webhooks.json

```json
{
  "id": "email-critical",
  "url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification",
  "events": ["task.blocked", "conflict.detected", "rollback.performed"],
  "enabled": true,
  "format": "json"
}
```

Replace `YOUR_PROJECT_REF` with your Supabase project reference (visible in the Supabase dashboard URL or project settings).

### Step 5 — Test

```bash
node scripts/notify.mjs test --hook-id email-critical
```

Then check:
- **Supabase Table Editor → notifications** — confirm the row was inserted
- **Your email inbox** — if SMTP is configured, you should receive an email within a minute

---

## Step 2C — Custom Endpoint Setup

Any URL that accepts `POST` with a JSON body and returns a 2xx status code works as a custom webhook endpoint.

```json
{
  "id": "my-custom-hook",
  "url": "https://your-domain.com/api/agent-events",
  "events": ["task.done", "handoff.created"],
  "enabled": true,
  "format": "json"
}
```

**Payload your endpoint receives:**

```json
{
  "event": "task.done",
  "timestamp": "2026-04-02T16:45:00Z",
  "agent": "codex",
  "data": {
    "task_id": "CRM-001",
    "title": "Define deal state model",
    "old_status": "in_progress",
    "new_status": "done",
    "summary": "Completed with all state transitions documented"
  },
  "project": "steelportal",
  "repo": "SarjeChughtai/Steelportal"
}
```

**Minimum viable endpoint (Node.js/Express):**

```javascript
app.post("/api/agent-events", (req, res) => {
  const { event, agent, data, timestamp } = req.body;
  console.log(`[agent-event] ${event} from ${agent} at ${timestamp}`);
  // your logic here
  res.json({ received: true });
});
```

**Minimum viable endpoint (Python/FastAPI):**

```python
@app.post("/api/agent-events")
async def agent_events(payload: dict):
    print(f"[agent-event] {payload['event']} from {payload['agent']}")
    # your logic here
    return {"received": True}
```

---

## Integrating Notifications with update-context.mjs

To fire notifications automatically when tasks are updated, import `fireEvent` from `notify.mjs` in `scripts/update-context.mjs`:

```javascript
// At the top of update-context.mjs, add:
import { fireEvent } from "./notify.mjs";

// In cmdTask(), after writing tasks.json, add:
fireEvent(
  newStatus === "done" ? "task.done" :
  newStatus === "blocked" ? "task.blocked" : "task.status_changed",
  agent,
  { task_id: id, title: task.title, old_status: oldStatus, new_status: newStatus },
  "your-project-name",      // from ai-context/project.md
  "SarjeChughtai/your-repo" // from package.json or config
);

// In cmdHandoff(), after writing handoff, add:
fireEvent(
  "handoff.created",
  fromAgent,
  { from_agent: fromAgent, to_agent: toAgent, task_id: taskId, title: details },
  "your-project-name",
  "SarjeChughtai/your-repo"
);
```

`fireEvent` is fire-and-forget — it does not block the main flow, and webhook errors do not propagate.

---

## Managing Hooks

### Disable a hook temporarily

Set `"enabled": false` in `webhooks.json`. The hook remains configured but will not fire.

```json
{ "id": "slack-updates", "enabled": false, ... }
```

### Test a specific hook

```bash
node scripts/notify.mjs test --hook-id slack-updates
node scripts/notify.mjs test --hook-id email-critical
```

### List all configured hooks

```bash
node scripts/notify.mjs list
```

### Fire a manual event

```bash
# Fire a task.done event manually
node scripts/notify.mjs \
  --event task.done \
  --agent codex \
  --data '{"task_id":"CRM-001","title":"Define deal state model","old_status":"in_progress","new_status":"done","summary":"Completed"}'
```

### Fire a handoff notification

```bash
node scripts/notify.mjs \
  --event handoff.created \
  --agent claude \
  --data '{"from_agent":"claude","to_agent":"codex","task_id":"AUTH-007","title":"JWT refresh rotation"}'
```

---

## Supported Events Reference

| Event | Description | Recommended for |
|---|---|---|
| `task.created` | New task added | Full audit logs |
| `task.status_changed` | Any status transition | Dashboards, audit |
| `task.done` | Task completed | Slack, summaries |
| `task.blocked` | Task blocked | Slack + email alerts |
| `handoff.created` | Agent handoff written | Slack, team awareness |
| `session.started` | Agent session begins | Activity tracking |
| `session.ended` | Agent session ends | Activity tracking |
| `conflict.detected` | Conflict resolver triggered | Email alerts |
| `decision.recorded` | Architecture decision written | Audit trail |
| `rollback.performed` | Context rolled back | Email alerts |

---

## Troubleshooting

### Slack shows "invalid_payload"

The Slack webhook URL is malformed or the Block Kit JSON is invalid.

**Fix:** Re-copy the webhook URL from Slack — ensure no trailing spaces. Run the test command and check console output for the payload sent.

### Hook fires but nothing appears in Slack

The webhook URL may point to the wrong workspace or channel, or the app was removed.

**Fix:** Verify the webhook URL in the Slack dashboard (api.slack.com/apps → your app → Incoming Webhooks). Regenerate if needed.

### Supabase function returns 401

The function requires authentication but the webhook URL doesn't include the `Authorization` header.

**Fix:** For the Supabase send-notification function, ensure the function uses `--no-verify-jwt` flag or the webhook URL includes the anon key. The current implementation uses the service role key internally — the endpoint itself should be publicly callable if your Deno.serve does not check for authorization headers.

### "webhooks.json not found" warning

The file doesn't exist yet, which is the default state. This is not an error.

**Fix:** Create `ai-context/webhooks.json` following the template in Step 1. Until it exists, the notification system is silently inactive.

### Email not sending (no SMTP error)

SMTP environment variables are not set, so email is skipped silently.

**Fix:** Check the environment variable configuration in Supabase Dashboard → Project Settings → Edge Functions. All five SMTP variables must be set for email delivery.

### Notifications table not found

The database table hasn't been created yet.

**Fix:** Run the SQL schema from Step 2B — Step 1 in the Supabase SQL Editor.

---

## Security Notes

- **Never commit `webhooks.json`** to a public repository — it contains live webhook URLs that can be used to post to your Slack or trigger notifications. Add it to `.gitignore`:
  ```
  ai-context/webhooks.json
  ```
- **Webhook URLs are secret.** Anyone with the URL can post to your Slack channel or trigger your endpoint. Treat them like API keys.
- **The notify.mjs script never auto-discovers URLs.** All endpoints must be explicitly configured by a human in `webhooks.json`.
- **Payloads never contain credentials, tokens, or secrets.** If you add custom data fields, verify they don't include sensitive information before firing events.
- **The Supabase function uses the service role key internally** — this key is never exposed in webhook payloads or HTTP responses.
