# File Claims

Active file locks. Claims auto-expire after 4 hours of inactivity.

| Timestamp | Skill | Files | Task |
|-----------|-------|-------|------|
| (none active) | | | |

## Claim / Release Rules

- **Claim:** Add a row before dispatching an agent. Include timestamp, skill name, file list, and task summary.
- **Release:** Remove the row when the agent hands off or the claim expires.
- **Conflict:** If a new agent needs files already claimed, wait or reassign.

## Sprint 1-3 Completion Log (2026-08-02)

All claims released — Sprint 1 (F-05, F-02), Sprint 2 (F-03, F-04, F-01), Sprint 3 (F-08, F-09, F-07, F-12, F-06) completed and verified:

| Fix | Files | Verified |
|-----|-------|----------|
| F-05 clamp | `lib/services/drillReviewService.ts` | 53/53 drill tests |
| F-02 3-tier optimizer | `lib/services/fsrsOptimizerService.ts` + `.test.ts` | 34/34 optimizer tests |
| F-03 MSEP | `lib/services/calibrationService.ts` | 36/36 calibration tests |
| F-04 time-weighting | `lib/services/calibrationService.ts` | 36/36 calibration tests |
| F-01 reserved CONF_* | `lib/services/gradeModulationCoordinator.ts` | 51/51 grade-mod tests (+61 behavioral) |
| F-08 trust ramp | `lib/services/drillReviewService.ts` | 53/53 drill tests |
| F-09 validation script | `scripts/validate-confidence-pipeline.ts` | aligned with new metrics |
| F-07 modifier telemetry | `lib/services/drillReviewService.ts` | 53/53 drill tests |
| F-12 verify rolling window | `docs/audits/...` (deferral documented) | read/write not wired — Phase 1.3 |
| F-06 convention doc | `docs/research/FSRS6DeepResearch.md` | doc-only |

## Current Conflicts (None)

- F-12 Phase 1.3 wiring (rolling-window persistence) is the next scheduled work touching `drillReviewService.ts` + `functions/api/performance/record.ts` — claim both before dispatching.
