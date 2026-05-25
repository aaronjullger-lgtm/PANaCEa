# Agent Runbooks

Operational notes for the most-used PANaCEa agents. How to invoke, what tools they need, common pitfalls, and expected output.

---

## Orchestrator (Mode Agent)

**Skill:** `autoclaw-orchestrator`
**Invoke:** "Work on X feature" or any non-trivial task

### Startup
1. Read `.autoclaw/memory.md` — current state
2. Read `.autoclaw/next-actions.md` — priority queue
3. Determine task type → route to correct mode sequence

### Mode Routing
| Task signature | Sequence |
|---------------|----------|
| "add", "create", "build", "implement" | Scout → Architect → Builder → Reviewer → QA |
| "fix", "debug", "broken" | Debugger → Builder → Reviewer → QA |
| "refactor", "extract", "decompose" | Scout → Architect → Builder (rounds) |
| "review", "audit", "check" | Reviewer → (Security if risky) |
| "research", "how do I", "best practice" | Research |
| "deploy", "ship", "release" | Performance → Security → Regression → Deployment |

### Sub-Agent Management
- Spawn for parallel work: `sessions_spawn(task, label, model: "deepseek-v4-pro")`
- Cap at 2-3 concurrent — more causes context thrash
- Each sub-agent: clear file scope + expected test outcome
- Monitor don't poll: `subagents action:list`
- Kill stalled agents immediately
- ALWAYS verify sub-agent output before accepting:
  ```bash
  npm run build && npm test
  ```

### Common Pitfalls
- **Over-parallelizing:** More agents ≠ faster. 2-3 is the sweet spot.
- **Vague scope:** Sub-agents need explicit file paths and expected outcomes.
- **Skipping verification:** Build + test after EVERY sub-agent handoff.

---

## Builder (Mode Agent)

**Skill:** `autoclaw-builder`
**Invoke:** After Architect produces a plan, or directly for simple fixes

### Pre-Flight
```bash
cd /Users/aaronullger/GitHub/StudyPANaCEa
npm test                          # Baseline: all passing?
npm run typecheck                 # Uses tsconfig.production.json (no OOM flag needed)
```

### Sprint Pattern
```
Sprint N: {what} ({files})
  ├── Read every file first (imports, types, patterns)
  ├── Edit: direct edits for ≤4 files, sub-agent for 5+
  ├── Verify: npm test && typecheck && build
  └── Commit: feat/fix/chore: {description}
```

### Verification Gates (NEVER SKIP)
```bash
npm test                                              # Full suite
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
npm run build
```

### Edge Function Rules (CRITICAL)
- `context.env.*` — never `process.env`
- `safePrismaDisconnect(prisma)` — in finally block
- `authenticatedEndpoint` — wrapper for new endpoints
- Try/catch → `{ error: string }`

### Common Pitfalls
- **Mixing refactors with features:** Keep sprints focused on one concern.
- **Skipping audit:** Import errors are the #1 waste. Read first.
- **Typecheck OOM:** Always use the NODE_OPTIONS flag.

---

## Debugger (Mode Agent)

**Skill:** `autoclaw-debugger`
**Invoke:** Any test failure, build break, or runtime error

### 7-Step Protocol
```
1. REPRODUCE — Get consistent failure, document steps
2. ISOLATE   — Narrow scope: binary search, git bisect, comment-out
3. HYPOTHESIZE — Specific, testable theory
4. INSTRUMENT — Add logging, breakpoints
5. VERIFY    — Confirm root cause. If wrong, back to step 3
6. FIX       — Minimal correct fix. Resist refactor urge.
7. PREVENT   — Regression test + log to .autoclaw/error-log.md
```

### PANaCEa Diagnostic Commands
```bash
# Type errors
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | head -50

# Specific test file
npx vitest run path/to/failing.test.ts --reporter=verbose

# Build failures
npm run build 2>&1 | grep -i "error"

# Recent changes (if regression)
git log --oneline -10
git diff HEAD~1 --stat

# Auth issues
CLERK_AUTH_DEBUG=true npm run dev

# Database inspection
npm run db:studio
```

### Common Failure Patterns
| Symptom | Check |
|---------|-------|
| Import error | Wrong directory depth (`../foo` vs `../../foo`) |
| Module not found | File deleted or moved during refactor |
| Type error on existing code | New code changed a shared type |
| Null reference | Missing optional chaining on injected deps |
| Test timeout | Async operation without await |
| Build failure | `process.env` in Edge, Prisma in frontend |

---

## Reviewer (Mode Agent)

**Skill:** `autoclaw-reviewer`
**Invoke:** After every Builder sprint, before commit

### 6-Dimension Checklist

#### 1. Correctness
- [ ] Solves stated problem?
- [ ] Edge cases: null, empty, error, boundary?
- [ ] Auth/ownership checked for mutations?
- [ ] Data persists correctly?

#### 2. Security
- [ ] No secrets in code/logs?
- [ ] No `process.env` in Edge?
- [ ] `safePrismaDisconnect` in finally blocks?
- [ ] Input validated before DB writes?

#### 3. Maintainability
- [ ] Follows naming conventions?
- [ ] No duplicated logic?
- [ ] Imports clean?
- [ ] File structure matches patterns?

#### 4. Performance
- [ ] No N+1 queries?
- [ ] No unnecessary re-renders?
- [ ] No blocking ops without loading states?

