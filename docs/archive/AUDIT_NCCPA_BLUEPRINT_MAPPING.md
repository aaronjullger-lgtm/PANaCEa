# NCCPA Blueprint Mapping Audit

**Date:** 2025-02-02  
**Scope:** Blueprint percentage mapping and frequency weighting in session generation

---

## 1. Audit Requirements

> **Percentage Mapping:** The database must know that Cardiology is [X]% of the exam, Dermatology is [X]%, etc., regardless of the number of conditions per system.
>
> **Frequency Weighting:** The Core PANCE Simulation must sample inversely to database count to match Blueprint percentages. If the DB has 500 Derm questions and 200 Cardio questions, a naive random shuffle would serve 2.5x more Derm than Cardio—which is dangerous. The session generator must sample by Blueprint weights, not by pool availability.

---

## 2. Percentage Mapping — ✅ IMPLEMENTED

### Single source of truth

`lib/constants/blueprint.ts` defines NCCPA 2025 Blueprint weights:

```typescript
export const NCCPA_2025_BLUEPRINT_PERCENT: Readonly<Record<string, number>> = {
  Cardiovascular: 11,
  Pulmonary: 9,
  Gastrointestinal: 9,
  Musculoskeletal: 9,
  HEENT: 8,
  Reproductive: 8,
  Neurological: 7,
  Psychiatry: 7,
  Endocrine: 6,
  Dermatology: 5,
  Genitourinary: 5,
  Hematology: 4,
  'Infectious Disease': 4,
  Nephrology: 4,
  'Emergency Medicine': 2,
  General: 2,
};
```

- Sum = 100.
- Used by SessionService, dashboard stats, Rolling 360, and analytics.
- `NCCPABlueprintConfig` exists in the DB for versioned config, but runtime usage is via `lib/constants/blueprint.ts`.

---

## 3. Core PANCE Simulation — PARTIAL

### Primary path: `/api/questions/session` → SessionService

`lib/services/session/sessionService.ts`:

1. **Quota-based selection:** `calculateNCCPAQuotas(count, minSystems)` computes target counts per system from Blueprint percentages.
2. **Per-system fetch:** For each system, it requests `targetCount` questions via `fetchFromPool(system=X, count=targetCount)`.
3. **Blueprint-first:** Requested counts follow Blueprint, not pool sizes (e.g. ~11% Cardio, ~5% Derm regardless of how many Derm questions exist).

This design matches the audit requirement: sampling is driven by Blueprint quotas, not pool proportions.

### Risk: system name mismatch

- `calculateNCCPAQuotas` uses full names: `"Cardiovascular"`, `"Dermatology"`, etc.
- `PreGeneratedQuestion.system` is typically abbreviated: `"CV"`, `"DERM"` (e.g. from `regenerate-pool-v2.ts` and MedicalContent).
- `fetchFromPool` uses `where.system = "Cardiovascular"` → no rows if DB stores `"CV"`.
- Result: some systems can return 0 questions and fall back to seeds/main, weakening Blueprint adherence.

**Recommendation:** Map Blueprint names to DB aliases before querying (e.g. via `SYSTEM_ALIASES` or a reverse map).

---

## 4. Pool API path — RISK

### Secondary path: `/api/questions/pool`

Used by `questionService`, `intelligentQuestionService`, and other flows.

**Current flow:**

1. Fetch `count * 20` questions with no system filter: `where = {}`, `orderBy: { generatedAt: 'asc' }`.
2. Shuffle the result.
3. Call `selectByPanceDistribution(pool, count)` to pick by Blueprint weights.

**Issues:**

1. **Skewed initial fetch:** The first step returns the oldest `count * 20` questions by `generatedAt`. Composition depends on generation order, not Blueprint.
2. **Pool as ceiling:** `selectByPanceDistribution` samples from the fetched pool. If that pool has few Cardio questions, Blueprint quotas cannot be met.
3. **No inverse sampling:** The API does not “sample inversely to DB count.” It fetches a fixed number, then applies weights within that set. If DB has 500 Derm and 20 Cardio, a random 200-question fetch may have very few Cardio, and `selectByPanceDistribution` will exhaust Cardio and fill with Derm.

