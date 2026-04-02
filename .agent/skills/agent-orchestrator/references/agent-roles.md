# Agent Roles & Capability Matrix

Reference document for the `agent-orchestrator` skill. Use this to determine which agent to assign to each sub-task.

---

## Claude

**Primary Role:** Architect, Planner, Reviewer

**Strengths:**
- Long-context reasoning across large codebases and documentation
- Architecture and system design — can evaluate trade-offs across multiple approaches
- Code review with nuanced feedback (not just linting, but design correctness)
- Writing and documentation — PRDs, ADRs, changelogs, API docs
- Debugging complex logic errors that require multi-file analysis
- Policy and constraint enforcement (e.g., is this approach consistent with our decisions?)

**Weaknesses:**
- Does not execute commands directly in all environments
- Slower for rapid iteration / high-volume boilerplate

**Best Task Types:**
- Initial planning and decomposition of any feature
- Architecture Decision Records (ADRs)
- PR/code review before merge
- Writing technical documentation or specs
- Resolving ambiguous requirements with the user
- Cross-cutting concern analysis (auth, error handling, performance)

**Handoff Patterns:**
- Claude → Codex: After planning, pass implementation task with architectural constraints in notes
- Claude → Aider: After identifying exact lines to change, pass surgical edit task
- Codex/Aider → Claude: Always for review before marking tasks done

**Concurrency Limit:** 5 tasks (Claude handles context-heavy work — avoid overloading)

---

## Codex (OpenAI Codex / GPT-4o with code tools)

**Primary Role:** Implementer, Refactorer

**Strengths:**
- High-volume code generation — scaffolding, boilerplate, CRUD, tests
- Refactoring existing code to new patterns
- Writing comprehensive test suites
- Following strict specifications or schemas to produce conforming output
- Fast iteration on implementation tasks

**Weaknesses:**
- Less reliable for subtle architectural judgment
- May hallucinate APIs — always validate generated imports and types
- Needs clear, scoped task definitions; open-ended tasks produce inconsistent output

**Best Task Types:**
- Implementing a spec or design document produced by Claude
- Writing unit/integration tests for existing or new code
- Refactoring a module to a new pattern (e.g., class → hooks, REST → tRPC)
- Generating repetitive code across multiple files (e.g., CRUD for 5 models)
- Migrating configuration formats

**Handoff Patterns:**
- Claude → Codex: Receive spec, implement, return PR diff for Claude review
- Gemini → Codex: Receive research findings, implement chosen approach
- Codex → Claude: Always for review

**Concurrency Limit:** 8 tasks (Codex handles parallel implementation well)

---

## Aider

**Primary Role:** Surgical Editor

**Strengths:**
- Precise, targeted edits to specific files and line ranges
- Git-aware — commits changes with meaningful messages automatically
- Excellent for bug fixes where the root cause is already identified
- Inline refactors (rename, extract function, change signature) without side effects
- Works well with a narrow, well-defined scope

**Weaknesses:**
- Not suited for large-scale generation or multi-file architecture
- Requires a clear, specific instruction — "fix line 47 in auth.ts to handle null user" not "fix auth"
- Less effective for tasks requiring reasoning across many files

**Best Task Types:**
- Fixing a specific bug in a specific file
- Renaming symbols across a limited scope
- Applying a patch or diff produced by another agent
- Updating configuration values or environment handling
- Small targeted refactors (e.g., "extract this 20-line block into a helper function")

**Handoff Patterns:**
- Claude → Aider: Claude identifies the exact change, Aider executes it
- Aider → Claude: Review the committed change for correctness

**Concurrency Limit:** 4 tasks (Aider is serial by nature — one edit at a time)

---

## Cursor

**Primary Role:** Interactive Editor (Human-in-the-Loop)

**Strengths:**
- Best for tasks where a human developer is actively reviewing suggestions
- Inline completion and multi-cursor edits in a live editor session
- Excellent UI/UX iteration — visual feedback loop
- Works well for ambiguous tasks where the human guides refinement
- Rapid prototyping with immediate visual feedback

**Weaknesses:**
- Requires an active human session — not suitable for fully automated pipelines
- Less useful for long-running background tasks
- Context window can be constrained by open files

**Best Task Types:**
- Frontend UI development with a designer or developer in the loop
- Exploratory refactors where the exact end state is not yet known
- Live debugging sessions
- Prototyping new components or pages

**Handoff Patterns:**
- Typically the final step in a workflow, after planning (Claude) and scaffolding (Codex)
- Cursor → Claude: After interactive session, Claude reviews the output

**Concurrency Limit:** 1 task (requires a single active human session)

---

## Gemini

**Primary Role:** Researcher, Multi-Tool Coordinator

**Strengths:**
- Web search and real-time information retrieval
- Synthesizing information from multiple sources (docs, forums, papers)
- Comparing libraries, APIs, and approaches with up-to-date data
- Multi-modal reasoning (can process images, PDFs, code screenshots)
- Long-context document analysis (e.g., reading an entire API spec)

**Weaknesses:**
- Not specialized for code generation — use Codex for implementation
- Research output must be structured and handed off cleanly or it may be lost
- May introduce outdated best practices if web sources are stale

**Best Task Types:**
- Researching third-party libraries, APIs, or services before adoption
- Comparing authentication providers, payment gateways, hosting options
- Reading and summarizing lengthy documentation (e.g., Stripe docs, AWS guides)
- Finding code examples or reference implementations
- Validating that a proposed approach matches current community best practices

**Handoff Patterns:**
- Gemini → Claude: Deliver research findings, Claude makes the architectural decision
- Gemini → Codex: Deliver reference implementation or spec, Codex builds it
- Always log Gemini's key findings as a decision record before handoff

**Concurrency Limit:** 6 tasks (Gemini handles parallel research well)

---

## Agent Selection Quick Reference

| Task Type                        | Primary Agent | Secondary Agent |
|----------------------------------|--------------|----------------|
| System design / architecture     | Claude       | —              |
| Research / library evaluation    | Gemini       | Claude         |
| Large-scale implementation       | Codex        | Aider          |
| Surgical bug fix                 | Aider        | Codex          |
| Code review                      | Claude       | —              |
| Test writing                     | Codex        | —              |
| Documentation writing            | Claude       | Gemini         |
| Interactive UI prototyping       | Cursor       | Codex          |
| Multi-tool automation workflow   | Gemini       | Claude         |
| Refactor (large)                 | Codex        | Claude         |
| Refactor (targeted)              | Aider        | —              |
