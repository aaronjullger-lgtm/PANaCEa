# FSRS v6 Quick Reference (PANaCEa)

> ⚠️ **PANaCEa does NOT use the stock `ts-fsrs` 4-button API.** There are **no
> student-facing "Again / Hard / Good / Easy" rating buttons**. Confidence is
> **behaviorally derived** from implicit telemetry. Use the internal engine at
> `lib/fsrs.ts` — never `@open-spaced-repetition/ts-fsrs` directly in app code.
>
> A previous version of this doc contained stock `ts-fsrs` examples and an
> explicit-rating workflow. That was **incorrect for PANaCEa** and has been
> rewritten. See `docs/fsrs-current-state-and-hardening-report.md`.

---

## 1. The rating model is implicit (no buttons)

- Internal engine: **`lib/fsrs.ts`** (`class FSRS`, `Rating`, `FSRSState`,
  `defaultParameters`, `loadParametersSafely`, `normalizeRating`).
- **Binary rating only:** `Rating.Again = 1`, `Rating.Good = 3`. `Rating.Hard (2)`
  and `Rating.Easy (4)` are **deprecated** and collapsed by `normalizeRating()`
  (`Hard → Again`, `Easy → Good`). Do not reintroduce them in UI.
- The rating fed to FSRS is **derived from behavior**, not chosen by the student:
  - `lib/implicit-metrics.ts` → `deriveContinuousRating(...)` turns response
    latency, answer switches, hover oscillations, commitment gap, hint usage,
    etc. into a continuous grade (1.0–4.0), then maps it to the binary
    `Again`/`Good` used by the scheduler.
  - `lib/micro-kinetics.ts` and related collectors gather the raw telemetry.
  - `assessTelemetryQuality()` classifies each signal set as full / partial /
    minimal so low-quality (e.g. rapid-guess) reviews are handled appropriately.

```ts
// Correct: internal engine + behaviorally-derived rating.
import { FSRS, loadParametersSafely, normalizeRating } from '@/lib/fsrs';
import { deriveContinuousRating } from '@/lib/implicit-metrics';

const params = loadParametersSafely(personalizedParams); // safe fallback to defaults
const fsrs = new FSRS(params);

const { rating } = deriveContinuousRating(telemetry, /* config */); // implicit
const { card: nextCard, due } = fsrs.next(currentCard, new Date(), normalizeRating(rating));
```

## 2. Where review submission is wired (single source of truth)

```
Client question UI (behavioral telemetry only, NO rating buttons)
  → POST /api/drills/submit-review        (functions/api/drills/submit-review.ts)
  → lib/services/drillReviewService.ts
       • correctness check
       • deriveContinuousRating(telemetry)  → Again/Good           (lib/implicit-metrics.ts)
       • FSRS.next(card, now, rating)        → stability/difficulty/state/due   (lib/fsrs.ts)
       • createReviewLogEntry(...)           → ReviewLog row        (lib/services/reviewLogService.ts)
       • QuestionAttempt + UserProgress updates
  → { isCorrect, rating, stability, difficulty, nextReview, retrievability }
```

The main study session submits through the same service. **Do not** compute
scheduling on the client or ask the student to self-rate.

## 3. Parameter safety (CODE-001)

- `defaultParameters.w` is the canonical 21-weight v6 array.
- `isParamsOnCurrentScale(w)` requires **every** weight finite and `w[19]/w[20]`
  on the v6 scale; off-scale/malformed arrays are rejected.
- `loadParametersSafely(stored)` returns validated params or falls back to
  `defaultParameters` — so a corrupt/missing weight (e.g. `w[6]`, the difficulty
  mean-reversion rate) can never silently disable scheduling behavior.
- The `FSRS` constructor (`normalizeParameters`) repairs any non-finite required
  weight from defaults as defense-in-depth.

## 4. Session quarantine (data isolation)

Only real MAIN-loop reviews train the optimizer. `ReviewLog.review_type ∈
{'real','rapid_guess','cram','practice'}` with `sessionType` classification;
OSCE / cram / rapid-guess artifacts must never pollute `real` FSRS statistics.

```ts
// Optimizer / stats reads: real reviews only.
const reviews = await prisma.reviewLog.findMany({
  where: { userId, review_type: 'real' },
  orderBy: { reviewedAt: 'asc' },
});
```

All ReviewLog writes go through `createReviewLogEntry()` (validates DB CHECK
constraints and the `review_type` contract). Never write raw `reviewLog.create`
in new code.

## 5. Optimizer

Personalized weights are fit via `POST /api/user/fsrs-params` (in-process TypeScript
or Python sidecar when `FSRS_OPTIMIZER_URL` is set). See `functions/api/user/fsrs-params.ts`.
The **Python optimizer** (`gcp-fsrs-optimizer/`) is also invoked via
`lib/services/fsrsOptimizerService.ts` / `lib/fsrs-optimizer-bridge.ts`.
v6 = 21 weights; v7-alpha (29 weights) is an experimental, default-off placeholder
(`lib/fsrs-v7.ts`, `lib/fsrs-version-selector.ts`).

## 6. Anti-patterns

- ❌ Rendering "Again / Hard / Good / Easy" buttons for students.
- ❌ Importing `@open-spaced-repetition/ts-fsrs` in app code (use `@/lib/fsrs`).
- ❌ `new PrismaClient()` in a handler (use the edge singleton / `createEdgePrismaClient`).
- ❌ Writing `reviewLog.create` directly (use `createReviewLogEntry`).
- ❌ Including non-`real` reviews in optimizer/statistics queries.

## References
- Engine: `lib/fsrs.ts` · Implicit rating: `lib/implicit-metrics.ts`, `lib/micro-kinetics.ts`
- Submission: `lib/services/drillReviewService.ts`, `functions/api/drills/submit-review.ts`
- FSRS params API: `functions/api/user/fsrs-params.ts` (`GET` retrieve, `POST` optimize)
- ReviewLog: `lib/services/reviewLogService.ts` · Optimizer: `gcp-fsrs-optimizer/`
- State report: `docs/fsrs-current-state-and-hardening-report.md`

---
**Status:** current · **Rating model:** implicit / behaviorally derived · **No self-rating buttons.**
