# Sprint 3 Report: Blueprint-Enforced Question Generation

**Date:** 2026-04-06
**Scope:** Main session blueprint enforcement, EOR lane separation, low-volume generation triggers

---

## Problem Statement

Main study sessions were not consistently PANCE-blueprint distributed. When a `system` parameter was passed (e.g., from a rotation focus card), the session bypassed `fetchMultiSystemSession` and used `fetchSimpleSession` instead, producing system-biased sessions. This meant the main session was not a pure representation of PANCE-readiness over time. Additionally, EOR/rotation prep shared the same code path as main sessions, and there was no automated mechanism to generate questions for under-represented blueprint systems.

## Architecture: Three-Layer Blueprint Enforcement

### Layer 1: Session Selector (`sessionService.ts`)

**New field: `sessionLane: 'main' | 'eor' | 'drill'`** on `SessionQuestionRequest`.

- **`sessionLane: 'main'`** — The `system` and `conditionId` parameters are ignored. The request is forced through `fetchMultiSystemSession` which distributes questions according to `NCCPA_2025_BLUEPRINT_PERCENT`. This ensures main sessions always reflect true PANCE distribution, regardless of what the student is currently studying.

- **`sessionLane: 'eor'`** — Routes through `fetchSimpleSession` with `eorMode: true` and preserves the original `system` parameter for rotation-specific filtering. This creates a clean separation: EOR prep is rotation-tailored; main sessions are blueprint-pure.

- **Omitted / `'drill'`** — Legacy behavior preserved. System filtering works as before for drills and custom study modes.

**Derivation logic** in API endpoints (`questions/session.ts`):
- If `eorMode` is true → `'eor'`
- If no system filter or `simulationStrict` → `'main'`
- If explicit system filter without EOR → legacy (no lane)

### Layer 2: Reservoir Refill (`refillWorker.ts`)

Phase 2 (New Cards from Pool) now uses **blueprint-weighted distribution** when the scope is global (main session refills):

- Calculates per-system quotas proportional to `NCCPA_2025_BLUEPRINT_PERCENT`
- For each blueprint system, fetches candidates filtered by that system's DB abbreviation
- Applies existing phase-aware Bloom's ordering and quality gates per-system
- System-specific scopes (e.g., `system:CV` for EOR) retain the original direct-filter behavior

This means the warm buffer for main sessions will contain questions distributed across all 15 organ systems in proportion to PANCE weights.

### Layer 3: Blueprint Gap Analyzer (`blueprintGapAnalyzer.ts`)

**New module** integrated into the cron maintenance job (runs every 2h):

1. **`analyzeBlueprintGaps(prisma)`** — Counts unused questions per system in the pool, compares against expected NCCPA-weighted share. A system is "gapped" if its share is < 50% of its expected blueprint proportion (or if total pool is critically low and system has < 10 questions).

2. **`analyzeAndTriggerGeneration(prisma, env)`** — Runs gap analysis, then dynamically imports `batchGeneratorService.generateBatchForSystem()` for each gapped system (up to 25 questions per system per cycle). Uses dynamic import to avoid Edge-bundling the Node-only Gemini SDK.

**Cron integration** (`reservoir-maintenance.ts`): New Step 5 (between refills and MV refresh). Gap analysis results are included in both the audit log and the API response for monitoring.

## Files Changed

| File | Change |
|------|--------|
| `lib/services/session/sessionService.ts` | Added `sessionLane` to `SessionQuestionRequest`; main lane forces blueprint routing |
| `lib/services/reservoir/refillWorker.ts` | Blueprint-weighted Phase 2 for global scope; imports `NCCPA_2025_BLUEPRINT_PERCENT` |
| `lib/services/reservoir/blueprintGapAnalyzer.ts` | **New file** — gap detection + Gemini generation trigger |
| `lib/services/reservoir/index.ts` | Exports new analyzer module |
| `functions/api/cron/reservoir-maintenance.ts` | Step 5: blueprint gap analysis + generation |
| `functions/api/questions/session.ts` | `sessionLane` in GET/POST schemas + derivation logic |
| `functions/api/study/session/generate.ts` | `sessionLane` + `eorDeadline` in schema |

## Files NOT Changed (intentional)

- `components/session/QuizView.tsx` — Frontend doesn't need changes; the lane derivation happens server-side based on existing request parameters.
- `services/ai/batchGeneratorService.ts` — Existing generation logic is reused as-is.
- `lib/constants/blueprint.ts` — Single source of truth, unchanged.

## Verification

- **Syntax check:** All 7 changed files pass TypeScript transpile (no errors)
- **Reservoir tests:** 32/32 passing
- **Confidence + FSRS tests:** 182/182 passing (10 test files)
- **Pre-existing failures:** `drillReviewService.test.ts` has 1 pre-existing mock mismatch from Sprint 2 (unrelated to Sprint 3 changes)
- **Full typecheck/build:** Requires CI (sandbox OOM on `tsc --noEmit` — pre-existing)

## Data Flow Summary

```
Client requests session
  → POST /api/questions/session
    → derives sessionLane ('main' if no system filter)
      → SessionService.getSessionQuestions({ sessionLane: 'main' })
        → IGNORES system param
        → fetchMultiSystemSession()
          → calculateNCCPAQuotas() → blueprint-proportional distribution
          → fetches from pool/seeds/main per system quota

Meanwhile, every 2 hours:
  → POST /api/cron/reservoir-maintenance
    → Step 4: triggerRefillsForLowUsers() → refillWorker
      → Phase 2: blueprint-weighted new card selection (global scope)
    → Step 5: analyzeAndTriggerGeneration()
      → counts unused pool per system vs NCCPA weights
      → triggers Gemini batch generation for under-represented systems

EOR sessions:
  → POST /api/questions/session { eorMode: true, system: 'NEURO' }
    → sessionLane: 'eor'
    → fetchSimpleSession() with system filtering (rotation-specific)
```
