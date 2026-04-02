# Create New Task

**Trigger:** `/create-task`  
**Description:** Add a new task to the shared task system. Use this any time new work is identified — do not add tasks to tasks.json manually outside of this workflow.

---

## Steps

### 1. Gather task details
Collect the following before writing anything:

| Field | Description | Example |
|---|---|---|
| **Title** | Short, action-oriented name | "Add OAuth2 login flow" |
| **Area** | Domain prefix for the ID | `AUTH`, `CRM`, `UI`, `API`, `INFRA`, `DB`, `OPS` |
| **Priority** | Urgency level | `critical`, `high`, `medium`, `low` |
| **Description** | What needs to be done and why | 1–3 sentences |
| **Next action** | The very first step to start this task | 1 sentence |

If any field is ambiguous, infer a reasonable default and note your assumption in the `notes` field.

### 2. Generate the task ID
Open `ai-context/tasks.json`.  
Find all existing tasks where `area` matches the new task's area.  
The new ID is: `AREA-NNN` where NNN is the next available zero-padded integer.

Examples:
- If `CRM-001` and `CRM-002` exist → new ID is `CRM-003`
- If no `AUTH` tasks exist yet → new ID is `AUTH-001`

Do not reuse IDs from deleted or archived tasks.

### 3. Build the task object
Create the following JSON object:

```json
{
  "id": "AREA-NNN",
  "title": "Task title here",
  "area": "AREA",
  "status": "pending",
  "priority": "high",
  "owner": "unassigned",
  "last_updated_by": "[your agent name]",
  "next_action": "Exact first step to begin this task.",
  "notes": "Created by [your agent name]. [Any relevant context, assumptions, or constraints.]",
  "files": [],
  "updated_at": "[current ISO 8601 timestamp]"
}
```

- `status` always starts as `"pending"` unless you are immediately beginning work (then use `"in_progress"`)
- `owner` is `"unassigned"` unless you are taking it on yourself right now
- `files` starts as an empty array

### 4. Add to tasks.json
Insert the new task object into the `tasks` array in `ai-context/tasks.json`.  
Maintain consistent JSON formatting. Do not remove or reorder existing tasks.

### 5. Update meta.last_updated
Set `meta.last_updated` at the top of tasks.json to the current ISO 8601 timestamp.

### 6. Append a log entry
Open `ai-context/logs/YYYY-MM-DD.md` and append:

```markdown
## [HH:MM UTC] — [Your Agent Name]

**Action:** Created task [TASK-ID] — "[Task title]"

**Priority:** [priority]  
**Reason:** [one sentence explaining why this task was created now]
```

### 7. Update dashboard.md if this is now the highest priority
Open `ai-context/dashboard.md`.  
If the new task has `critical` or `high` priority and no other critical/high task is currently `in_progress`, update:
- **Next Action** to reflect the new task
- **Current Blockers** if relevant

Do not change **Current Task ID** unless you are immediately taking on the new task yourself (in which case also run `/update-task`).

---

**Output:** Confirm the new task ID and title, and state whether it is the current highest-priority pending item.
