# Update Task

**Trigger:** `/update-task`  
**Description:** Update a task's status and metadata in the shared task system. Use this whenever task state changes — do not edit tasks.json manually outside of this workflow.

---

## Steps

### 1. Identify the task
If you know the task ID, state it explicitly (e.g., `CRM-004`).  
If you are not sure, read `ai-context/tasks.json` and identify the task based on current work context or the active handoff. Confirm the ID before proceeding.

### 2. Read the current task record
Open `ai-context/tasks.json` and locate the task object matching the ID.  
Read all current field values before changing anything. Note the existing `status`, `next_action`, and `notes` so you do not accidentally erase information.

### 3. Apply the requested updates
Modify only the fields that need to change. Supported fields:

| Field | Notes |
|---|---|
| `status` | Valid values: `pending`, `in_progress`, `ready`, `review`, `done`, `blocked` |
| `priority` | Valid values: `critical`, `high`, `medium`, `low` |
| `owner` | Agent name or `"unassigned"` |
| `next_action` | A single specific sentence — what happens next |
| `notes` | Append new notes; do not delete prior notes |
| `files` | Add any new files created or heavily modified by this task |

Do not change `id` or `area`.

### 4. Set last_updated_by
Set `last_updated_by` to your agent name exactly as it appears in `ai-context/agents.md`.

### 5. Set updated_at
Set `updated_at` to the current ISO 8601 timestamp.  
Example: `"2026-04-02T12:00:00Z"`

### 6. Update meta.last_updated
At the top of tasks.json, update `meta.last_updated` to the same timestamp.  
This field signals to all agents that the file has changed.

### 7. If status changed to "done" — verify completeness
Before marking a task `done`, confirm all of the following:
- [ ] The relevant code or config changes are complete and functional
- [ ] A log entry has been appended to today's log file in `ai-context/logs/`
- [ ] The active handoff (`ai-context/handoffs/active.md`) reflects the completion
- [ ] Any architectural or product decisions made during this task are recorded in `ai-context/decisions/`
- [ ] The `files` array on the task lists all key files created or changed

If any item is missing, complete it before setting status to `done`.

### 8. Append a log entry
Open `ai-context/logs/YYYY-MM-DD.md` and append:

```markdown
## [HH:MM UTC] — [Your Agent Name]

**Action:** Updated task [TASK-ID] — [field changed]: [old value] → [new value]

**Reason:** [one sentence explaining why]
```

---

**Quick reference — status lifecycle:**

```
pending → ready → in_progress → review → done
                        ↓
                     blocked (can return to in_progress or ready)
```
