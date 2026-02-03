# Comprehensive Post-Implementation Audit

**Date:** 2026-02-02  
**Role:** Senior Full-Stack Architect & QA Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness, refactoring opportunities

---

## Critical Fixes (High Priority)

### 1. fsrs-params selects non-existent field (Runtime Error)

**File:** `functions/api/user/fsrs-params.ts`

```typescript
const userProgressRecords = await prisma.userProgress.findMany({
  select: {
    id: true,
    reviewHistory: true,
    medicalContentId: true,  // ❌ UserProgress has NO medicalContentId
  },
});
```

**Schema:** `UserProgress` has `conditionId` (FK to `MedicalContent.id`), not `medicalContentId`. This select will cause Prisma to throw: `Unknown arg 'medicalContentId' in select`.

**Fix:** Use `conditionId` and JOIN to MedicalContent to get system, or add `include: { MedicalContent: { select: { id: true, system: true } } }` and derive system from there. UserProgress.conditionId = MedicalContent.id.

---

### 2. pharmacology-drill references non-existent Question fields

**File:** `functions/api/questions/pharmacology-drill.ts`

The where clause uses `{ drugClass }` and `select` includes `rationale`, `pearls`, `condition`, `drugClass`, `mechanism`, `panceYield`, `imageUrl`—none of these exist on the `Question` model. This will fail at runtime or return undefined.

**Fix:** Use `explanation` instead of `rationale`; remove or map non-existent fields. Add `relatedDrugs` or tags-based filtering if drug class filtering is required.

---

### 3. Edge Runtime: process.env in functions

**Rule:** Cloudflare Edge uses `context.env`; `process.env` is not available in Workers.

**Acceptable:** Scripts, server.ts, vite config, test setup (Node.js context).

**Review:** Functions under `functions/api/` should use `context.env`. Audit shows most use `createEdgePrismaClient(env.DATABASE_URL)` correctly. Services invoked from Node (scripts, Express) may use `process.env`—ensure no `functions/` code imports those services in a way that executes in Edge.

---

### 4. SessionService system name mismatch (Blueprint vs DB)

**File:** `lib/services/session/sessionService.ts`

`calculateNCCPAQuotas` returns keys like `"Cardiovascular"`, `"Dermatology"`. `fetchFromPool` does `where.system = "Cardiovascular"`. PreGeneratedQuestion typically stores `system` as `"CV"`, `"DERM"` (from regenerate-pool-v2, MedicalContent). Result: zero rows for most systems.

**Fix:** Map blueprint names to DB abbreviations (e.g. via `SYSTEM_ALIASES` or `normalizeSystemName`) before querying.

---

## Logical Omissions (Missed / Under-Implemented)

### From FSRS Audits

1. **ReviewLog never written** — Production flows (`submitDrillReview`, etc.) do not write to ReviewLog. Optimizer uses UserProgress.reviewHistory.
2. **Offline submit-review has no retry** — QuizView fire-and-forget `fetch(SUBMIT_REVIEW)`; queueAnswer → `/api/questions/attempt` does not update UserProgress.
3. **submitDrillReview uses default FSRS params** — Does not load PersonalizedFSRSParams.
4. **sessionType/review_type not in API** — No discrimination between MAIN vs CRAM; all modes contaminate FSRS.

### From Content / Analytics Audits

5. **clinicalSettings never populated or filtered** — Rotation mode filters by system only; Surgery deck includes IBS.
6. **cognitiveLevel unused** — Exists on Question; PreGeneratedQuestion has none; speed metrics use mode, not cognitive level.
7. **relatedDrugClasses missing** — Cannot query "questions about ACE Inhibitors"; relatedDrugs is free text.
8. **One Image → Many Questions not supported** — MediaAsset has one quiz config; no QuestionMediaAsset junction.

### From Critical Fixes Tracker

9. **Zod validation incomplete** — 29 FAIL + 17 WARN endpoints still without validation.
10. **Loading state consistency** — 67 components use spinners; 13 use "Loading..." text; SkeletonLoader not fully adopted.

---

## Technical Debt (Refactoring & Optimization)

### Service Fragmentation

- **questionService.ts**, **enhancedQuestionService.ts**, **intelligentQuestionService.ts**, **adaptiveQuestionEngine.ts** — Overlap; consider consolidation.
- **Multiple blueprint sources** — `lib/constants/blueprint.ts`, `lib/poolSelection.ts` (PANCE_SYSTEM_PERCENTAGES), `examService`, `performanceService` each define weights. Consolidate to `lib/constants/blueprint.ts`.

