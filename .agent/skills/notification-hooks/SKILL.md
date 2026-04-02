---
name: notification-hooks
description: Send webhook notifications when task statuses change, handoffs are created, or important events occur in the agent workflow. Use when setting up notifications, configuring webhooks, or when the user wants alerts for agent activity.
---

## Goal

Deliver real-time notifications to external systems (Slack, email, custom endpoints) when meaningful events occur in the agent workflow. Notifications are fire-and-forget — they must never block agent work or cause task failures.

## Instructions

### 1. Webhook Configuration

Webhooks are configured in `ai-context/webhooks.json`. This file must be created by the user — it is never auto-generated or auto-populated.

**Config file:** `ai-context/webhooks.json`

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
      "url": "https://YOUR_SUPABASE_URL/functions/v1/send-notification",
      "events": ["task.blocked", "conflict.detected"],
      "enabled": true,
      "format": "json"
    }
  ],
  "last_updated": "ISO-8601 timestamp"
}
```

**Field definitions:**

| Field | Description |
|---|---|
| `id` | Unique identifier for this hook (lowercase, hyphenated). Used for targeting in test commands. |
| `url` | The full webhook URL to POST to. Must be set by the user. |
| `events` | Array of event types that trigger this hook (see Section 2). |
| `enabled` | `true` to fire this hook, `false` to pause without deleting. |
| `format` | `"slack"` for Slack Block Kit format; `"json"` for raw JSON payload. |

### 2. Supported Events

The following event types can be used in the `events` array:

| Event | Trigger Condition |
|---|---|
| `task.created` | New task added to `tasks.json` |
| `task.status_changed` | Any task status transition |
| `task.done` | Task status set to `done` |
| `task.blocked` | Task status set to `blocked` |
| `handoff.created` | New handoff block written to `active.md` |
| `session.started` | Agent session begins (after session declaration) |
| `session.ended` | Agent session ends or wraps up |
| `conflict.detected` | Conflict resolver identified a state conflict |
| `decision.recorded` | New decision written to `ai-context/decisions/` |
| `rollback.performed` | Context was rolled back to a previous state |

**Practical note:** Start with `task.done`, `task.blocked`, and `handoff.created`. These cover the most actionable events without generating noise.

### 3. Payload Format

For hooks with `"format": "json"`, the following payload is sent:

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
    "summary": "Completed deal lifecycle definition with all state transitions documented"
  },
  "project": "steelportal",
  "repo": "SarjeChughtai/Steelportal"
}
```

**Required fields in `data`:**
- `task_id` — the task ID being referenced
- `title` — human-readable task title
- `new_status` — the status after the event (for status-change events)

**Optional fields in `data`:**
- `old_status` — previous status (for transitions)
- `summary` — brief description of what happened
- Any additional fields relevant to the specific event type

**Never include in payloads:**
- API keys, tokens, credentials, or secrets
- Internal cost estimates or billing data
- Full file contents or large data blobs
- Personal identifiable information beyond agent names

### 4. Slack Format

For hooks with `"format": "slack"`, transform the standard payload into Slack Block Kit before posting.

**Event-to-emoji mapping:**

| Event | Header Emoji | Header Text |
|---|---|---|
| `task.done` | ✅ | Task Completed |
| `task.blocked` | 🚫 | Task Blocked |
| `task.created` | 📋 | New Task Created |
| `task.status_changed` | 🔄 | Task Updated |
| `handoff.created` | 🤝 | Handoff Created |
| `session.started` | 🚀 | Session Started |
| `session.ended` | 🏁 | Session Ended |
| `conflict.detected` | ⚠️ | Conflict Detected |
| `decision.recorded` | 📝 | Decision Recorded |
| `rollback.performed` | ⏪ | Rollback Performed |

