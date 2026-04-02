# Plan Work

**Trigger:** `/plan`  
**Description:** Create a scoped implementation plan that fits the current `ai-context` task model and session protocol.

---

## Steps

### 1. Read the current operating context
Read `ai-context/project.md`, `ai-context/dashboard.md`, `ai-context/tasks.json`, and `ai-context/handoffs/active.md`.

### 2. Clarify the target
Summarize the requested outcome in one sentence.  
If the request is ambiguous in a way that changes implementation, ask the smallest possible clarifying question first.

### 3. Break the work into executable tasks
Write a short plan with:
- the goal
- the intended user-facing or repo-facing outcome
- 3-10 concrete tasks
- explicit verification for each task

### 4. Align the plan with the task registry
If the work is already represented in `tasks.json`, point the plan at the existing task IDs.  
If not, create or propose new task IDs using the `AREA-NNN` format.

### 5. Identify dependencies and merge points
Call out what must happen first, what can happen in parallel, and where the next handoff will occur.

### 6. End with a ready-to-run summary
Output:

```markdown
## Plan

**Goal:** ...

1. [TASK-ID] ... → Verify: ...
2. [TASK-ID] ... → Verify: ...

**Dependencies:** ...
**Risks:** ...
**First action:** ...
```
