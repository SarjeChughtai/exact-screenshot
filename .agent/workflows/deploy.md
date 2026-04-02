# Deploy Safely

**Trigger:** `/deploy`  
**Description:** Run a release-minded preflight before preview or production deployment.

---

## Steps

### 1. Confirm the deployment target
State whether this is preview, staging, or production.

### 2. Run preflight checks
At minimum, check:
- build or typecheck status
- relevant test status
- obvious environment or secret requirements
- unresolved blockers in `ai-context/tasks.json`

### 3. Review release risk
Call out:
- schema or migration changes
- auth or permission changes
- user-visible workflow changes
- rollback implications

### 4. Execute the deployment path
Use the repo’s actual deployment tooling.  
Do not invent a platform command if the repo already defines one.

### 5. Verify and record
After deployment, report:
- where it was deployed
- what was verified
- any warnings
- the next task or monitoring action
