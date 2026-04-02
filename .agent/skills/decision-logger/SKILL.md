---
name: decision-logger
description: |
  Records architecture, naming, environment, and policy decisions as durable markdown files. Activate when making any decision that affects future work, when choosing between implementation approaches, when establishing a naming convention, when setting environment strategy, or when overriding a prior decision. Trigger phrases: "log this decision", "record that we decided", "document this choice", "decision record", "why did we choose", "ADR", "architecture decision", "let's log this", "note this for later", "record our approach", "we've decided to", "document the reasoning".
---

## Goal

Create a durable, searchable record of every significant decision made during development so that any agent or human can understand why things are built the way they are — weeks or months later, without needing to ask.

## Instructions

### Step 1 — Determine If a Decision Record Is Needed

Create a decision record when ANY of the following are true:
- A technology, library, or service was chosen (or rejected) for a specific use case
- A naming convention, file structure, or API shape was established
- An environment strategy was set (e.g., which secrets go in which .env file)
- A security or policy constraint was established (e.g., "all API routes require auth")
- A previous decision is being revised or deprecated
- An approach was tried and rejected — document what was tried and why it failed
- The same question has been asked more than once (answers to repeated questions should become decisions)

Do NOT create a decision record for:
- Trivial implementation details that follow obvious patterns
- Decisions that are already fully expressed in a referenced RFC or spec document
- Temporary workarounds (create a task instead, and note the workaround there)

### Step 2 — Determine the File Name

Use a descriptive kebab-case filename with `.md` extension. The name should make the decision's subject immediately clear without reading the file.

**Good names:**
- `auth-redirect-strategy.md` — where users are sent after login/logout
- `jwt-refresh-rotation.md` — how refresh tokens are rotated
- `contact-dedup-algorithm.md` — the algorithm chosen for deduplication
- `supabase-rls-policy-pattern.md` — the pattern for Row Level Security policies
- `api-error-response-shape.md` — the standard shape of API error responses
- `env-secret-management.md` — which secrets go where and how they're accessed

**Avoid:**
- `decision1.md` (meaningless)
- `auth.md` (too broad)
- `2026-04-02.md` (date-only names obscure subject)

Check `ai-context/decisions/` for existing files with similar names. If a closely related record exists, consider updating it (and changing its status to `Revised`) rather than creating a duplicate.

### Step 3 — Write the Decision Record

Create the file at `ai-context/decisions/[filename].md` using this exact template:

```markdown
# [Decision Title — Clear, Noun Phrase]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Revised
**Decided by:** [agent name or "human"]

## Context

[2–4 sentences describing the situation that forced this decision. What problem needed solving? What constraints existed? What were the stakes?]

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| [Option A — the chosen approach] | [why it's good] | [its drawbacks] |
| [Option B] | [why it was considered] | [why it was rejected] |
| [Option C, if applicable] | ... | ... |

## Decision

[1–3 sentences stating exactly what was decided. Be specific. "We will use X" not "we might consider X".]

## Consequences

**Positive:**
- [Expected benefit 1]
- [Expected benefit 2]

**Negative / Trade-offs:**
- [Known downside or limitation]
- [Future constraint this creates]

**Follow-up tasks:**
- [Task ID or description of work this decision requires]

## Related Files
- [path/to/file.ts — how it implements this decision]
- [path/to/other-decision.md — related decision]

## Notes
[Any additional context: links to docs, RFCs, issue numbers, or a description of what went wrong with the rejected approaches.]
```

All sections are required. Use "N/A" only if a section genuinely has no content (rare).

**Status values:**
- `Proposed` — decision is being discussed, not yet final
- `Accepted` — decision is active and in effect
- `Deprecated` — decision was accepted but has been superseded or retired
- `Revised` — this record updates a prior decision (link to the prior record in Notes)

### Step 4 — Cross-Reference in tasks.json

1. Open `ai-context/tasks.json`.
2. Find the task most directly related to this decision.
3. Append to its `notes` field: `"Decision recorded: decisions/[filename].md"`
4. Update `last_updated_by` and `updated_at`.

### Step 5 — Append to Today's Log

Add a log entry to `ai-context/logs/YYYY-MM-DD.md`:

```markdown
## [HH:MM:SS] Decision Logged: [filename.md]
Decision: [One sentence summary of what was decided]
Status: Accepted
Task: [AREA-NNN or "general"]
```

### Step 6 — Update dashboard.md (For Significant Decisions)

If the decision affects the project's architecture in a foundational way (e.g., choosing a database, selecting an auth provider, establishing a core data model), add a line to the "Key Decisions" section of `ai-context/dashboard.md`:

```
- [YYYY-MM-DD] [Short decision summary] → decisions/[filename].md
```

## Examples

**Example 1 — Choosing between WebSocket and SSE for real-time updates**

File: `ai-context/decisions/realtime-transport-protocol.md`

```markdown
# Real-Time Transport Protocol Selection

**Date:** 2026-04-02
**Status:** Accepted
**Decided by:** Claude

## Context

The CRM dashboard requires real-time presence indicators and live activity feeds. We needed to choose between WebSocket, Server-Sent Events (SSE), and a managed service (Liveblocks/Ably) for the transport layer.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| SSE (chosen) | Native browser support, simple server implementation, works with HTTP/2 multiplexing, no library needed | One-directional only, not suitable if clients need to push data |
| WebSocket | Bi-directional, well-supported | More complex server setup, stateful connections complicate serverless deployment |
| Liveblocks | Managed, feature-rich | Adds vendor dependency, cost at scale |

## Decision

We will use Server-Sent Events (SSE) for all real-time push notifications from server to client. Client-to-server updates will continue to use standard REST/tRPC mutations.

## Consequences

**Positive:**
- Zero additional dependencies
- Compatible with Next.js Edge Runtime
- Trivially deployable on Vercel

**Negative / Trade-offs:**
- Cannot push data from client to server over the same connection — acceptable given our use case
- Reconnection logic must be implemented client-side

**Follow-up tasks:**
- INFRA-015: Implement SSE endpoint at `/api/events/stream`
- UI-009: Add SSE client hook in `lib/realtime/useEventStream.ts`

## Related Files
- app/api/events/stream/route.ts — SSE endpoint implementation
- lib/realtime/useEventStream.ts — client hook

## Notes
Gemini research (session 2026-04-02) confirmed SSE is the current community recommendation for Next.js/Vercel stacks with unidirectional real-time needs.
```

**Example 2 — Deprecating a decision**

File: `ai-context/decisions/api-auth-strategy.md` (existing, status: Accepted)

Update status to `Deprecated`, add to Notes: "Superseded by decisions/api-auth-strategy-v2.md (2026-04-10) — migrated from session tokens to JWT."

Create `ai-context/decisions/api-auth-strategy-v2.md` with `Status: Revised`, and reference the original in Notes.

## Constraints

- Never create a decision record for a decision that hasn't actually been made. Use `Proposed` status for in-progress discussions, but only create the file when there's a clear stance.
- Do not duplicate decisions. If a decision record already covers the topic, update its status and append a revision note rather than creating a new file.
- Decision records are append-only in spirit — do not rewrite history. Deprecated decisions must retain their original content with a deprecation notice added at the top.
- File names must be unique within `ai-context/decisions/`. Check before creating.
- All decisions that affect future implementation choices must be cross-referenced in the relevant task's `notes` field.