### Prisma Usage

- **Scripts** correctly use `new PrismaClient()` (Node context).
- **Functions** use `createEdgePrismaClient(env.DATABASE_URL)` — correct.
- **Disconnect:** CRITICAL_FIXES_SPRINT_TRACKER reports Prisma disconnect audit passed for all endpoints.

### DRY Violations

- Blueprint percentages duplicated across 4+ files.
- `getSystemsForRotation` vs `ROTATION_OPTIONS` in RotationSelector — slightly different rotation lists (ClinicalRotation vs toolkit Rotation).
- Speed benchmark targets hardcoded in multiple places (60s, 90s) vs audit recommendations (20s, 45s, 75s).

### Node APIs in Edge-Sensitive Paths

- `services/ai/automatedContentPipeline.ts` — `import fs from 'fs'`, `import path from 'path'`. If invoked from `functions/`, will fail in Edge. Confirm this is only used in scripts/Node context.
- `lib/questionGenerator.ts` — `process.env.GEMINI_API_KEY`. Used from where? If from Edge, use `context.env`.

---

## Brittleness & Scalability

### Data Structure Assumptions

1. **medicalContentId format** — fsrs-params assumes `record.medicalContentId.split('-')[0]` gives system code. UserProgress has no medicalContentId; when fixed, MedicalContent.id format (CUID) would not yield system from split. Must JOIN to MedicalContent and use `system` field.
2. **PreGeneratedQuestion.questionData** — JSON shape varies; code assumes `data.options`, `data.correctAnswer`, `data.correctAnswerIndex`. Add runtime validation (Zod) when parsing.
3. **ECGConditionLink.exampleImageUrls** — String[] of URLs; no FK to MediaAsset. Fragile if URLs change or break.

### Load & Scale

1. **UserProgress.reviewHistory** — JSON array grows unbounded per condition. Deprecated in favor of ReviewLog but still in use. Large arrays can slow queries.
2. **Stats API** — Fetches 5000 recent attempts, groups in memory. Consider pagination or materialized aggregates for heavy users.
3. **Pool fetch** — `take: count * 20` with `orderBy: generatedAt asc` can skew distribution when pool is large.

---

## Verification Steps (Test Now)

### 1. fsrs-params runtime

```bash
# Trigger optimization (requires 500+ reviews)
# Expect: Should NOT throw. If it throws on medicalContentId, apply fix first.
curl -X POST /api/user/fsrs-params -H "Authorization: Bearer <token>"
```

### 2. pharmacology-drill

```bash
curl -X POST /api/questions/pharmacology-drill \
  -H "Content-Type: application/json" \
  -d '{"body": {"drugClass": "ACE Inhibitor"}}'
# Expect: Either 404 or question object. Check for runtime errors from invalid select.
```

### 3. Session generation (Surgery / no system)

```bash
# With no system filter, does SessionService return questions?
GET /api/questions/session?count=10
# Check system distribution matches blueprint; verify we get rows (system name fix).
```

### 4. Typecheck & Lint

```bash
npm run typecheck
npm run lint
# Resolve any new errors from recent changes.
```

### 5. Zod validation audit

```bash
npx tsx scripts/audit-zod-validation.ts
# Review FAIL/WARN list; prioritize admin and auth-sensitive endpoints.
```

### 6. Prisma disconnect audit

```bash
npx tsx scripts/audit-prisma-disconnect.ts
# Confirm all endpoints call disconnect in finally.
```

---

## Summary Matrix

| Category            | Count | Severity |
|---------------------|-------|----------|
| Critical Fixes      | 4     | 🔴       |
| Logical Omissions   | 10+   | 🟠       |
| Technical Debt      | 8+    | 🟡       |
| Verification Steps  | 6     | —        |

---

## References

- Audit docs: `docs/AUDIT_*.md` (Granularity, Cognitive Depth, NCCPA Blueprint, Relational Data, Clinical Phase, Media Asset)
- FSRS audits: `AUDIT_REVIEW_LOG_SCHEMA_FSRS.md`, `AUDIT_PRIVACY_TELEMETRY_STORAGE.md`, `AUDIT_BEHAVIORAL_DATA_HYGIENE.md`
- Critical Fixes Tracker: `docs/CRITICAL_FIXES_SPRINT_TRACKER.md`
- Comprehensive Audit: `docs/COMPREHENSIVE_REPO_AUDIT_2026.md`
