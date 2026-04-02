---
name: token-budget
description: Estimate context window usage before loading ai-context files and skip low-priority context when nearing model limits. Use when starting a session, when context seems too large, when switching to a smaller model, or when the agent needs to optimize which files to load.
---

## Goal

Before loading context files, calculate the token cost of the planned load, compare it against the active model's effective context budget, and produce a ranked loading plan that guarantees the most critical files are always loaded while gracefully dropping lower-priority content when the budget is tight.

---

## 1. Model Context Limits

Use the following reference table when determining the available budget. See `references/model-limits.md` for the full table with additional models and notes.

| Model | Total Context | Effective Working Limit | Notes |
|-------|--------------|------------------------|-------|
| Gemini 3 Pro | 1,000,000 tokens | ~200,000 tokens | Very large window; effective limit reflects practical performance degradation at extremes |
| Gemini 3 Flash | 1,000,000 tokens | ~150,000 tokens | Faster inference; slightly lower effective limit |
| Claude Sonnet 4.6 | 200,000 tokens | ~150,000 tokens | Strong instruction following at scale |
| Claude Opus | 200,000 tokens | ~150,000 tokens | Highest reasoning quality; same window as Sonnet |
| GPT-OSS | 128,000 tokens | ~100,000 tokens | Smallest window in common use; plan carefully |

**Rule of thumb for estimation:**
- 1 token ≈ 4 characters
- 1 token ≈ 0.75 words
- 1 KB of plain text ≈ 250 tokens
- 1 KB of JSON ≈ 200–300 tokens (varies with key verbosity)

**Reserve rule:** Always reserve at least **30% of the effective context limit** for the agent's working memory, reasoning, and output generation. The remaining 70% is the available loading budget.

---

## 2. File Size Estimation

Before loading any file, estimate its token cost using these benchmarks. Round up when uncertain.

### Fixed-size files (estimate is reliable)
| File | Estimated Tokens | Notes |
|------|-----------------|-------|
| `ai-context/project.md` | ~500 tokens | Stable; rarely changes significantly |
| `ai-context/dashboard.md` | ~300 tokens | Short status snapshot |
| `ai-context/agents.md` | ~800 tokens | Grows slowly as agents are added |
| `ai-context/handoffs/active.md` | ~400 tokens | One active handoff record |

### Variable-size files (estimate per item)
| File | Estimation Method |
|------|-----------------|
| `ai-context/tasks.json` | ~100 tokens per task. A project with 20 tasks ≈ 2,000 tokens. With 60 tasks ≈ 6,000 tokens. |
| `ai-context/logs/YYYY-MM-DD.md` | ~200 tokens per log entry. A busy day with 10 entries ≈ 2,000 tokens. |
| `ai-context/decisions/*.md` | ~300 tokens each. Load only relevant files. |
| Previous log files (older dates) | ~200 tokens per entry. Often safe to skip. |
| `ai-context/templates/*` | ~150 tokens each. Rarely needed during normal sessions. |
| `ai-context/runbooks/*` | ~200 tokens each. Only load when following a specific procedure. |
| Archived handoffs | ~400 tokens each. Skip unless investigating history. |

---

## 3. Loading Priority Tiers

Files are organized into four priority tiers. Higher tiers are loaded first; lower tiers are dropped when the budget is tight.

### Tier 1 — Always Load (Critical Context)
These files are mandatory regardless of budget. If loading them would exceed the budget, do not skip them — instead warn the user (see Section 6, Constraint 2).

| File | Est. Tokens |
|------|------------|
| `ai-context/project.md` | ~500 |
| `ai-context/dashboard.md` | ~300 |
| `ai-context/tasks.json` | ~100/task |
| `ai-context/agents.md` | ~800 |
| `ai-context/handoffs/active.md` | ~400 |

**Tier 1 total estimate:** 2,000–5,000 tokens (depending on task count)

### Tier 2 — Load by Default (Session Context)
Load these at the start of every session unless the budget is already >80% consumed by Tier 1.

| File | Est. Tokens | Condition |
|------|------------|-----------|
| `ai-context/logs/YYYY-MM-DD.md` (today only) | ~200/entry | Always attempt; truncate if budget is tight (see Section 5) |
| Most recent decision file (if created in the last 7 days) | ~300 | Skip if no recent decisions exist |

**Tier 2 total estimate:** 500–2,000 tokens

### Tier 3 — Load on Demand (Reference Context)
Load only when the agent explicitly needs this information for the current task. Not loaded by default.

| File | Est. Tokens | When to Load |
|------|------------|-------------|
| Previous log files (yesterday and older) | ~200/entry | When investigating a past issue or reviewing history |
| Older decision files (>7 days) | ~300 each | When a decision in the relevant area predates the last 7 days |
| `ai-context/templates/*` | ~150 each | When creating a new task, handoff, or decision from scratch |
| `ai-context/runbooks/*` | ~200 each | When following a specific operational procedure |

### Tier 4 — Skip Unless Explicitly Requested (Archival)
These files are almost never needed during a standard working session. Do not load them proactively.

