---
name: safe-executor
description: |
  Enforces safe command execution by classifying commands as read-only or write/destructive and requiring explicit approval before running state-changing operations. Activate before running any command that modifies files, installs packages, commits code, runs migrations, or touches production. Trigger phrases: "run this command", "execute", "should I run", "is it safe to", "can I run", "before running", "safe to execute", "about to run", "going to run", "run the migration", "git push", "npm install", "delete", "rm ", "deploy".
---

## Goal

Prevent irreversible or unintended side effects by classifying every command before execution, auto-approving safe read-only operations, and requiring explicit human or orchestrator approval for any write or destructive command.

## Instructions

### Step 1 — Classify the Command

Before executing any command, classify it using the categories below.

#### Category A — Read-Only (Auto-Approve)

These commands read state without modifying anything. Execute without asking:

**Shell / Filesystem:**
- `pwd`, `ls`, `ls -la`, `dir`, `find` (without `-delete`)
- `cat`, `head`, `tail`, `less`, `more`, `wc`
- `echo` (printing to stdout only, not to a file)
- `which`, `where`, `type`
- `env`, `printenv`
- `diff` (read-only comparison)

**Git (read-only):**
- `git status`
- `git diff`, `git diff --staged`
- `git log`, `git show`
- `git branch`, `git remote -v`
- `git stash list`

**Package / Environment (inspection only):**
- `node --version`, `npm --version`, `pnpm --version`
- `npm list`, `npm outdated`
- `node -e "console.log(...)"` (pure output, no side effects)

**Database / API (read-only queries):**
- `SELECT` statements
- `psql` with read-only queries
- `curl` GET requests to non-destructive endpoints

If any part of a command string involves piping to a write command (e.g., `cat file | > output`), reclassify as write.

#### Category B — Write / State-Changing (Require Approval)

These commands modify state. Do NOT execute without explicit approval. Present the command and wait for a "yes", "approve", "go ahead", or equivalent confirmation:

**Filesystem:**
- Any `mv`, `cp` (moving or copying files)
- `mkdir` (creating directories — low risk but confirm)
- Writing to files: `echo "..." > file`, `>> file`, `tee`
- `chmod`, `chown`
- Creating symlinks: `ln -s`

**Package Management:**
- `npm install`, `pnpm install`, `yarn add`
- `npm uninstall`, `pnpm remove`
- Any package installation or removal

**Git (write operations):**
- `git add`, `git commit`
- `git push` (to any branch)
- `git merge`, `git rebase` (non-interactive)
- `git stash`, `git stash pop`
- `git checkout -b` (creating branches)
- `git tag`

**Database / Schema:**
- Any `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` SQL
- Running migration files: `node scripts/migrate.mjs`, `prisma migrate deploy`
- Schema changes: `ALTER TABLE`, `CREATE TABLE`, `DROP TABLE`

**Deployments:**
- `vercel deploy`, `netlify deploy`
- Any CI/CD trigger command
- `docker build`, `docker push`, `docker run`

**Environment / Configuration:**
- Writing to `.env` files
- Updating secrets managers
- `export VAR=value` in a shared shell

**Approval format:**

When a Category B command is required, present it as:

```
⚠ APPROVAL REQUIRED

Command: [exact command]
Type: [Write / Destructive]
Effect: [One sentence describing what this will do]
Reversible: [Yes — how to undo / No — this cannot be undone]
Affected: [file, table, branch, or system that will change]

Approve? (yes/no)
```

Do not proceed until approval is received. If approval is not given within the session, log the pending command in today's log and include it in the handoff.

#### Category C — Never Run Without Explicit Escalation

These commands are forbidden without human escalation — not just approval from the orchestrating agent, but from an authenticated human:

**Recursive / bulk destruction:**
- `rm -rf` any path (especially `/`, `./`, `../`, `node_modules`, `dist`)
- `git clean -fd`
- `DROP DATABASE`, `DROP SCHEMA CASCADE`
- Truncating tables in production

