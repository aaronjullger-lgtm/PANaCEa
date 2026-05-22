# Adaptive Learning Pipeline Audit

Date: 2026-05-02

Readiness: **66/100 (D)**. Attempts and FSRS reviews are real, but the pipeline has multiple submit paths and some progress signals are not reliably connected to readiness, planning, and recommendations.

## Current Pipeline Findings

| Area | Grade | Evidence | Problem | Fix |
|---|---:|---|---|---|
| Attempt scoring | 78 C | `functions/api/questions/attempt.ts`, `lib/services/drillReviewService.ts` | Correctness is deterministic, but submit paths differ | Route all learner attempts through canonical submit service |
| Idempotency | 80 B | `drillReviewService.ts` recent-attempt reuse | Strong baseline | Preserve while making progress transactional |
| Progress update | 67 D | `lib/services/userProgressService.ts` | Failure can be swallowed after review log/attempt | Transactional write or retry queue |
| Weakness detection | 64 D | `rolling360Service.ts`, `UserProgress` | Recency/confidence/difficulty weighting limited | Weighted weakness model |
| Readiness projection | 65 D | `functions/api/analytics/readiness-projection.ts` | System attribution not consistently written | Persist system/blueprint on every progress update |
| Dashboard recommendation | 68 D | `lib/recommendationEngine.ts`, `lib/services/recommendationService.ts` | Two engines with different assumptions | Single traceable recommendation model |

## Broken Pipeline Stages

| Stage | Status | Evidence | Required Test |
|---|---|---|---|
| Attempt to Rolling360 | Confirmed risk | `questions/attempt.ts` does not update Rolling360; `submitDrillReview` can skip when reusing recent attempt | Dual-submit regression test |
| Attempt to UserProgress | Confirmed risk | Nonfatal progress failure paths | Transaction failure test |
| Progress to readiness | Confirmed risk | `UserProgress.system` read by readiness but not always written | System attribution test |
| FSRS to due reviews | Revised/fixed slice | stale interval after modifiers fixed in `drillReviewService.ts` and `fsrsScheduleService.ts` | Added focused tests |
| Due reviews to plan | Partial | `dailyStudyAllocatorService.ts` uses due progress | Simulation with due/overdue items |
| Plan to dashboard | Partial | Mixed recommendation services | Trace test showing signal origin |

## Recommended Calculation Model

- Use a per-user `LearningStateSnapshot` assembled from attempts, review logs, progress rows, due review counts, exam date, rotation, study preferences, and plan completion.
- Compute weakness with recency, accuracy, difficulty, confidence calibration, and overdue load.
- Write recommendations with a reason trace: signal, source table, score contribution, and timestamp.
