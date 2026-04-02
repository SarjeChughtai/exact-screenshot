# Test And Verify

**Trigger:** `/test`  
**Description:** Generate or run tests, then report what is covered and what is still unverified.

---

## Steps

### 1. Identify the target behavior
Map the requested test scope to a file, workflow, or task ID.

### 2. Inspect existing test patterns
Use the project’s current test framework and conventions before adding anything new.

### 3. Define the cases
Cover:
- the happy path
- the highest-risk failure mode
- the most likely regression edge case

### 4. Run the narrowest useful command first
Prefer targeted tests before the full suite unless the user asked for the full suite.

### 5. Report clearly
End with:
- tests added or run
- pass/fail status
- what remains untested
- whether the task can move to `review` or still needs fixes
