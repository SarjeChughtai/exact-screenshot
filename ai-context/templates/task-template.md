# Task Template

Use this as a reference when adding tasks to `tasks.json`. Copy the JSON block below and fill it in. Add the object to the `tasks` array.

## JSON Structure

```json
{
  "id": "AREA-NNN",
  "title": "Short, action-oriented title",
  "status": "ready",
  "priority": "medium",
  "owner": "unassigned",
  "last_updated_by": "agent-name",
  "next_action": "The exact first step required to make progress on this task",
  "notes": "Optional context: why this task exists, constraints, or important background",
  "area": "feature",
  "files": [],
  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"
}
```

## Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique task identifier. Format: `AREA-NNN` (e.g., `AUTH-001`, `UI-042`, `SYS-003`). |
| `title` | Yes | Short, imperative phrase: "Implement X", "Fix Y", "Design Z" |
| `status` | Yes | `pending` / `ready` / `in_progress` / `blocked` / `review` / `done` / `archived` |
| `priority` | Yes | `low` / `medium` / `high` / `critical` |
| `owner` | Yes | Agent currently responsible. `unassigned` if no one has picked it up. |
| `last_updated_by` | Yes | Agent that last touched this task |
| `next_action` | Yes | Specific, actionable next step. Vague values like "continue work" are not acceptable. |
| `notes` | No | Background context, constraints, decisions, or blockers |
| `area` | Yes | Domain grouping: `setup`, `feature`, `api`, `ui`, `infra`, `bug`, `docs`, `research`, etc. |
| `files` | No | List of files most relevant to this task |
| `updated_at` | Yes | ISO 8601 timestamp of last modification |

## Status Transition Rules

```
pending → ready (dependencies met)
ready → in_progress (agent picks it up)
in_progress → review (agent finishes, human reviews)
in_progress → blocked (blocker encountered)
blocked → in_progress (blocker resolved)
review → done (approved)
review → in_progress (changes requested)
any → archived (task no longer relevant)
```

## ID Naming Conventions

Use consistent area prefixes across your project:

| Prefix | Area |
|---|---|
| `SYS` | System / infrastructure |
| `API` | API / backend |
| `UI` | Frontend / UI |
| `AUTH` | Authentication / authorization |
| `DB` | Database / data model |
| `CI` | CI/CD / DevOps |
| `DOCS` | Documentation |
| `BUG` | Bug fixes |
| `RES` | Research / spike |
