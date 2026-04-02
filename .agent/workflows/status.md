# Show Project Status

**Trigger:** `/status`  
**Description:** Summarize current repo state from the shared context files.

---

## Steps

### 1. Read the state files
Read `ai-context/project.md`, `dashboard.md`, `tasks.json`, and `handoffs/active.md`.

### 2. Summarize what matters now
Include:
- current project goal
- active task and owner
- ready tasks by priority
- blocked tasks
- current handoff target

### 3. Add operational signals when useful
If relevant, include:
- current git branch
- recent validation status
- federated repo status from `ai-context/federation-cache.json`

### 4. Output a concise board
Format:

```markdown
## Status

**Current Task:** ...
**Next Action:** ...
**Blocked:** ...
**Ready Queue:** ...
**Handoff:** ...
```