**Irreversible git operations:**
- `git push --force` or `git push -f` to any shared branch
- `git rebase` on a published branch
- `git reset --hard` with remote tracking implications
- `git filter-branch` or `git filter-repo`

**Production deploys:**
- Any deploy command targeting a production environment
- Any database migration against a production database
- Any command that modifies production environment variables or secrets

**Credential operations:**
- Revoking API keys or OAuth tokens
- Rotating secrets in production secret managers
- Deleting service accounts or IAM roles

For Category C commands, respond with:

```
🚫 ESCALATION REQUIRED

This command is in the "never run without human escalation" category.

Command: [exact command]
Risk: [Description of what could go wrong and whether it's recoverable]

This command requires explicit human authorization. Please confirm with the project owner before I proceed.
```

### Step 2 — Execute the Approved Command

After receiving approval for Category B commands (or auto-approving Category A):

1. Execute the command exactly as shown — do not modify it without re-presenting for approval.
2. Capture the full output (stdout and stderr).
3. Note the exit code.

### Step 3 — Verify the Outcome

After execution, verify that the intended effect occurred:

- **Filesystem changes:** Check that created/modified/deleted files reflect the expected state (`ls`, `cat`, `git diff`).
- **Git operations:** Confirm with `git status`, `git log --oneline -3`, or `git diff`.
- **Package installs:** Confirm with `npm list [package]` or check `package.json`.
- **Database changes:** Run a read-only verification query to confirm the schema or data change took effect.
- **Failed commands:** If exit code is non-zero, do not retry automatically. Log the error and surface it in the handoff.

### Step 4 — Log All Executed Commands

Append to today's log file (`ai-context/logs/YYYY-MM-DD.md`):

```markdown
## [HH:MM:SS] Command Executed
Category: [A / B / C]
Command: `[exact command]`
Approval: [auto / [approver name]]
Exit Code: [0 / N]
Effect: [What actually happened, or error description]
```

Log ALL executed commands — including Category A read-only commands that are significant to the session's work (e.g., a `git diff` that revealed unexpected changes).

## Examples

**Example 1 — Auto-approved read command**

```
Command: git status
Category: A (Read-Only)
→ Auto-approved. Executing.

Output:
  On branch feature/auth-refresh
  Changes not staged for commit:
    modified: lib/auth/tokens.ts

→ Verified: working tree has expected modifications.
→ Logged.
```

**Example 2 — Approval required for migration**

```
⚠ APPROVAL REQUIRED

Command: node scripts/migrate.mjs --env staging
Type: Write (Database Migration)
Effect: Applies pending schema migration to the staging database
Reversible: Partially — migration can be reversed with a down migration if one exists
Affected: staging database, contacts table (adds email_verified_at column)

Approve? (yes/no)
```

**Example 3 — Escalation required**

```
🚫 ESCALATION REQUIRED

Command: git push --force origin main
Risk: Force-pushing to main rewrites remote history. This will erase any commits on origin/main that are not in the current local branch. This CANNOT be undone once teammates pull the new history.

This command requires explicit human authorization. Please confirm with the project owner before I proceed.
```

**Example 4 — Failed command handling**

```
Command: npm install @supabase/supabase-js
Category: B | Approved by: Claude (orchestrator)
Exit Code: 1
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'

→ Command failed. Not retrying automatically.
→ Logged failure. Adding to handoff as blocker.
→ Suggested resolution: Run with sudo or fix npm permissions (see npm docs on fixing permissions).
```

## Constraints

- **The classification list is exhaustive for known commands.** If a command is not listed, default to Category B and present for approval.
- **Never modify a command after approval.** If the required command changes (e.g., a flag is added), re-present the modified command for a new approval.
- **Approval must come from a human or from the `agent-orchestrator` skill** acting on behalf of a human-defined workflow. One agent cannot approve another agent's destructive commands autonomously.
- **Logging is mandatory** for all executed commands, not optional. If logging fails (e.g., log file not writable), note the inability to log in the session declaration and proceed with extra caution.
- **Never combine a read command and a write command in a single pipeline without approval.** `cat file.json | node process.mjs > output.json` is a write command and requires Category B approval.
