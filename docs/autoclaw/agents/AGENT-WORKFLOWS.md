# Agent Workflow Chains

Pre-built agent sequences for common PANaCEa development tasks.

---

## Workflow 1: New Feature Implementation

**Trigger:** "Add a new drill type" or "Build X feature"

```
ORCHESTRATOR (route task)
    │
    ▼
SCOUT (understand existing patterns)
    → Read existing drill implementations
    → Map component/hook/service/endpoint pattern
    → Report: DrillShell → useDrillFSRS → submit-review endpoint
    │
    ▼
ARCHITECT (design)
    → Option A: New component in components/drill/
    → Option B: Extend existing drill
    → ADR in .autoclaw/decision-log.md
    │
    ▼
BUILDER (implement in sprints)
    → Sprint 1: Type definitions + hook
    → Sprint 2: Component + wiring
    → Sprint 3: Endpoint + service
    → Sprint 4: Tests
    → Verify each sprint: npm test + typecheck
    │
    ▼
REVIEWER (self-critique)
    → 6-dimension checklist
    → Security: auth/ownership/input validation
    │
    ▼
QA (end-to-end)
    → User can select drill → answer questions → see results → analytics update
    → Data persists, auth enforced, states handled
    │
    ▼
DONE → Update .autoclaw/task-ledger.md
```

### Parallel Sub-Agent Strategy
```
Sprint 3 (endpoint + service): spawn 2 sub-agents
  ├── Sub-agent A: implement submit-review endpoint
  └── Sub-agent B: implement drill service logic
  → Verify both independently → merge → test
```

---

## Workflow 2: Bug Fix

**Trigger:** Test failure, build break, runtime error

```
DEBUGGER (reproduce → isolate → fix root cause)
    │
    ├── Read failing test, reproduce error
    ├── git bisect if regression
    ├── Specific hypothesis → verify → minimal fix
    └── Write regression test
    │
    ▼
BUILDER (apply fix)
    │
    ▼
REVIEWER (verify fix didn't break anything)
    │
    ▼
QA (verify user path still works)
    │
    ▼
DONE → Log to .autoclaw/error-log.md
```

---

## Workflow 3: Refactoring (Large File Decomposition)

**Trigger:** "Decompose PatientEncounterMode" or "Extract X from Y"

```
SCOUT (understand current structure)
    → Identify pure functions vs hook-dependent code
    → Map import graph
    │
    ▼
ARCHITECT (extraction strategy)
    → Round 1: Pure utilities → helpers.ts
    → Round 2: Sub-views → separate components
    → Round 3: Hooks extraction
    │
    ▼
BUILDER (extract round by round)
    → Round 1: Extract pure functions, verify tests
    → Round 2: Extract view components, verify rendering
    → Round 3: Extract hooks, verify behavior
    │
    ▼
REVIEWER + QA (per round)
    │
    ▼
DONE → Update .autoclaw/code-quality-log.md with new line counts
```

### Extraction Rules
- Pure functions: zero component imports → safe to extract first
- Sub-views: self-contained JSX blocks → extract with prop interfaces
- Hooks: stateful logic → extract last (most risky)
- Verify after EVERY extraction round
- Target: file < 1000 lines, each sub-component < 300 lines

---

## Workflow 4: Schema Migration

**Trigger:** "Apply pending migrations" or "Add X model"

```
SECURITY (pre-flight audit)
    → Check migration DDL for destructive operations
    → Verify rollback path exists
    → Verify no data loss risk
    → Check indexes for N+1 prevention
    │
    ▼
ARCHITECT (migration impact analysis)
    → Which services query this table?
    → Which endpoints mutate this data?
    → Update types after migration?
    │
    ▼
PRISMA-DATA-INTEGRITY (apply + verify)
    → npx prisma migrate deploy (dev)
    → npx prisma generate
    → Verify models accessible
    │
    ▼
BUILDER (update application code)
    → Update services using new/updated models
    → Update types
    │
    ▼
REGRESSION-GUARD (test suite)
    → Full test suite must pass
    → Targeted tests for new migration
    │
    ▼
DONE → Update .autoclaw/decision-log.md
```

**⚠️ SCHEMA MIGRATIONS REQUIRE AARON APPROVAL**

