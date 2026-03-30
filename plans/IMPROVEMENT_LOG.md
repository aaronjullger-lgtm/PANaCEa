# PANaCEa Improvement Log

Tracks daily improvements made by the automated improvement pipeline.

---

## 2026-03-30 — Phase 1 Complete: Universal FSRS Pipeline

### What was done
Completed the entire Phase 1 of the improvement plan in a single session. All 12 drill hooks now submit to the FSRS pipeline through a shared `useDrillFSRS` hook, up from just 1 (which was broken).

### Day 1: Foundation
- **Created** `hooks/useDrillFSRS.ts` (296 lines) — shared hook for telemetry + FSRS submission
- **Modified** `functions/api/drills/submit-review.ts` — added `'drill'` to sessionType enum
- **Modified** `lib/services/drillReviewService.ts` — added `'drill'` type to interface
- **Modified** `prisma/schema.prisma` — added `DRILL` to `SessionType` enum

### Day 2: First 3 drills
- **Modified** `hooks/game/use-condition-drill.ts` — FIXED: replaced raw fetch (no sessionType → contaminated as 'main') with useDrillFSRS
- **Modified** `hooks/game/use-pharm-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-ddx-drill.ts` — NEW FSRS integration

### Day 3: Next 4 drills
- **Modified** `hooks/game/use-anatomy-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-first-line-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-photo-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-mini-lab-drill.ts` — NEW FSRS integration

### Day 4: Next 4 drills
- **Modified** `hooks/game/use-physiology-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-guideline-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-ventilator-drill.ts` — NEW FSRS integration
- **Modified** `hooks/game/use-polypharmacy-drill.ts` — NEW FSRS integration

### Day 5: Final drill
- **Modified** `hooks/game/use-contrastive-drill.ts` — NEW FSRS integration

### Before → After
| Metric | Before | After |
|--------|--------|-------|
| Drill hooks submitting to FSRS | 1 (broken — no sessionType) | 12 (all with sessionType='drill') |
| Components submitting to FSRS | 3 total (QuizView, SmartReview, condition drill) | 14 total |
| sessionType enum | ['main', 'cram', 'rapid_recall'] | ['main', 'drill', 'cram', 'rapid_recall'] |
| FSRS contamination from drills | YES (defaulted to 'main') | NO (tagged as 'drill') |

### Issues encountered
- Sandbox can't run `tsc --noEmit` (OOMs) or `npm test` (missing rollup native module) — typecheck/test must be done locally
- Prisma schema change (`DRILL` enum) will need a migration before deploy: `npx prisma migrate dev --name add-drill-session-type`

### Next priority
- **Phase 2, Day 6:** Add FSRS feedback display to `EnhancedFeedbackPanel` (show stability, next review date)
- **Phase 2, Day 7:** Behavioral data hygiene — duration cap at 60s, exclude flagged reviews from optimizer
- Then: structured explanations, DrillShell migration, QuizView decomposition
