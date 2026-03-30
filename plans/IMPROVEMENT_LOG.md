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

---

## 2026-03-30 — Phase 2 Complete: Feedback, Data Hygiene, OSCE Hardening

### Day 6: FSRS feedback in drill panels
- **Modified** `hooks/useDrillFSRS.ts` — added `lastFSRSResponse` state + `fsrsNextReview` computed property
- **Modified** 9 drill hooks — exposed `fsrsNextReview` from return interface
- **Modified** 8 drill session components — pass `nextReview={fsrsNextReview}` to EnhancedFeedbackPanel
- **Result:** Learners now see stability, difficulty, interval days, and next review date after each drill answer

### Day 7: Behavioral data hygiene
- **Modified** `lib/implicit-metrics.ts` — added `DURATION_CAP_MS = 60000` (60s cap), applied to `deriveContinuousRating`
- **Modified** `lib/services/drillReviewService.ts` — capped ReviewLog.responseTimeMs, preserved raw in QuestionAttempt, added flagged/flag_reason/raw_duration_ms to telemetry JSON for outlier tracking

### Day 8: Structured explanations (verified — already working)
- **No changes needed** — QuizView already parses structured rationale (whyCorrect, whyIncorrectA/B/C/D) and ExplanationPanel renders both structured and legacy modes gracefully

### Day 9: OSCE AI prompt hardening
- **Modified** `services/ai/geminiService.ts` — strengthened lay-language instruction with concrete examples ("say 'it hurts in my chest' not 'substernal chest pain'"), added CRITICAL RULE for exam specificity (prevents data-dumping on "full physical exam")

### Database
- Migration `add_drill_session_type` applied to Supabase: `SessionType` enum now has `{MAIN, DRILL, CRAM, RAPID_RECALL}`

### Commits pushed
1. `d77d197b` — Phase 1: Universal FSRS pipeline (20 files)
2. `3235d5b3` — Phase 2: FSRS feedback + data hygiene (20 files)
3. `b5ef9fc7` — Phase 2: OSCE prompt hardening (1 file)

### Next priority
- **Phase 3:** DrillShell migration — wrap top 5 drills for consistent navigation
- **Phase 4:** QuizView decomposition — extract QuestionRenderer, PostAnswerFeedback
- **Phase 5:** Question data normalization + content backfill
- Daily task handles: accessibility fixes, empty states, dark mode consistency, test coverage

---

## 2026-03-30 — Phase 3 Complete: DrillShell Migration (Top 5 Drills)

### What was done
Migrated the 5 highest-priority drill session components to use the DrillShell wrapper for consistent breadcrumb navigation, back-to-hub functionality, and unified page structure. The active quiz experience (MiniDrillLayout) is preserved as-is for its immersive full-screen UX.

### Changes
- **Modified** `components/drill/PharmDrillSession.tsx` — Wrapped landing page and category menu in DrillShell; removed duplicate custom header from menu view
- **Modified** `components/drill/DDxDrillSession.tsx` — Wrapped landing page and completion view in DrillShell; completion view now uses standard breadcrumb navigation
- **Modified** `components/drill/ConditionDrillSession.tsx` — Wrapped category menu and completion view in DrillShell; removed duplicate custom headers from both views
- **Modified** `components/drill/AnatomyDrillSession.tsx` — Wrapped landing page in DrillShell
- **Modified** `components/drill/ECGDrillSession.tsx` — Wrapped landing page and summary view in DrillShell; removed custom exit button overlay

### Before → After
| Metric | Before | After |
|--------|--------|-------|
| Drill sessions using DrillShell | 1 (ContrastiveDrillSession only) | 6 (+ Pharm, DDx, Condition, Anatomy, ECG) |
| Drill views with breadcrumb nav | 3 (Contrastive's 3 views) | 14 (all non-quiz views across 6 drills) |
| Custom one-off header implementations | 5 (one per drill's menu/completion) | 0 (all replaced with DrillShell) |

### Architecture decision
- **DrillShell wraps non-quiz views** (landing, menu/category picker, completion/summary)
- **MiniDrillLayout stays for active quiz** — it's a full-screen immersive overlay (`fixed inset-0 z-50`) with its own header, which is the right UX for focused question-answering
- This matches the ContrastiveDrillSession reference pattern established earlier

### Next priority
- **Phase 4:** QuizView decomposition — extract QuestionRenderer, PostAnswerFeedback
- **Phase 5:** Question data normalization + content backfill
- **Remaining DrillShell migrations:** Photo, MiniLab, Physiology, Guideline, Ventilator, Polypharmacy, Imaging, Derm
- Daily task handles: accessibility fixes, empty states, dark mode consistency, test coverage