**Fix:** Either:

- Adopt quota-based fetching (like SessionService): for each system, fetch `targetCount` questions and then merge and shuffle, or
- Ensure the initial fetch is large and diverse enough that Blueprint quotas are achievable (e.g. stratified sampling by system).

---

## 5. Multiple Blueprint Sources — INCONSISTENCY

| Source | File | Keys | Dermatology |
|--------|------|------|-------------|
| Canonical | `lib/constants/blueprint.ts` | `Cardiovascular`, `Dermatology`, ... | 5% |
| Pool selection | `lib/poolSelection.ts` | `CV`, `DERM`, ... | 4% |
| Exam service | `services/domain/examService.ts` | Custom `NCCPA_BLUEPRINT_WEIGHTS` | — |
| Performance | `services/analytics/performanceService.ts` | `NCCPA_BLUEPRINT_WEIGHTS` | — |

`lib/poolSelection.ts` has its own `PANCE_SYSTEM_PERCENTAGES` (abbreviations, slightly different values). Pool-based selection may diverge from `lib/constants/blueprint.ts`.

**Recommendation:** Use `lib/constants/blueprint.ts` as the single source. Map to abbreviations where needed and remove duplicate Blueprint definitions.

---

## 6. Inverse sampling verification

### What “inverse sampling” means here

We want the session distribution to match Blueprint regardless of DB counts. For example:

- Blueprint: Cardio 11%, Derm 5%.
- DB: 200 Cardio, 500 Derm.
- For a 20-question session: ~2 Cardio, ~1 Derm.
- Naive random: ~3 Derm, ~1 Cardio (driven by 500 vs 200).

### SessionService (quota-based)

- Requests 2 Cardio, 1 Derm by design.
- Does not over-sample Derm just because there are more Derm questions.
- Inverse sampling is achieved.

### Pool API (pool-then-weight)

- Fetches a batch from the whole pool.
- Then weights by Blueprint within that batch.
- If the batch under-represents Cardio (e.g. due to `orderBy` or random skew), Blueprint targets cannot be met.
- Inverse sampling is not guaranteed.

---

## 7. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Blueprint percentages defined | ✅ | `lib/constants/blueprint.ts` |
| DB stores Blueprint config | ✅ | `NCCPABlueprintConfig` (JSON weights) |
| Session API uses Blueprint quotas | ✅ | `calculateNCCPAQuotas` + per-system fetch |
| Pool API uses Blueprint | ⚠️ | `selectByPanceDistribution` but after skewed fetch |
| Inverse sampling (Session API) | ✅ | Quota-based, independent of pool size |
| Inverse sampling (Pool API) | ❌ | Limited by initial fetch composition |
| System name consistency | ⚠️ | Full names vs abbreviations (CV vs Cardiovascular) |
| Single Blueprint source | ❌ | Multiple definitions in codebase |

---

## 8. Recommendations

1. **System name normalization:** When querying by system, map Blueprint names to DB values (e.g. Cardiovascular → CV) so `fetchFromPool` returns questions for all systems.
2. **Align Pool API with Blueprint:** Switch to quota-based fetching (or stratified sampling) so the Pool API respects Blueprint regardless of pool composition.
3. **Consolidate Blueprint sources:** Use `lib/constants/blueprint.ts` everywhere. Deprecate `PANCE_SYSTEM_PERCENTAGES` and other duplicates.
4. **Tests:** Add tests that simulate skewed pools (e.g. 500 Derm, 50 Cardio) and assert session distribution approximates Blueprint.

---

## 9. References

- Blueprint constants: `lib/constants/blueprint.ts`
- Session generation: `lib/services/session/sessionService.ts`
- Pool selection: `lib/poolSelection.ts`, `functions/api/questions/pool.ts`
- Main session flow: `services/core/mainSessionService.ts` → `/api/questions/session`
- Pool flow: `services/questionService.ts`, `services/ai/intelligentQuestionService.ts` → `/api/questions/pool`
