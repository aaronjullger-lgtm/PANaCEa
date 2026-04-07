# Repo Context Summary
**Project:** PANaCEa (studyPANaCEa.com)
**Current Task:** Plan implementation for:
Add error boundary component to DrillShell.tsx

Provide step-by-step plan, dependencies, risk analysis, and architecture review.
**Branch:** main

## Architecture (from CLAUDE.md)
# PANaCEa — Claude Code Context

**Site:** studyPANaCEa.com | **Repo:** github.com/aaronjullger-lgtm/PANaCEa

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Cloudflare Pages Functions (Edge) — `functions/api/`
- **Database:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`)
- **Auth:** Clerk (`@clerk/clerk-react` + `@clerk/backend`)
- **AI:** Google Gemini (question gen, Ghost Grader, OSCE sim)
- **Deployment:** Cloudflare Pages + Functions; CI via GitHub Actions

## Architecture Rules
- **Production API:** Cloudflare Edge Functions in `functions/api/`. `routes/` is Express for local dev ONLY — never deployed.
- **Prisma Edge client:** `functions/api/_shared/prisma-edge.ts` (singleton). Always call `safePrismaDisconnect(prisma)` in `finally` blocks.
- **Auth:** `authenticatedEndpoint` middleware in `functions/api/_shared/auth.ts`. No raw `process.env` in Edge — use `context.env.*`.

## FSRS Pipeline (core differentiator)
- `lib/fsrs.ts` — FSRS v6, 21 params, binary rating: Again/Good only (Hard/Easy deprecated).
- `lib/implicit-metrics.ts` — Derives rating from behavior: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`, `parTimeMs`, `hintViewed`. No self-rated buttons.
- `lib/services/drillReviewService.ts` — Main submission pipeline: correctness → implicit rating → par time → circadian → FSRS update → QuestionAttempt → UserProgress → confusion pairs.
- `functions/api/drills/submit-review.ts` — API endpoint. Only `review_type: 'real'` MAIN and DRILL sessions update FSRS; Cram/rapid_recall excluded.
- **Rapid-guess filter:** MVRT thresholds by type (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms). Below threshold skips FSRS update.
- **Confidence pipeline (8-step):** Bayesian accumulation → calibration dampener → fatigue → interference → fluency illusion dampener → graduated stability multiplier → desirable difficulty bonus → cross-session trend. Key files: `lib/confidence/bayesianAccumulator.ts`, `lib/services/calibrationService.ts`, `lib/confidence/desirableDifficultyBonus.ts`, `lib/confidence/interferenceDetector.ts`, `lib/confidence/trendDetector.ts`.
- **254 tests passing** across confidence pipeline + FSRS subsystems.

## Session & Drill Submission Flow
1. Client collects telemetry → POST `/api/drills/submit-review` (questionId, selectedAnswer, telemetry)
2. Server: correctness → implicit rating → par time → circadian → FSRS → writes QuestionAttempt + ReviewLog + UserProgress
3. Returns: isCorrect, rating, stability, difficulty, nextReview, retrievability
- All 11 drill hooks use `useDrillFSRS` → `/api/drills/submit-review` with `sessionType: 'drill'`
- `QuizView.tsx` (main session) uses `syncManager.queueAnswer()` → `/api/questions/attempt`

## Proactive Question Reservoir
Background queue (per-student) ensuring no wait during sessions. States: queued → reserved → consumed → expired → failed.
- Policy: LOW_WATER=15, HIGH_WATER=40, BATCH=25, TTL=48h. Priority: OVERDUE_

... [truncated]

