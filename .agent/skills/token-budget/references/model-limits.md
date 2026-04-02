# Model Context Window Reference

This reference table lists context window sizes, effective working limits, recommended loading strategies, and notes for each model commonly used with the Antigravity Agent OS. Keep this file updated as new models are released or limits are revised.

Last updated: 2026-04-02

---

## Quick Reference Table

| Model | Total Context | Effective Working Limit | 70% Budget | Recommended Strategy |
|-------|--------------|------------------------|------------|---------------------|
| Gemini 3 Pro | 1,000,000 tokens | ~200,000 tokens | ~140,000 tokens | Load all tiers freely; skip archival only |
| Gemini 3 Flash | 1,000,000 tokens | ~150,000 tokens | ~105,000 tokens | Load all tiers; apply mild truncation on old logs |
| Claude Sonnet 4.6 | 200,000 tokens | ~150,000 tokens | ~105,000 tokens | Load Tier 1 + 2 fully; Tier 3 on demand |
| Claude Opus | 200,000 tokens | ~150,000 tokens | ~105,000 tokens | Same as Claude Sonnet 4.6 |
| GPT-OSS | 128,000 tokens | ~100,000 tokens | ~70,000 tokens | Filter tasks.json; truncate logs; skip older decisions |

---

## Detailed Model Profiles

### Gemini 3 Pro

| Property | Value |
|----------|-------|
| **Total context window** | 1,000,000 tokens |
| **Effective working limit** | ~200,000 tokens |
| **Reason for effective limit** | Performance and coherence degrade significantly beyond ~200k tokens, even if the model technically accepts the input. Retrieval accuracy for early-context content drops at extreme lengths. |
| **70% available budget** | ~140,000 tokens |
| **Recommended tier loading** | Tier 1 + 2 + most Tier 3 |
| **Known limitations** | Very long prompts may cause slower inference. For very large projects (200+ tasks), still apply tasks.json filtering. |
| **Best for** | Large projects with many tasks, long decision histories, and multi-day log review |

---

### Gemini 3 Flash

| Property | Value |
|----------|-------|
| **Total context window** | 1,000,000 tokens |
| **Effective working limit** | ~150,000 tokens |
| **Reason for effective limit** | Optimized for speed; effective reasoning depth is lower than Pro. Practical limit for high-quality responses is closer to 150k. |
| **70% available budget** | ~105,000 tokens |
| **Recommended tier loading** | Tier 1 + 2; selective Tier 3 |
| **Known limitations** | Less suited for complex multi-file reasoning than Pro. Prefer scoped loading (one task at a time) for intricate work. |
| **Best for** | Fast-turnaround tasks, status checks, routine handoffs, simple task updates |

---

### Claude Sonnet 4.6

| Property | Value |
|----------|-------|
| **Total context window** | 200,000 tokens |
| **Effective working limit** | ~150,000 tokens |
| **Reason for effective limit** | Strong instruction-following throughout the window, but reserve headroom for the model's chain-of-thought and structured output generation. |
| **70% available budget** | ~105,000 tokens |
| **Recommended tier loading** | Tier 1 + 2 fully; Tier 3 on demand only |
| **Known limitations** | Context window is 5× smaller than Gemini models. Projects with 50+ tasks and verbose logs will need filtering. |
| **Best for** | Code review, structured reasoning, decision documentation, complex task coordination |
| **Optimization tip** | When tasks.json exceeds 30 tasks, filter to active statuses only (saves ~3,000 tokens on a 50-task project). |

---

### Claude Opus

| Property | Value |
|----------|-------|
| **Total context window** | 200,000 tokens |
| **Effective working limit** | ~150,000 tokens |
| **Reason for effective limit** | Same window size as Sonnet; same reservation policy applies. |
| **70% available budget** | ~105,000 tokens |
| **Recommended tier loading** | Tier 1 + 2 fully; Tier 3 on demand only |
| **Known limitations** | Same window constraints as Sonnet. Higher cost per token makes aggressive context loading more expensive. |
| **Best for** | Highest-stakes reasoning tasks: architecture decisions, security review, complex debugging, critical handoffs |
| **Optimization tip** | Due to higher per-token cost, apply budget optimizations more aggressively than on Sonnet to reduce cost without sacrificing quality. |

---

### GPT-OSS

| Property | Value |
|----------|-------|
| **Total context window** | 128,000 tokens |
| **Effective working limit** | ~100,000 tokens |
| **Reason for effective limit** | Smaller window requires careful planning. Reserve 28k for working memory and output to avoid truncation on longer responses. |
| **70% available budget** | ~70,000 tokens |
| **Recommended tier loading** | Tier 1 (filtered) + Tier 2 (truncated); Tier 3 only for single targeted files |
| **Known limitations** | The smallest context window of models in common use. Projects with more than ~20 active tasks will require aggressive filtering. Multi-day log review is not practical. |
| **Best for** | Targeted single-task work, quick status updates, code generation for a specific file |
| **Required optimizations** | Always apply Strategy A (filter tasks.json to active statuses) and Strategy B (truncate log to last 3 entries). Skip all Tier 3 by default. |

---

## Estimation Reference

Use these benchmarks when calculating token costs for files not covered by the SKILL.md estimates.

| Content Type | Tokens per Unit |
|-------------|----------------|
| Plain prose (average density) | ~250 tokens/KB |
| Compact JSON (short keys) | ~300 tokens/KB |
| Verbose JSON (long keys, nested) | ~200 tokens/KB |
| Markdown with headings and tables | ~220 tokens/KB |
| Code (average, mixed languages) | ~200 tokens/KB |
| YAML frontmatter | ~100 tokens/KB |

**Shorthand:**
- 1 token ≈ 4 characters
- 1 token ≈ 0.75 words
- A single paragraph of prose ≈ 75–100 tokens
- A typical short function (20 lines) ≈ 100–150 tokens
- A full-page markdown document ≈ 400–600 tokens

---

## Budget Decision Tree

Use this decision tree when planning a context load for a session:

```
Start: What model is running?
│
├─ Gemini 3 Pro or Flash → Budget is generous.
│   Load Tier 1 + 2 fully. Load Tier 3 for relevant files.
│   Skip only Tier 4 (archival). No filtering needed unless tasks > 100.
│
├─ Claude Sonnet 4.6 or Opus → Budget is moderate.
│   Load Tier 1 fully.
│   Load Tier 2 (apply truncation if log > 8 entries).
│   Load Tier 3 only for files directly relevant to current task.
│   Skip Tier 4. Filter tasks.json if > 30 tasks.
│
└─ GPT-OSS → Budget is constrained.
    Load Tier 1 with mandatory filtering:
      - tasks.json: active statuses only
    Load Tier 2 with mandatory truncation:
      - Today's log: last 3 entries only
      - Most recent decision only if < 7 days old
    Skip all Tier 3 by default (load individual files on-demand only).
    Skip all Tier 4.
    If Tier 1 filtered total > 70,000 tokens → trigger budget warning.
```

---

## Updating This Reference

When a new model is added to the project or an existing model's limits are revised:

1. Add a row to the Quick Reference Table.
2. Add a full Detailed Model Profile section.
3. Update the Budget Decision Tree if the new model falls outside existing tiers.
4. Log the update as a decision in `ai-context/decisions/` if the change affects recommended loading strategies for existing sessions.
5. Commit: `git commit -m "docs: update model-limits.md with [model name] profile"`