---

## Workflow 5: Production Deployment

**Trigger:** "Deploy to production" or pre-release verification

```
PERFORMANCE (audit build + bundle)
    → Bundle size check, code splitting verify
    │
    ▼
SECURITY (full audit)
    → Secrets check: no keys in client bundle
    → Auth: all endpoints gated
    → CSP headers, rate limiting
    │
    ▼
REGRESSION-GUARD (full test suite)
    → npm test: 0 failures required
    → npm run typecheck: 0 errors
    │
    ▼
DEPLOYMENT-GUARD (deploy verification)
    → wrangler.toml config check
    → KV namespaces mapped correctly
    → Environment variables set
    │
    ▼
DEPLOY → npm run deploy:local
    │
    ▼
QA (post-deploy smoke test)
    → Study session loads
    → Questions render
    → Answers submit and persist
    → Analytics update
    │
    ▼
DONE → Update .autoclaw/security-log.md
```

**⚠️ DEPLOYMENT REQUIRES AARON APPROVAL**

---

## Workflow 6: Content Generation Pipeline

**Trigger:** "Generate questions for CV system" or "Enrich content"

```
CONTENT-REFINERY (ingest source material)
    → PDF/media → structured content
    │
    ▼
QUESTION-GENERATION (AI generation)
    → Gemini → validated JSON
    → Blueprint-aligned topics
    │
    ▼
MEDICAL-VERIFIER (accuracy check)
    → Clinical correctness review
    → Flag incorrect answers/rationales
    │
    ▼
CLINICAL-CONTENT-AUDITOR (quality audit)
    → Taxonomy alignment
    → Difficulty calibration
    │
    ▼
BLUEPRINT-COVERAGE (coverage check)
    → Map to NCCPA blueprint
    → Identify gaps
    │
    ▼
CONTENT-QUALITY (final validation)
    → content_health_audit tool
    → question_quality_check tool
    │
    ▼
DONE → Questions ready for reservoir
```

---

## Workflow 7: Test Coverage Expansion

**Trigger:** "Add tests for X" or "Improve coverage in Y"

```
SCOUT (identify gaps)
    → Read coverage report: npm run test:coverage
    → Identify uncovered critical paths
    │
    ▼
ARCHITECT (test strategy)
    → Unit tests for pure logic
    → Integration tests for services
    → E2E for critical user flows
    │
    ▼
BUILDER (write tests in sprints)
    → Sprint 1: Happy path tests
    → Sprint 2: Edge cases
    → Sprint 3: Error handling
    │
    ▼
REGRESSION-GUARD (verify)
    → Coverage improved?
    → No existing tests broken?
    │
    ▼
DONE → Update .autoclaw/test-log.md
```

---

## Workflow 8: Code Review (Incoming PR/Sub-Agent Output)

**Trigger:** Sub-agent completes work, PR needs review

```
REVIEWER (6-dimension critique)
    │
    ├── Correctness: solves stated problem? edge cases?
    ├── Security: no secrets, auth gated, input validated?
    ├── Maintainability: follows patterns, no duplication?
    ├── Performance: no N+1, no unnecessary renders?
    ├── UX: loading/empty/error states?
    └── Testing: new behavior covered?
    │
    ▼
SECURITY (if auth/schema/Edge changes)
    │
    ▼
BUILDER (fix issues found)
    │
    ▼
QA (re-verify)
    │
    ▼
ACCEPT or REJECT → Log to .autoclaw/task-ledger.md
```

---

## Quick Reference: Which Agent When

| You want to... | Start with |
|----------------|------------|
| Add a feature | Orchestrator → Scout → Architect → Builder |
| Fix a bug | Debugger → Builder |
| Refactor a file | Scout → Architect → Builder (round by round) |
| Apply a migration | Security → Architect → Prisma-Data-Integrity |
| Deploy | Performance → Security → Regression-Guard → Deployment-Guard |
| Generate content | Content-Refinery → Question-Generation → Medical-Verifier |
| Add tests | Scout → Architect → Builder |
| Review code | Reviewer → (Security if needed) |
| Check health | Regression-Guard (tests) + Prisma-Data-Integrity (DB) |
| Audit security | Security |
| Improve perf | Performance |
| Decide UX | Product |