| File | Why Skipped |
|------|------------|
| Archived handoffs (`handoffs/archive/`) | Historical record only; active.md covers current state |
| Completed task details (status: done/archived in tasks.json) | Exclude from loaded content when summarizing tasks.json |
| Log files older than 7 days | Low relevance; load only if a specific date is requested |

---

## 4. Budget Calculation Procedure

Run this procedure before loading any context files, at session start, or when switching models.

**Step a — Identify the current model.**
Determine which model is running this session. If unknown, ask or default to the most conservative limit in the table (GPT-OSS at 100k effective).

**Step b — Set the effective limit.**
Look up the model's effective working limit from the table in Section 1.

**Step c — Calculate the available budget.**
```
available_budget = effective_limit × 0.70
```

**Step d — Sum Tier 1 files (mandatory load).**
Estimate each Tier 1 file. For `tasks.json`, count the tasks and multiply by 100.
```
tier1_total = sum of all Tier 1 estimates
```
If `tier1_total > available_budget`, proceed to Section 6, Constraint 2.

**Step e — Calculate remaining budget after Tier 1.**
```
remaining = available_budget - tier1_total
```

**Step f — Add Tier 2 if budget remains.**
If `remaining > 500`, load Tier 2 files. Apply optimizations from Section 5 if budget is between 500–1,000 tokens.

**Step g — Add relevant Tier 3 items if budget remains.**
Only load Tier 3 files that are directly relevant to the current task. Each file added should be justified by the task context.

**Step h — Produce the Context Budget Report (Section 6 format).**

---

## 5. Optimization Strategies

Apply these strategies when the budget is tight (remaining budget after Tier 1 is less than 2,000 tokens, or less than 20% of the total available budget).

### Strategy A — Filter tasks.json by active status
Instead of loading all tasks, load only tasks with `status` equal to one of:
- `in_progress`
- `ready`
- `blocked`

Skip tasks with `status: done`, `status: archived`, or `status: pending`. Annotate in the report: _"tasks.json summarized: loaded N of M tasks (active statuses only)."_

### Strategy B — Truncate today's log
Load only the **last 3 entries** from today's log file rather than the full file. Annotate: _"Log truncated to last 3 entries to conserve budget."_

### Strategy C — Skip older decisions
Do not load any decision file with a `date` field older than 7 days from today. Annotate each skipped file.

### Strategy D — Task-scoped loading
If the active handoff identifies a specific task ID, load only the data for that task from `tasks.json` rather than the full file. Annotate: _"tasks.json scoped to handoff task [TASK-ID]."_

### Strategy E — Reference instead of load
For Tier 3 and Tier 4 files, note the file path in the report as a reference rather than loading the content. The agent can load individual files on-demand during the session.

---

## 6. Output Format

When this skill activates, produce a Context Budget Report before loading any files:

```
## Context Budget Report

Model: [model name]
Effective limit: [tokens] tokens
Reserve (30%): [tokens] tokens
Available budget (70%): [tokens] tokens

### Files Loaded

| File | Est. Tokens | Tier | Notes |
|------|------------|------|-------|
| ai-context/project.md | ~500 | 1 | |
| ai-context/dashboard.md | ~300 | 1 | |
| ai-context/tasks.json | ~[N×100] | 1 | [N] tasks loaded |
| ai-context/agents.md | ~800 | 1 | |
| ai-context/handoffs/active.md | ~400 | 1 | |
| ai-context/logs/YYYY-MM-DD.md | ~[M×200] | 2 | [M] entries |
| ai-context/decisions/[file] | ~300 | 2 | Created [date] |

**Total loaded:** [X] tokens ([Y]% of available budget)  
**Remaining:** [Z] tokens

### Files Skipped

| File | Tier | Reason |
|------|------|--------|
| ai-context/logs/YYYY-MM-DD.md (previous days) | 4 | Archival — not needed this session |
| ai-context/templates/* | 3 | No new items being created |
| [other files...] | [tier] | [reason] |

### Optimizations Applied
- [List any strategies from Section 5 that were used, or "None"]
```

---

## Constraints

1. **Never skip Tier 1 files regardless of budget.** Tier 1 is mandatory. Apply optimizations within Tier 1 (e.g., filter tasks.json by status) rather than skipping any Tier 1 file entirely.

2. **If Tier 1 exceeds the available budget, warn the user before loading anything:**
   ```
   ⚠ Context Budget Warning
   
   Tier 1 (mandatory) files require approximately [X] tokens.
   This exceeds the available budget of [Y] tokens for [model name].
   
   The current model may be too small for this project at its current scale.
   
   Options:
   a) Switch to a model with a larger context window (e.g., Claude Sonnet 4.6 or Gemini 3 Flash)
   b) Apply aggressive optimizations: filter tasks.json to in_progress only, skip agents.md
   c) Proceed anyway and accept that some context may be truncated by the model
   
   Awaiting your decision before loading any files.
   ```

3. **Always estimate conservatively.** When in doubt, round up. An overestimate leads to unused budget; an underestimate leads to truncation.

4. **Always produce the report before loading files.** The report is a planning document, not a retrospective. It should be generated before any context is loaded so the agent can adjust the plan before committing.

5. **Re-run this skill when switching models mid-session.** A model switch changes the available budget. Previously safe loads may now exceed the new limit.