## Git Status
```
M .github/workflows/ci.yml
 M .github/workflows/deploy.yml
 M components/charts/SafeChart.tsx
 M components/dashboard/DashboardPage.tsx
 M components/dashboard/RecommendationFeed.tsx
 M components/dashboard/ReviewCalendar.tsx
 M components/dashboard/StudyActionCard.tsx
 M components/dashboard/TimeBoxButtons.tsx
 M components/dashboard/WelcomeBackCard.tsx
 M components/drill/DermDrillSession.tsx
 M components/drill/ECGDrillSession.tsx
 M components/drill/ImagingDrillSession.tsx
 M components/drill/MetacognitionPromptModal.tsx
 M components/error/NotFoundPage.tsx
 M components/layout/AppLayout.tsx
 M components/layout/DrillViewRouter.tsx
 M components/layout/NavRail.tsx
 M components/layout/SidebarItem.tsx
 M components/library/ClinicalReferenceLibrary.tsx
 M components/library/EnhancedConditionCard.tsx
 M components/loading/index.tsx
 M components/modes/PatientEncounterMode.tsx
 M components/modes/osce/ScoreReport.tsx
 M components/navigation/CommandCenterHub.tsx
 M components/navigation/CommandPalette.tsx
 M components/navigation/hub/CoreAdaptiveHero.tsx
 M components/navigation/hub/GrandRoundsBanner.tsx
 M components/navigation/hub/QuickStatsBar.tsx
 M components/quiz/AnswerChoice.tsx
 M components/quiz/QuizLabCalcModal.tsx
 M components/session/AnswerFeedback.tsx
 M components/session/QuizToolbar.tsx
 M components/session/QuizView.tsx
 M components/ui/DefinitionTooltip.tsx
 M components/ui/Modal.tsx
 M config/AppRoutes.tsx
 M config/appViews.ts
 M config/lazyComponents.tsx
 M config/navigation.ts
 M config/routes.ts
 M config/training-modes.ts
 M contexts/ToastContext.tsx
 M functions/api/_shared/aiQuestionService.ts
 M functions/api/_shared/analyzeBehaviorGemini.ts
 M functions/api/_shared/auditLog.ts
 M functions/api/_shared/middleware.ts
 M functions/api/_shared/schemas.ts
 M functions/api/_shared/semantic-cache.ts
 M functions/api/_shared/staging-questions.ts
 M functions/api/admin/audit/logs.ts
 M functions/api/admin/blueprint-coverage.ts
 M functions/api/admin/content/[id].ts
 M functions/api/admin/content/create.ts
 M functions/api/admin/content/list.ts
 M functions/api/admin/content/transition.ts
 M functions/api/admin/generate-draft.ts
 M functions/api/admin/health-report.ts
 M functions/api/admin/health/reports.ts
 M functions/api/admin/knowledge/ingest.ts
 M functions/api/admin/pool-health.ts
 M functions/api/admin/question-review.ts
 M functions/api/admin/reservoir-health.ts
 M functions/api/admin/staging/list.ts
 M functions/api/ai/generate-mnemonic.ts
 M functions/api/authors/submit-question.ts
 M functions/api/conditions/[identifier]/structured.ts
 M functions/api/content/library.ts
 M functions/api/cron/push-reminders.ts
 M functions/api/drills/contrastive/generate.ts
 M functions/api/drills/submit-review.ts
 M functions/api/drills/teachback/grade.ts
 M functions/api/gemini/index.ts
 M functions/api/gemini/stream.ts
 M functions/api/knowledge/cache.ts
 M functions/api/library/answer.ts
 M functions/api/questions/attempt.ts
 M functions/api/questions/context.ts
 M functions/api/questions/fetch.ts
 M functions/api/questions/generate-deep.ts
 M functions/api/questions/pool.ts
 M functions/api/questions/record.ts
 M functions/api/srs/submit.ts
 M functions/api/study-path/debug.ts
 M functions/api/study/calibration-insights.ts
 M functions/api/study/chat.ts
 M functions/api/user/fsrs-params.ts
 M functions/api/user/progress-map.ts
 M functions/api/user/review-history.ts
 M functions/api/user/update-fsrs-params.ts
 M functions/cache-warmer.ts
 M hooks/useAppNavigation.ts
 M hooks/useDrillFSRS.ts
 M hooks/useFSRSOptimizationCheck.ts
 M hooks/useNavRailContext.ts
 M hooks/useQuizSessionRecovery.ts
 M hooks/useSRSItems.ts
 M hooks/useSemanticSearch.ts
 M hooks/useSessionGenerator.ts
 M hooks/useSessionWellness.ts
 M lib/chartTheme.tsx
 M lib/dashboard/derivedMetrics.ts
 M lib/gemini.ts
 M lib/services/calibrationService.ts
 M lib/services/dashboardPersonalization.ts
 M lib/services/drillReviewService.ts
 M lib/services/fsrsOptimizerService.ts
 M lib/services/fsrsScheduleService.ts
 M lib/services/reservoir/refillWorker.ts
 M lib/services/retrievabilityCalibrationService.ts
 M lib/services/semanticValidationService.ts
 M lib/services/session/sessionService.ts
 M lib/services/soapGradingService.ts
 M lib/services/sync/syncManager.ts
 M lib/services/userProgressService.ts
 M lib/services/wellnessEngine.ts
 M lib/toast.ts
 M lib/utils/accessibilityUtils.ts
 M lib/validation/zodSchemas.ts
 M package-lock.json
 M package.json
 M prisma/schema.prisma
 M services/ai/automatedContentPipeline.ts
 M services/ai/contextAwareOrchestrator.ts
 M services/client/questionApi.ts
 M services/core/CoachingService.ts
 M services/core/stagingQuestionService.ts
 M services/domain/clinicalPearlService.ts
 M services/domain/educationalResourceService.ts
 M services/domain/geminiService.ts
 M services/domain/imageQualityService.ts
 M tests/drillReviewService.test.ts
 M tests/syncManager.test.ts
 M tests/useDrillFSRS.test.ts
 M types/telemetry.ts
?? -
?? .claude/commands/
?? .claude/multi-agent/
?? .claude/skills/SKILL-ROUTING-QUICK.md
?? .claude/skills/trigger-eval.json
?? "COMPLETE AUDIT.rtf"
?? PANaCEa_Architecture_Audit_Report.docx
?? PANaCEa_Implementation_Plan.docx
?? PANaCEa_Implementation_Plan.md
?? SDK-PLAN.md
?? _test_write
?? components/auth/AuthenticatedRoute.tsx
?? components/drill/DrillSummaryCard.test.ts
?? components/drill/DrillSummaryCard.tsx
?? components/session/A11Y_CHECKLIST.md
?? components/session/BreakTimer.tsx
?? components/session/FatigueBreakPrompt.tsx
?? components/ui/ProvenanceBadge.tsx
?? design-md/
?? docs/DEBUGGING_FSRS_PIPELINE.md
?? docs/research/fsrs-optimizer-best-practices.md
?? docs/research/sr-calibration-methodology.md
?? functions/api/_shared/__tests__/cms-middleware.test.ts
?? functions/api/_shared/requestLogger.ts
?? functions/api/_shared/structuredLogger.ts
?? hooks/useStudyWellness.test.ts
?? lib/calibration/
?? lib/dashboard/__tests__/
?? lib/observability/
?? lib/sdk/
?? lib/services/questionReviewGate.ts
?? lib/stores/
?? prisma/migrations/20260403100000_phase1_brin_indexes_and_provenance/
?? scripts/check-bundle-size.mjs
?? tests/drillPipeline.integration.test.ts
?? tests/helpers/
?? tests/routeRegistry.test.ts
?? tests/useDrillFSRS-offline-fallback.test.ts
?? tests/userProgressService.test.ts
```

## Recent Commits
```
4725286d fix: correct MODES_WITH_DEDICATED_ROUTES filter to match mode ID instead of route path
664c49b6 fix: UI polish, auth alignment, condition resolution, library dedup
e1b0d666 feat: UI primitives, service layer tests, routing cleanup, session gen
e8911031 fix: remove [build] section from wrangler.toml (unsupported by Pages)
ad0fbee1 chore: Node 22 upgrade, Prisma 7.6, vendor chunk split, import cleanup
```

## Changed Files
```
(none)
```