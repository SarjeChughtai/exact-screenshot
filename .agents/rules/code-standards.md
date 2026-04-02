# Code Standards

These rules govern how agents make changes to code and files. The guiding philosophy is minimal blast radius: do the smallest correct thing, leave everything else alone.

---

## Core Principle

**Correctness first. Reversibility second. Aesthetics last.**

A small, ugly, working change is better than a large, clean, broken one. A reversible change is better than an irreversible one. A change that matches existing patterns is better than one that introduces new ones without reason.

---

## Change Size and Scope

- **Prefer small, incremental changes** over large rewrites. If a task can be completed in three lines, do not rewrite the file.
- **Prefer diffs over replacements.** Modify what needs modifying. Leave everything else intact.
- **Keep the blast radius narrow.** A change that could break one thing is preferable to a change that could break ten.
- **Do not expand scope without explicit instruction.** If the task is to fix a bug, fix the bug. Do not refactor the surrounding code unless asked.

---

## Prohibitions

Agents must not do any of the following unless explicitly instructed:

- **Refactor** code that is not directly related to the current task
- **Rename** variables, functions, files, or directories
- **Delete** files, directories, or blocks of code
- **Reorganize** directory structure or file layout
- **"Clean up"** unrelated code (dead code removal, import sorting, formatting passes)
- **Extract** functions, classes, or modules for "better structure"
- **Upgrade** dependencies or change lock files incidentally

If you believe one of these actions is necessary and would meaningfully unblock the task, propose it explicitly and wait for approval before doing it.

---

## Pattern Matching

Before introducing a new pattern, look for how similar problems are solved in the existing codebase:

- Match existing naming conventions for variables, functions, files, and directories.
- Match existing error handling patterns.
- Match existing logging patterns.
- Match existing test structures and assertion styles.
- Match existing import ordering and module organization.

A new pattern introduced without reason creates inconsistency that becomes someone else's problem.

---

## Environment Separation

- **Never conflate development and production.** Configuration, credentials, database connections, and deployment targets must always be clearly separated.
- **Never hardcode production values** into code, config files, or scripts.
- **Never run production-affecting commands** from a development context without explicit confirmation.
- Document any environment-specific setup implications when they exist.

---

## Correctness and Verification

- Do not mark a task complete unless the code actually works for the specified case.
- Do not claim tests pass unless you ran them.
- Do not assume a change is backward-compatible — verify it.
- If a change has migration implications (database schema, API contract, environment variables, etc.), document them explicitly before or alongside the change.

---

## Documentation Obligations

When a change has any of the following implications, document them in the task log and handoff:

- **Migration required** — database schema, data transformation, or state migration
- **Environment setup change** — new env vars, secrets, config keys, or service dependencies
- **Deployment order matters** — steps that must happen in a specific sequence
- **Breaking change** — API contract, interface, or behavior change that affects callers

"Document" means write it in the log and handoff — not just mention it in a chat response.