**Slack Block Kit structure:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "✅ Task Completed"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Task:* CRM-001"},
        {"type": "mrkdwn", "text": "*Agent:* Codex"},
        {"type": "mrkdwn", "text": "*Title:* Define deal state model"},
        {"type": "mrkdwn", "text": "*Status:* done"}
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "Project: steelportal | 2026-04-02T16:45:00Z"
        }
      ]
    }
  ]
}
```

Include only the fields that have values. Do not include empty `fields` entries. For `handoff.created`, include `from_agent` and `to_agent` instead of `task_id`.

### 5. Integration with Context Scripts

The notification system integrates with `update-context.mjs` at the point where task or session state changes are committed.

**Integration pattern:**

After any task update is written to `tasks.json`:

1. Read `ai-context/webhooks.json`. If the file does not exist, skip silently.
2. Filter hooks by:
   - `enabled: true`
   - The event type is in the hook's `events` array
3. For each matching hook:
   - Build the payload (Section 3) or Slack format (Section 4)
   - POST asynchronously (do not `await` in the main flow — use fire-and-forget)
   - Log the result: `[notify] fired slack-updates for task.done (200 OK)` or `[notify] FAILED slack-updates (timeout)`
4. Continue with the main operation regardless of webhook results

**Fire-and-forget pattern in Node.js:**

```javascript
// Fire webhook without blocking
fireWebhook(hook, payload).catch((err) => {
  console.warn(`[notify] FAILED ${hook.id}: ${err.message}`);
});
```

**Never:**
- `await` a webhook call in a synchronous context flow
- Retry failed webhooks
- Throw an error or exit non-zero because of a webhook failure
- Block task writes pending webhook delivery confirmation

### 6. Setup Instructions

**Step 1 — Create `ai-context/webhooks.json`**

Copy the template from Section 1 and replace the placeholder URLs.

**Step 2 — Slack setup**

1. Go to your Slack workspace → Apps → Incoming Webhooks
2. Click "Add New Webhook to Workspace"
3. Select the target channel
4. Copy the webhook URL (format: `https://hooks.slack.com/services/T.../B.../...`)
5. Paste it into `webhooks.json` in the hook with `"format": "slack"`

**Step 3 — Supabase email setup (optional)**

1. Deploy the `send-notification` edge function (see `supabase/functions/send-notification/index.ts`)
2. Set your Supabase project URL in `webhooks.json`
3. The endpoint format is: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification`
4. Include the `Authorization: Bearer YOUR_ANON_KEY` header in the hook config if your function requires it

**Step 4 — Test your hooks**

```bash
# Test a specific hook
node scripts/notify.mjs test --hook-id slack-updates

# Fire a real event manually
node scripts/notify.mjs --event task.done --agent codex --data '{"task_id":"CRM-001","title":"Define deal state model","old_status":"in_progress","new_status":"done"}'
```

**Step 5 — Integrate with update-context.mjs**

Add a notify call after task status updates in `scripts/update-context.mjs`:

```javascript
import { fireEvent } from "./notify.mjs";

// After writing tasks.json:
fireEvent("task.done", agentName, { task_id: id, title, old_status, new_status });
```

### 7. Supabase Notification Function (Optional)

An optional Supabase edge function at `supabase/functions/send-notification/index.ts` can:
- Receive webhook payloads
- Store them in a `notifications` table for audit/history
- Send email notifications via configured SMTP or Supabase email
- Return `200 OK` immediately regardless of email delivery status

See `supabase/functions/send-notification/index.ts` for the full implementation.

The required `notifications` table schema is included as a comment at the top of that file.

## Examples

**Example 1 — Task blocked, Slack notification**

Agent marks CRM-012 as blocked. The notify integration fires `task.blocked`. The Slack hook matches and posts:

```
🚫 Task Blocked

Task:   CRM-012
Agent:  Claude
Title:  Implement contact deduplication
Status: blocked

Project: steelportal | 2026-04-02T23:00:00Z
```

**Example 2 — Handoff notification**

Agent writes a handoff in `active.md`. The integration fires `handoff.created`. The Slack hook posts:

```
🤝 Handoff Created

From:  Claude
To:    Codex
Task:  AUTH-007 — Implement JWT refresh rotation

Project: antigravity-agent-os | 2026-04-02T16:45:00Z
```

**Example 3 — Disabling a hook temporarily**

To pause a hook without deleting it, set `"enabled": false`:

```json
{
  "id": "slack-updates",
  "enabled": false,
  ...
}
```

## Constraints

- **Webhooks are fire-and-forget.** No retries. Failures are logged but do not block agent work.
- **Never include sensitive data** (credentials, internal costs, PII) in webhook payloads.
- **All webhook URLs must be configured by the user.** This system never auto-discovers or infers webhook endpoints.
- **Webhook failures must not block agent work.** A failed POST to Slack must not prevent a task from being marked done.
- **`webhooks.json` absence is silently skipped.** If the file does not exist, the notification system does nothing.
- **`enabled: false` hooks are never fired.** Check the `enabled` flag before firing any hook.
- **Event filtering is the hook's responsibility.** Only fire a hook if the event type is in its `events` array.