#### 5. UX
- [ ] Loading state for async ops?
- [ ] Empty state for no data?
- [ ] Error state with actionable message?
- [ ] Forms deduped?
- [ ] No console errors?

#### 6. Testing
- [ ] New behavior covered?
- [ ] Edge cases tested?
- [ ] Existing tests still pass?

### Sub-Agent Output Review (EXTRA STRICT)
```bash
# Mandatory checks for sub-agent output:
npm run build          # Must pass
npm test               # 0 failures
rg "from '\.\.\/" --type ts | grep -v "from '\.\.\/\.\.\/"  # Import depth check
rg "process\.env" functions/api/  # Edge hygiene check
```

---

## fsrs-guardrails (Specialist Agent)

**Domain:** FSRS algorithm, binary rating, confidence pipeline
**Critical subsystem:** RISK-001 — errors corrupt user scheduling

### Pre-Flight (ALWAYS)
```bash
npx vitest run tests/fsrs --reporter=verbose
npx vitest run lib/implicit-metrics.test.ts lib/confidence --reporter=verbose
```

### Hard Rules
- **Binary rating ONLY:** Again(0) / Good(1). No Hard/Easy.
- **Only MAIN + DRILL update FSRS:** Cram and rapid_recall excluded.
- **Par time is per-question-type:** Not global.
- **Ghost Grader runs BEFORE confidence pipeline:** Can override to Again.
- **Never modify `lib/fsrs.ts` without running ALL FSRS tests first.**

### Key Files
```
lib/fsrs.ts                         # Core algorithm (21 params)
lib/implicit-metrics.ts             # Behavioral → rating
lib/confidence/                     # 8-stage pipeline
lib/srs/ghostGrader.ts              # Behavioral-biometric override
lib/services/drillReviewService.ts  # Main submission pipeline (2718 lines)
```

### Verification Commands
```bash
# Full FSRS suite
npx vitest run tests/fsrs lib/fsrs.test.ts lib/implicit-metrics.test.ts lib/confidence lib/srs --reporter=verbose

# Specific pipeline stage
npx vitest run lib/confidence/bayesianAccumulator.test.ts --reporter=verbose
```

---

## prisma-data-integrity (Specialist Agent)

**Domain:** Database schema, migrations, indexes, data integrity
**Key file:** `prisma/schema.prisma` (5181 lines, 190 models, 30 enums)

### Pre-Flight
```bash
npx prisma validate           # Schema is valid
npx prisma generate           # Client is current
npm run db:studio             # Visual inspection
```

### Migration Workflow
```
1. Check pending: ls prisma/migrations/
2. Review DDL: read migration.sql
3. Check for: destructive ops, missing indexes, FK violations
4. Dev apply: npx prisma migrate dev
5. Generate: npx prisma generate
6. Test: npm test
7. Document: .autoclaw/decision-log.md
```

### Pending Migrations (as of May 2026)
```
20260418120300_add_missing_fks           # Foreign key constraints
20260418120400_add_missing_composite_indexes  # Performance indexes
20260426000000_osce_factorization        # OSCE schema normalization
20260502000000_normalized_study_schema   # Study schema refactor
20260517000000_add_question_identity_contract  # Question identity
```

### Critical Rules
- **Never drop columns/tables without rollback plan**
- **Always add indexes for common WHERE/JOIN columns**
- **Use transactions for multi-step writes**
- **Schema migrations require Aaron approval**

---

## question-generation (Specialist Agent)

**Domain:** AI question generation, blueprint alignment, content pipeline

### Pipeline
```
Content-Refinery (source material)
    ↓
Question-Generation (Gemini → validated JSON)
    ↓
Medical-Verifier (accuracy check)
    ↓
Clinical-Content-Auditor (quality audit)
    ↓
Blueprint-Coverage (NCCPA alignment)
```

### Tools Used
- `clinical_library_search` — find relevant conditions
- `blueprint_coverage_check` — check NCCPA coverage gaps
- `question_quality_check` — validate generated questions

### Key Files
```
lib/services/autoAuthor/              # AI generation services
functions/api/questions/              # Question CRUD endpoints
lib/constants/blueprint.ts            # NCCPA blueprint
lib/constants/pa-curriculum.ts        # 12 courses, 10 rotations
```

### Verification
```bash
# After generation:
npx vitest run tests/questionGeneration.test.ts --reporter=verbose
npx vitest run functions/api/questions --reporter=verbose
```

---

## deployment-guard (Specialist Agent)

**Domain:** Production readiness, deploy safety
**Requires Aaron approval before deploy**

### Pre-Deploy Checklist
```bash
# 1. All tests pass
npm test                    # Must be 0 failures

# 2. Typecheck clean
npm run typecheck           # Exit 0

# 3. Build succeeds
npm run build               # No errors

# 4. Bundle size check
du -sh dist/

# 5. Secrets audit
rg "process\.env" dist/     # No Edge secrets in bundle

# 6. Config check
cat wrangler.toml            # KV bindings, compatibility date
```

### Deploy Command
```bash
npm run deploy:local  # Build + deploy to Cloudflare Pages
```

### Post-Deploy Smoke
- [ ] Study session loads
- [ ] Questions render
- [ ] Answers submit and persist
- [ ] Analytics update
- [ ] Auth works (login, session)
- [ ] No console errors in production
