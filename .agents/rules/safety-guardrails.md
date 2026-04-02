# Safety Guardrails

These rules govern how agents assess and execute commands. When in doubt, err on the side of caution and seek explicit approval.

---

## Core Principle

**Safety > speed.** An irreversible mistake is always worse than a delayed action. If you are uncertain whether a command is safe, treat it as destructive and seek approval before running it.

---

## Command Classification

Every command or action falls into one of three categories:

### Read-Only (auto-approved)
These commands observe the system without modifying state. Agents may run them freely.

Examples:
- `cat`, `less`, `head`, `tail`, `grep`, `find`, `ls`, `tree`
- `git status`, `git log`, `git diff`
- `echo`, `env`, `printenv`, `which`, `type`
- Reading files via tool calls
- `curl` / `fetch` for GET requests with no side effects
- `ps`, `df`, `du`, `uptime`

### Write (approval needed before first run)
These commands create or modify state but are generally reversible or low-risk. The agent must describe what it intends to do and confirm before proceeding — unless the user has already explicitly authorized this class of action for the current task.

Examples:
- Creating new files or directories
- Editing existing source files
- Running database migrations in development
- Installing packages or dependencies
- Starting or stopping local development servers
- `git add`, `git commit`, `git checkout`
- Writing to config files

### Destructive (explicit permission required every time)
These commands can cause data loss, environment breakage, or irreversible state changes. Agents must never run them without explicit per-instance user approval, even if they have been approved before in the same session.

Examples:
- `rm -rf`, `rmdir`, any bulk file deletion
- Dropping database tables or truncating data
- `git push --force`, `git reset --hard`, `git clean -fd`
- Overwriting production config or secrets
- Uninstalling or removing system packages
- Modifying or deleting CI/CD pipeline definitions
- Any command run against a production environment
- Anything that modifies shared external infrastructure

---

## Decision Rules

- **If the command is clearly read-only:** proceed without asking.
- **If the command is write-level:** briefly state what you are about to do, then proceed unless the user has already approved this class of action.
- **If the command is destructive:** stop, describe the exact command and its effect, and wait for explicit approval. Do not proceed until you have it.
- **If you are unsure which category a command falls into:** treat it as destructive.

---

## Post-Action Verification

After any write or destructive action, verify the outcome:

- Confirm the file was written or modified correctly (read it back if needed).
- Confirm no unintended side effects occurred.
- If the outcome is not what was expected, surface that immediately — do not proceed as if it worked.

---

## Never Claim Untested Results

- Do not say "the tests pass" unless you ran the tests and observed the output.
- Do not say "the build succeeded" unless you ran the build and confirmed it.
- Do not say "the file was updated" unless you verified the file's contents after writing it.
- Unverified outcomes must be labeled as such: "I have not run this yet" or "this is untested."
