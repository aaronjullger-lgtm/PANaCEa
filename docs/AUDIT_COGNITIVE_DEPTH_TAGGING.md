# Cognitive Depth Tagging Audit

**Date:** 2025-02-02  
**Scope:** Question cognitive-level tagging and normalized "Decision Speed" metrics

---

## 1. Audit Requirement

> Every card MUST have a cognitive_level tag to normalize "Decision Speed":
>
> | Level | Type | Examples | Target |
> |-------|------|----------|--------|
> | **Level 1 (Recall)** | Buzzwords, First-line treatments | "What is the dose of Amoxicillin?" | <20s |
> | **Level 2 (Concept)** | Pathophysiology, Mechanism of Action | Mechanism, MoA, basic science | <45s |
> | **Level 3 (Vignette/Analysis)** | "What is the next best step?" | Clinical vignettes | <75s |
>
> **Usage:** Normalize speed so we can tell the user: "Your Recall speed is elite, but your Vignette processing is slow."

---

## 2. Schema Support — PARTIAL

### CognitiveLevel enum

```prisma
enum CognitiveLevel {
  LEVEL_1_RECALL
  LEVEL_2_CONCEPT
  LEVEL_3_VIGNETTE
}
```

### Where it exists

| Model | cognitiveLevel field | Populated? | Used? |
|-------|----------------------|------------|-------|
| **Question** | ✅ `cognitiveLevel CognitiveLevel @default(LEVEL_1_RECALL)` | Default only; rarely set explicitly | ❌ No |
| **PreGeneratedQuestion** | ❌ None | — | — |
| **QuestionAttempt** | ❌ None | — | — |
| **ReviewLog** | ❌ None | — | — |

- `cognitiveLevel` exists only on the **Question** table.
- **PreGeneratedQuestion** (primary source for main sessions and many drills) has no cognitive-level field.
- **QuestionAttempt** does not store `cognitiveLevel`, so we cannot aggregate speed by cognitive level from attempt history.

---

## 3. Speed Benchmarks — MISALIGNED

### Current implementation (`lib/speedBenchmarks.ts`)

```typescript
export const RECALL_TARGET_SEC = 60;
export const CLINICAL_REASONING_TARGET_SEC = 90;
export const OVERALL_TARGET_SEC = 60;
```

### Audit targets vs current

| Cognitive level | Audit target | Current target | Gap |
|-----------------|--------------|----------------|-----|
| Level 1 (Recall) | <20s | 60s | 40s too generous |
| Level 2 (Concept) | <45s | — | No dedicated target |
| Level 3 (Vignette) | <75s | 90s | 15s too generous |

- Recall target (60s) is far above the audit recommendation (20s).
- No distinct target for Level 2 (Concept).
- Vignette target (90s) is slightly more permissive than 75s.

---

## 4. Speed-by-Type Logic — MODE-BASED, NOT COGNITIVE

### Current implementation (`functions/api/user/stats.ts`)

```typescript
// Speed by question type: Recall (rapid_recall) vs Clinical Reasoning (vignette/main)
const recallAttempts = recentAttempts.filter(
  (a) => a.mode === 'rapid_recall' && getTimeMs(a) > 0
);
const clinicalAttempts = recentAttempts.filter(
  (a) => a.mode !== 'rapid_recall' && getTimeMs(a) > 0
);
```

- **Recall** = attempts where `mode === 'rapid_recall'`.
- **Clinical reasoning** = all other modes (session, drill, review, etc.).

### Problem

- Cognitive level is inferred from **session mode**, not from the question itself.
- Main-session vignettes and main-session recall questions both fall into "clinical reasoning."
- A Level 1 recall question in a main session (e.g., "What is the dose of Amoxicillin?") is evaluated against the 90s vignette target instead of a 20s recall target.
- Conversely, a Level 3 vignette in Rapid Recall mode would be measured against the recall target.

---

## 5. Data Flow Gaps

### Main session questions

- Main sessions use **PreGeneratedQuestion** or similar sources.
- No `cognitiveLevel` is stored or passed.
- `QuestionAttempt` records `questionType` (vignette, recall, image, rapid_recall, unknown) but not `cognitiveLevel`.
- Stats aggregation does not use `questionType` or `cognitiveLevel` for speed.

### Drill questions

- Condition Drill, Smart Review, etc. use PreGeneratedQuestion or Question.
- `Question` has `cognitiveLevel` but it is optional and defaults to LEVEL_1_RECALL.
- There is no systematic classification of PreGeneratedQuestion by cognitive level.

### Telemetry / implicit metrics

- `deriveImplicitRating` and related logic use duration and correctness, not cognitive level.
- No normalization of "fast/slow" by cognitive level.

---

## 6. Current UI

- **AnalyticsDashboard** shows "Speed by question type" (Recall vs Clinical Reasoning) using mode-based buckets.
- **UserFriendlyStatsDisplay** shows overall avg time with `getSpeedBenchmarkLabel(overall.avgTimeMs)` — single target (60s).
- Overall "64s avg" is compared to 60s, without distinguishing question types.

---

## 7. Recommendations

### 1. Add `cognitiveLevel` to PreGeneratedQuestion and persist on attempt

- Add `cognitiveLevel CognitiveLevel?` to **PreGeneratedQuestion**.
- Add `cognitiveLevel CognitiveLevel?` to **QuestionAttempt** (or ensure it is derivable from the source question).
- When creating attempts, set `cognitiveLevel` from the question when available.

### 2. Align speed targets with audit

| Level | Target (sec) | Rationale |
|-------|--------------|-----------|
| Level 1 (Recall) | 20 | Buzzwords, first-line, dosing |
| Level 2 (Concept) | 45 | Pathophysiology, MoA |
| Level 3 (Vignette) | 75 | Clinical vignettes, next step |

Update `lib/speedBenchmarks.ts` and add per-level targets.

### 3. Aggregate speed by cognitive level

- In `/api/user/stats`, group attempts by `cognitiveLevel` (or by `questionType` if that maps cleanly).
- Return `speedByLevel: { recall: {...}, concept: {...}, vignette: {...} }`.
- Use the appropriate target per level for benchmarks.

### 4. Classify existing questions

- Backfill `Question.cognitiveLevel` based on content (vignette length, task type, tags).
- For PreGeneratedQuestion, infer or store cognitive level at generation time (prompt or post-processing).

### 5. UI copy

- Show per-level speed: "Recall: 18s (target <20s) · Concept: 42s (target <45s) · Vignette: 68s (target <75s)."
- Enable messages like: "Your recall speed is strong; vignette processing could improve."

---

## 8. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Every question has cognitive_level | ❌ No | Only Question has it; PreGeneratedQuestion does not; default only |
| QuestionAttempt stores cognitive level | ❌ No | Not persisted on attempt |
| Speed normalized by cognitive level | ❌ No | Uses mode (rapid_recall vs other) |
| Targets align with audit (20/45/75s) | ❌ No | Current: 60s recall, 90s clinical |
| UI shows level-specific speed | ⚠️ Partial | Recall vs Clinical, but mode-based and wrong targets |

---

## 9. References

- Schema: `prisma/schema.prisma` (CognitiveLevel enum, Question.cognitiveLevel)
- Benchmarks: `lib/speedBenchmarks.ts`
- Stats API: `functions/api/user/stats.ts` (speedByType)
- Analytics UI: `components/analytics/AnalyticsDashboard.tsx`
- Question types: `types/telemetry.ts` (QuestionType: vignette, recall, image, rapid_recall, unknown)
