# UNFINISHED_WORK_MASTER_AUDIT

Generated date: 2026-04-16  
Scope reviewed: `docs/**`, `plans/**`, `deployment/**`, `.cursor/**`, `.claude/**`, `README.md`, `package.json`, `.github/workflows/**`, `components/**`, `hooks/**`, `lib/**`, `services/**`, `functions/**`, `prisma/**`, `scripts/**`, `tests/**`, `e2e/**`, plus repo-wide `TODO` / `FIXME` / `HACK` / `deprecated` / `placeholder` searches. Roughly 5,073 markdown files were scanned by filename/keyword in the documentation scope, 33 high-signal planning/audit docs were reviewed in detail, and about 2,600 implementation/workflow files were searched in the code scope.  
Caveats:
- Documentation was treated as a set of claims, not as source-of-truth status.
- Older “complete” or “production-ready” docs are frequently stale and sometimes directly contradicted by current code.
- Repo-native static audits were used as evidence: `npm run audit:zod`, `npm run audit:prisma`, and `npm run audit:services`. These are useful but not perfect; they include some helpers/tests and some false positives.
- Historical and archive-style docs were not treated as active obligations unless newer docs or current code still pointed to the same work.

## 1. Executive Summary

This pass found heavy documentation drift: many older audits and sprint notes still describe already-fixed gaps, while a smaller set of meaningful rollout, cleanup, and ops items remain genuinely unfinished.

Roughly 40 concrete work items were extracted from the reviewed docs and deduplicated into 28 normalized themes.

- Completed: 7
- Partial / in progress: 10
- Untouched / scaffold only: 5
- Obsolete / superseded: 6
- Unclear / needs manual verification: 0

Highest-signal unfinished work right now:
- API validation hardening is still incomplete across a large portion of `functions/api/**`.
- The Express-to-Edge migration is functionally far along, but legacy Express routes and dev-server surface area still remain.
- Push notifications have core plumbing, but reminder scheduling, delivery auditing, and runtime ownership are not finished.
- Study groups/social remain schema-plus-UI scaffolding with no Cloudflare API implementation and are intentionally hidden.
- Mainline FSRS is much healthier than older audits suggest, but deprecated SRS compatibility endpoints still exist.
- The library enrichment pipeline exists, but its admin/runtime rollout is incomplete.

## 2. Methodology

This audit reconciled docs against code in four steps:

1. Discover documentation that made implementation claims.
   - Audit reports, sprint plans, remediation docs, roadmaps, strategy docs, automation docs, and completion summaries were scanned.

2. Normalize only actionable work.
   - Vague aspirations were excluded unless they mapped to a concrete repo surface.
   - Duplicate phrasing across multiple docs was collapsed into one normalized work item.

3. Treat docs as claims and verify against code.
   - Current implementation evidence came from routes, components, hooks, services, workflows, scripts, schema/migrations, and tests.
   - Newer docs were allowed to supersede older ones when they clearly corrected stale findings.

4. Separate true backlog from stale backlog pollution.
   - Historical docs were not allowed to create present-day obligations on their own.
   - “Completed but still documented as pending” items were captured explicitly so they are not re-opened later.

Additional repo-native evidence used during reconciliation:
- `npm run audit:zod` on 2026-04-16 reported `38 PASS`, `8 WARN`, `145 FAIL`.
- `npm run audit:prisma` on 2026-04-16 reported `323 PASS`, `18 FAIL`.
- `npm run audit:services` still recommends service-layer consolidation and flags duplicate/deprecated service organization themes.

## 3. Source Documents Reviewed

Most influential documents reviewed in detail:

- `docs/AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION_2026.md` — broad post-implementation gap list; useful, but several findings are now overtaken.
- `docs/AUDIT_POST_IMPLEMENTATION_2026.md` — supporting post-implementation reconciliation notes.
- `docs/COMPREHENSIVE_REPO_AUDIT_2026.md` — high-level repo audit with major strategic gaps and some now-completed items.
- `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md` — one of the clearest repo-vs-code mismatch docs; still accurate on several hidden/scaffolded features.
- `docs/PRODUCTION_READINESS_MASTER_PLAN.md` — large backlog source for readiness and operational rollout items.
- `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md` — broad consolidated backlog; partly stale, still useful for unresolved systems.
- `docs/QUESTION_GENERATION_IMPROVEMENT_PLAN.md` — helpful for tracing question-system work; several “pending” items are already implemented.
- `docs/QUESTION_SYSTEM_IMPROVEMENTS.md` — newer counterpart that confirms parts of the question-quality work are already done.
- `docs/strategy/PANaCEa-Feature-Strategy-2026-Q2.md` — important because it mixes implemented, underexploited, and future features; not every “next” item is actually unbuilt.
- `docs/audits/AUDIT-2026-04-06.md` — current-feeling audit, but several headline findings are already corrected in code.
- `docs/audits/AUDIT_CORRECTIONS.md` — useful correction sheet for stale findings.
- `docs/audits/AUDIT_AUTH_SECURITY.md` — still relevant for auth/validation/CSP hardening themes.
- `docs/audits/AUDIT_BACKEND_API.md` — useful backend bug inventory and endpoint consistency review.
- `docs/audits/AUDIT_CLINICAL_LIBRARY.md` — several findings now fixed; useful for verifying what no longer belongs in backlog.
- `docs/audits/AUDIT_MAIN_SESSION_FSRS.md` — historically important, but many critical path issues have now been fixed.
- `docs/audits/AUDIT_OSCE_MODE.md` — still relevant; several issues fixed, some remain.
- `docs/audits/AUDIT_PRISMA_DATA_INTEGRITY.md` — still relevant for migration cleanup and legacy storage debt.
- `docs/audits/AUDIT_QUESTION_GENERATION.md` — valuable for tracking question-generation fixes; major stub findings are now stale.
- `docs/audits/AUDIT_REPO_HYGIENE.md` — still relevant for duplicate layers, stale docs, and structure drift.
- `docs/audits/AUDIT_ROUTING.md` — helpful for hidden routes, 404 behavior, and route-definition fragmentation.
- `docs/audits/AUDIT_TELEMETRY_FSRS.md` — older core pipeline issues mostly fixed on the mainline path, but still useful for legacy cleanup.
- `docs/AUDIT_FOLLOW_UP.md` — small but current checklist; especially relevant to Zod and Prisma cleanup.
- `docs/CRITICAL_FIXES_SPRINT_TRACKER.md` — mixed stale/current tracker; still useful on loading-state and cleanup themes.
- `plans/MASTER_SPRINT_PLAN.md` — large strategic backlog; only selectively actionable.
- `plans/telemetry-fsrs-audit-plan.md` — confirms several telemetry items remained pending.
- `plans/targeted-rag-enrichment-plan.md` — key source for library enrichment rollout expectations.
- `plans/phase6-dynamic-study-path-optimizer.md` — originally future work; much of the core stack is now implemented.
- `docs/automation/scheduled-jobs-audit.md` — high-signal ops document; important for push reminders and scheduler ownership.
- `docs/automation/MIGRATION_MAP.md` — authoritative for the removal of `push-reminders` from GitHub cron and the intended runtime ownership shift.
- `docs/automation/CHANGELOG.md` — confirms automation changes that supersede older scheduler assumptions.
- `docs/COMPLETE_IMPLEMENTATION_SUMMARY.md` — historical completion doc now clearly overtaken by newer audits and current code.
- `docs/FEATURE_COMPLETION_SUMMARY.md` — useful because it correctly notes some hidden/intentional deferrals, but too optimistic overall.

## 4. Work Items Verified as Completed

These are the major items that should not be re-opened as if they were still untouched:

- `POST /api/study/session/generate` is no longer a 501 stub.
  - Older docs: `docs/audits/AUDIT_QUESTION_GENERATION.md`, `plans/COMPREHENSIVE_RECOMMENDATION_PLAN.md`, `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md`.
  - Current code: `functions/api/study/session/generate.ts`, `hooks/useSessionGenerator.ts`, `lib/api/schemas/sessions.ts`.

- Question-quality scoring and admin review surfaces exist.
  - Older docs treated parts of this as pending.
  - Current code: `lib/services/questionQualityService.ts`, `components/admin/QuestionQualityDashboard.tsx`, `functions/api/questions/performance.ts`.

- Mainline quiz/review submission is no longer using the older dual-write pattern described in earlier FSRS audits.
  - Current code explicitly moves mainline review persistence into the canonical path.
  - Current code: `components/session/QuizView.tsx`, `functions/api/questions/attempt.ts`, `lib/services/drillReviewService.ts`.

- `ENABLE_REVIEW_GATE` is not hardcoded anymore.
  - Stale claim corrected by code and by `docs/audits/AUDIT_CORRECTIONS.md`.
  - Current code: `lib/services/mainSessionQuestionSelector.ts`.

- Core dynamic study-path infrastructure is implemented.
  - Current code: `functions/api/study-path/accept.ts`, `functions/api/study-path/recommendation.ts`, `functions/api/study-path/progress.ts`, `functions/api/study-path/regenerate.ts`, `components/dashboard/StudyPathDashboard/index.tsx`, `services/optimizer/*`.

- Several clinical-library audit items are already fixed.
  - Current code: `functions/api/content/condition/[conditionId]/summary.ts`, `functions/api/content/condition/[conditionId]/details.ts`, `components/library/SmartConditionView.tsx`, `functions/api/drugs/library.ts`.
  - Improvements verified: authenticated condition surfaces, normalization helpers, freshness UI, more capable drug/library querying.

- The push-subscription data model and cron auth are no longer missing.
  - Stale docs claimed `PushSubscription` and cron auth were absent.
  - Current code: `prisma/schema.prisma` (`PushSubscription`), `functions/api/push/subscribe.ts`, `functions/api/cron/push-reminders.ts`.

## 5. Unfinished Work — High Confidence

### API validation hardening across Cloudflare endpoints
- Status: Partially implemented
- Priority: High
- Confidence: High
- Originally referenced in:
  - `docs/AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION_2026.md`
  - `docs/audits/AUDIT_AUTH_SECURITY.md`
  - `docs/AUDIT_FOLLOW_UP.md`
- Repo evidence checked:
  - `npm run audit:zod` on 2026-04-16
  - `functions/api/admin/**`
  - `functions/api/drills/submit-review.ts`
  - `functions/api/exam/start.ts`
  - `functions/api/exam/complete.ts`
  - `functions/api/feedback/submit.ts`
  - `functions/api/srs/sync.ts`
- What appears done:
  - Shared middleware and Zod-based validation patterns exist.
  - 38 endpoints pass the repo-native audit.
- What remains unfinished:
  - The audit still reports 145 endpoints with no validation and 8 using manual-only validation.
  - High-risk examples still flagged include admin mutation endpoints, drill submission, exam start/complete, feedback submission, and SRS sync.
- Why this still matters:
  - This is one of the few unfinished themes with both security and correctness impact across a wide surface area.
- Recommended next action:
  - Triage by risk, then migrate the highest-value endpoints first: admin mutations, drill submission, exam flows, feedback, and SRS sync.

### Express-to-Edge migration cleanup and retirement
- Status: Partially implemented
- Priority: High
- Confidence: High
- Originally referenced in:
  - `docs/express-to-edge-migration.md`
  - `docs/edge-migration-plan.md`
  - `docs/audits/AUDIT_REPO_HYGIENE.md`
- Repo evidence checked:
  - `server.ts`
  - `routes/adaptive.ts`
  - `routes/analytics.ts`
  - `routes/questions.ts`
  - `routes/sync.ts`
  - `package.json`
  - `functions/api/**`
- What appears done:
  - The production API surface is heavily implemented under `functions/api/**`.
  - `server.ts` is explicitly labeled as legacy/local-dev only.
- What remains unfinished:
  - Legacy Express routes still exist in `routes/**`.
  - `package.json` still supports `dev:server`, `dev:all`, and `build:server`.
  - The repo still has a split-brain API story: Cloudflare functions are the intended production path, but Express-compatible code is still maintained.
- Why this still matters:
  - Duplicate surfaces make docs, testing, and backend fixes drift-prone.
- Recommended next action:
  - Publish a route-parity map, decide which legacy routes are intentionally retained for local-only use, and retire everything else.

### Push reminder rollout is incomplete
- Status: Partially implemented
- Priority: High
- Confidence: High
- Originally referenced in:
  - `docs/automation/scheduled-jobs-audit.md`
  - `docs/automation/MIGRATION_MAP.md`
  - `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md`
- Repo evidence checked:
  - `functions/api/push/subscribe.ts`
  - `functions/api/cron/push-reminders.ts`
  - `prisma/schema.prisma`
  - `.github/workflows/sched-daily-ops.yml`
  - `.github/workflows/**`
- What appears done:
  - Push subscriptions are modeled in Prisma.
  - The subscribe endpoint exists.
  - `push-reminders.ts` uses `CRON_SECRET`, which fixes an older auth flaw.
- What remains unfinished:
  - There is no active workflow in `.github/workflows/**` invoking `push-reminders`.
  - Automation docs explicitly say `push-reminders` was removed from GitHub cron and should move to runtime/queue ownership.
  - `functions/api/cron/push-reminders.ts` still contains `notificationsSent24h: 0 // TODO: track via NotificationLog when migration ships`.
- Why this still matters:
  - This system is user-visible and non-idempotent; without scheduler ownership and delivery auditing it is risky to activate.
- Recommended next action:
  - Add `NotificationLog`, choose the runtime scheduler/queue owner, and expose delivery metrics before re-enabling reminders.

### Study groups/social remain scaffold-only and intentionally hidden
- Status: Scaffold only
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md`
  - `docs/STRATEGIC_10_SPRINT_ROADMAP.md`
  - `docs/PRODUCTION_READINESS_MASTER_PLAN.md`
- Repo evidence checked:
  - `services/domain/studyGroupService.ts`
  - `components/social/StudyGroupDashboard.tsx`
  - `config/lazyComponents.tsx`
  - `prisma/schema.prisma`
  - `prisma/migrations/20251210051211_add_social_features/migration.sql`
- What appears done:
  - Schema and migrations exist for `StudyGroup` / `StudyGroupMember`.
  - A dashboard UI exists.
  - A service shell exists.
- What remains unfinished:
  - `services/domain/studyGroupService.ts` explicitly says: “STATUS: NOT YET IMPLEMENTED — no backend API endpoints exist for study groups.”
  - `components/social/StudyGroupDashboard.tsx` still calls `/api/social/groups`, `/api/social/leaderboard`, and `/api/social/groups/join`.
  - There is no `functions/api/social/` directory.
  - `config/lazyComponents.tsx` says `StudyGroupDashboard removed — social API not implemented`.
- Why this still matters:
  - This is classic scaffold debt: schema and UI imply a feature exists, but the production backend does not.
- Recommended next action:
  - Make an explicit product decision: either build `functions/api/social/*` or delete/freeze the hidden scaffolding and stop carrying it as pseudo-finished work.

### Deprecated SRS compatibility paths still coexist with the FSRS-first mainline
- Status: Partially implemented
- Priority: High
- Confidence: High
- Originally referenced in:
  - `docs/audits/AUDIT_PRISMA_DATA_INTEGRITY.md`
  - `docs/audits/AUDIT_TELEMETRY_FSRS.md`
  - `docs/audits/AUDIT_MAIN_SESSION_FSRS.md`
- Repo evidence checked:
  - `functions/api/questions/review.ts`
  - `functions/api/srs/submit.ts`
  - `functions/api/srs/sync.ts`
  - `prisma/README.md`
  - `prisma/schema.prisma`
- What appears done:
  - Mainline review persistence now centers on `ReviewLog` and `drillReviewService`.
  - Deprecated status is clearly documented in code/comments.
- What remains unfinished:
  - `functions/api/questions/review.ts` still exists as a deprecated SRSItem write path.
  - `functions/api/srs/submit.ts` still contains compatibility behavior and legacy write support.
  - Prisma docs still describe an unfinished `UserProgress.reviewHistory` to `ReviewLog` migration.
- Why this still matters:
  - The main path is healthier, but legacy write paths keep the repo vulnerable to drift and data inconsistency if old callers survive.
- Recommended next action:
  - Inventory active callers, retire `questions/review.ts`, narrow `srs/submit.ts` to the minimum compatibility layer, then finish the migration plan documented in `prisma/README.md`.

### OSCE mode still has an incorrect answer-queue write
- Status: Partially implemented
- Priority: High
- Confidence: High
- Originally referenced in:
  - `docs/audits/AUDIT_OSCE_MODE.md`
  - `docs/strategy/PANaCEa-Feature-Strategy-2026-Q2.md`
- Repo evidence checked:
  - `components/modes/PatientEncounterMode.tsx`
  - `components/layout/DrillViewRouter.tsx`
- What appears done:
  - The chat-save overwrite race appears fixed via `chatSaveQueueRef`.
  - The duplicate `completeOSCESession()` issue appears fixed.
  - The AI rubric is now treated as the authoritative score with a secondary “Quick Preview.”
- What remains unfinished:
  - `PatientEncounterMode.tsx` still queues an answer using `questionId: sessionId`, which is not a legitimate question identity.
  - The Q2 strategy doc is still correct that OSCE performance is not properly folded back into FSRS/confusion systems.
- Why this still matters:
  - This is not just cleanup; it risks polluting sync/analytics with semantically wrong records.
- Recommended next action:
  - Remove the bogus `queueAnswer` write immediately, then decide whether OSCE should emit a dedicated analytics event, a real review artifact, or no SRS artifact at all.

## 6. Unfinished Work — Partial / In Progress

### Library enrichment pipeline rollout
- Status: Partially implemented
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `plans/targeted-rag-enrichment-plan.md`
  - `docs/library-enrichment-pipeline.md`
- Repo evidence checked:
  - `scripts/library-enrichment/audit.ts`
  - `scripts/library-enrichment/file-discovery.ts`
  - `scripts/library-enrichment/pdf-extraction.ts`
  - `scripts/library-enrichment/deepseek-extract.ts`
  - `scripts/library-enrichment/enrichment-engine.ts`
  - `scripts/library-enrichment/library-enrichment.ts`
  - `components/admin/LibraryEnrichmentDashboard.tsx`
  - `functions/api/admin/library-enrichment-logs.ts.disabled`
  - `functions/api/admin/library-enrichment-priority.ts.disabled`
- What appears done:
  - The enrichment scripts and pipeline pieces exist.
  - An admin dashboard exists.
- What remains unfinished:
  - The admin endpoints that dashboard expects are disabled.
  - The dashboard still opens JSON/files/endpoints that are not fully productionized.
- Why this still matters:
  - This is a near-complete subsystem whose last-mile admin/runtime surfaces are still incomplete.
- Recommended next action:
  - Replace or re-enable the disabled admin endpoints and decide whether logs/priority data should come from files, DB tables, or a proper admin API.

### Loading-state normalization is still inconsistent
- Status: Partially implemented
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/CRITICAL_FIXES_SPRINT_TRACKER.md`
  - `docs/AUDIT_FOLLOW_UP.md`
  - `docs/AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION_2026.md`
- Repo evidence checked:
  - `components/loading/index.tsx`
  - `components/social/StudyGroupDashboard.tsx`
  - `components/modes/PatientEncounterMode.tsx`
  - `components/modes/GrandRoundsMode.tsx`
  - `components/modes/CramMode.tsx`
  - `components/session/CoreAdaptiveSession.tsx`
- What appears done:
  - A canonical loading system exists in `components/loading/index.tsx`.
  - Some components already use `SkeletonLoader`.
- What remains unfinished:
  - Many session/mode components still render bespoke spinners and one-off loading UIs.
  - This is still a repeated theme in newer follow-up docs.
- Why this still matters:
  - The design system has a canonical solution, but rollout consistency is incomplete in high-traffic UI surfaces.
- Recommended next action:
  - Convert the session/mode components with the highest traffic first, starting with adaptive/session shells and major drill modes.

### Repo hygiene and service consolidation
- Status: Partially implemented
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/audits/AUDIT_REPO_HYGIENE.md`
  - `docs/CRITICAL_FIXES_SPRINT_TRACKER.md`
- Repo evidence checked:
  - `npm run audit:services`
  - `services/session/index.ts`
  - `functions/geminiProxy.ts`
  - `routes/**`
  - `services/**`
- What appears done:
  - The repo has explicit audit tooling for service consolidation.
  - Some deprecated entrypoints are clearly labeled.
- What remains unfinished:
  - Duplicate/compatibility layers still exist.
  - The service audit still recommends consolidation and target structure cleanup.
  - Legacy wrappers and aliases are still present.
- Why this still matters:
  - This is not cosmetic; it increases the odds of fixing one path while another stale path survives.
- Recommended next action:
  - Define a short allowlist of canonical service modules, then remove or freeze everything else behind explicit deprecation boundaries.

### Auxiliary AI feature surfaces are still placeholder-only
- Status: Partially implemented
- Priority: Low
- Confidence: High
- Originally referenced in:
  - `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md`
  - `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md`
- Repo evidence checked:
  - `functions/api/smart-scribe/generate-infographic.ts`
  - `functions/api/spark/instant-calc.ts`
  - `functions/api/_shared/aiQuestionService.ts`
  - `services/orchestration/unifiedWorkflowService.ts`
  - `services/domain/clinicalPearlService.ts`
  - `functions/api/analytics/learner-analysis.ts`
- What appears done:
  - Endpoint shells and orchestration/service hooks exist.
- What remains unfinished:
  - Several of these surfaces still explicitly return placeholders or describe themselves as “real implementation would call…”
  - `spark/instant-calc.ts` returns 501 when not configured and otherwise serves placeholder HTML.
  - Smart Scribe infographic generation still returns placeholder infographic output on fallback.
- Why this still matters:
  - These features look closer to production than they actually are and can quietly accumulate product debt.
- Recommended next action:
  - Either mark them as experimental/hidden or replace the placeholder logic with real provider integrations.

### Prisma disconnect cleanup still has tail risk
- Status: Mostly completed with minor gaps
- Priority: Low
- Confidence: High
- Originally referenced in:
  - `docs/AUDIT_FOLLOW_UP.md`
  - `docs/audits/AUDIT_PRISMA_DATA_INTEGRITY.md`
- Repo evidence checked:
  - `npm run audit:prisma`
  - `functions/api/cron/generate-daily-plans.ts`
  - `functions/api/cron/nightly-health-check.ts`
  - `functions/api/users/me/daily-plan.ts`
  - `functions/api/users/me/exam-outcome.ts`
  - `functions/api/users/me/exam-readiness.ts`
- What appears done:
  - The audit reports 323 passing files.
- What remains unfinished:
  - 18 files still fail the repo-native audit.
  - Some are helper/test-adjacent, but several are real handlers.
- Why this still matters:
  - This is a cleanup item, not a top product blocker, but it is still unfinished and easy to keep deferring forever.
- Recommended next action:
  - Fix the real handler files first, then tighten the audit to reduce helper/test false positives.

## 7. Unfinished Work — Mentioned in Docs but Untouched in Code

### Notification delivery logging for push reminders
- Status: Not started
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md`
  - `docs/integration-plan-2026-04-12.md`
  - `docs/automation/scheduled-jobs-audit.md`
- Repo evidence checked:
  - `prisma/schema.prisma`
  - `functions/api/cron/push-reminders.ts`
- What appears done:
  - `PushSubscription` exists.
- What remains unfinished:
  - `NotificationLog` does not exist in the Prisma schema.
  - `push-reminders.ts` still contains a TODO that assumes `NotificationLog` will be added later.
- Why this still matters:
  - Without delivery logging, reminder rollout cannot be audited or safely scaled.
- Recommended next action:
  - Add `NotificationLog` schema + migration, then write from `push-reminders.ts` before turning reminders back on.

### Dead-man-switch alerting for automation lanes
- Status: Not started
- Priority: Low
- Confidence: High
- Originally referenced in:
  - `docs/automation/WORKFLOW_STANDARDS.md`
  - `docs/automation/OPERATOR_DASHBOARD.md`
  - `docs/automation/ROLLOUT_NOTES.md`
- Repo evidence checked:
  - `.github/workflows/**`
  - `scripts/automation/**`
- What appears done:
  - There are multiple scheduled workflows and reporting scripts.
- What remains unfinished:
  - No dead-man-switch implementation or workflow references were found.
- Why this still matters:
  - This is an operational safeguard that docs repeatedly mention but the repo does not yet implement.
- Recommended next action:
  - Add a small heartbeat/failure-detection path only after the current workflow ownership model is stable.

### Automated backup restore verification
- Status: Not started
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/automation/FINAL_AUDIT.md`
  - `docs/automation/MIGRATION_MAP.md`
  - `docs/automation/scheduled-jobs-audit.md`
- Repo evidence checked:
  - `.github/workflows/sched-weekly-maintenance.yml`
  - `scripts/automation/weeklyMaintenance.ts`
  - `scripts/emergency_restore.ts`
  - `scripts/rollback-medical-content-from-backup.ts`
- What appears done:
  - Weekly maintenance can create backups.
  - Manual restore scripts exist.
- What remains unfinished:
  - No automated restore-verification lane was found.
  - Multiple automation docs still explicitly say restore verification is missing.
- Why this still matters:
  - Backup creation without restore proof is incomplete operational hardening.
- Recommended next action:
  - Add a bounded restore-verification job to weekly maintenance before expanding maintenance scope further.

### Runtime-owned replacement for GitHub-cron push reminders
- Status: Not started
- Priority: Medium
- Confidence: High
- Originally referenced in:
  - `docs/automation/MIGRATION_MAP.md`
  - `docs/automation/CHANGELOG.md`
  - `docs/automation/PR_SUMMARY.md`
- Repo evidence checked:
  - `.github/workflows/**`
  - `functions/api/cron/push-reminders.ts`
  - `services/**`
  - `lib/services/queue/**`
- What appears done:
  - The old GitHub-cron ownership was removed from workflows.
- What remains unfinished:
  - No explicit runtime-owned queue/scheduler implementation for reminder delivery was found.
- Why this still matters:
  - The docs intentionally removed the old scheduler path, but the replacement is not yet present in code.
- Recommended next action:
  - Decide whether reminders belong to a queue, a durable scheduler, or app-native timing service, then implement that owner explicitly.

## 8. Items That Appear Obsolete, Superseded, or Already Overtaken

### “`/api/study/session/generate` is still a 501 stub”
- Older references:
  - `docs/audits/AUDIT_QUESTION_GENERATION.md`
  - `plans/COMPREHENSIVE_RECOMMENDATION_PLAN.md`
  - `docs/audits/AUDIT_AUTH_SECURITY.md`
- Why it appears obsolete:
  - The endpoint is implemented and validated through `functions/api/study/session/generate.ts`.
  - `hooks/useSessionGenerator.ts` is wired to it through the SDK path.

### “`ENABLE_REVIEW_GATE` is hardcoded true”
- Older reference:
  - `docs/audits/AUDIT-2026-04-06.md`
- Why it appears obsolete:
  - `lib/services/mainSessionQuestionSelector.ts` now reads environment sources.
  - `docs/audits/AUDIT_CORRECTIONS.md` explicitly corrects the older claim.

### “TanStack Query is unused”
- Older reference:
  - `docs/audits/AUDIT-2026-04-06.md`
- Why it appears obsolete:
  - `index.tsx` uses `PersistQueryClientProvider`.
  - Query hooks and consumers exist, including `hooks/useSRSItems.ts` and `components/analytics/TopicMasteryBreakdown.tsx`.
- Current truth:
  - Migration is incomplete, but “unused” is no longer accurate.

### “Question-quality rollout steps 9-10 are still pending”
- Older reference:
  - `docs/QUESTION_GENERATION_IMPROVEMENT_PLAN.md`
- Why it appears obsolete:
  - `lib/services/questionQualityService.ts` and `components/admin/QuestionQualityDashboard.tsx` now exist.
  - `docs/QUESTION_SYSTEM_IMPROVEMENTS.md` is the better reflection of current state.

### “`push-reminders` still belongs to GitHub cron”
- Older reference:
  - `docs/strategy/PANaCEa-Feature-Strategy-2026-Q2.md`
- Why it appears obsolete:
  - Automation docs later moved it out of GitHub cron on purpose.
  - Current workflows do not invoke `push-reminders`.
- Current truth:
  - The unfinished work is not “keep it on GitHub cron,” but “build the runtime-owned replacement.”

### `OSCESimulator.tsx` as the active OSCE surface
- Older reference:
  - `docs/audits/AUDIT_OSCE_MODE.md`
- Why it appears overtaken:
  - The routed OSCE drill surface is `PatientEncounterMode`, wired through `config/lazyComponents.tsx` and `components/layout/DrillViewRouter.tsx`.
  - `components/modes/osce/OSCESimulator.tsx` still exists, but no active route references were found.
- Current truth:
  - `OSCESimulator.tsx` is closer to dead/unrouted code than to the active production OSCE path.

## 9. Cross-Cutting Gaps

- Documentation drift is itself a real problem.
  - Multiple docs still describe already-fixed issues as if they are live blockers.
  - “Complete” summaries from older phases are not reliable backlog sources without code verification.

- Backend split-brain remains a recurring source of confusion.
  - `functions/api/**` is the real production path.
  - `server.ts` + `routes/**` still keep an overlapping local/backend surface alive.

- Mainline paths are cleaner than legacy paths.
  - The current quiz/review path is healthier than older audits imply.
  - The real debt is the compatibility layer that still survives around SRSItem/UserProgress-era code.

- Several systems are technically built but not operationally finished.
  - Push notifications, library enrichment, and backup workflows all show this pattern.
  - The endpoint/script exists, but scheduler ownership, auditability, or admin visibility is missing.

- A canonical UI system exists, but rollout discipline is inconsistent.
  - `components/loading/index.tsx` provides a standard loader/skeleton system.
  - Many major components still ship bespoke loading states.

- Hidden features are accumulating as dormant debt.
  - Study groups are the clearest example.
  - Unrouted or partially hidden surfaces are easy to keep misclassifying as “almost done.”

## 10. Recommended Next Work Queue

Quick wins:

1. Remove the bogus OSCE `queueAnswer({ questionId: sessionId })` write from `PatientEncounterMode`.
2. Use the existing Zod/middleware pattern on the highest-risk endpoints flagged by `npm run audit:zod`.
3. Add explicit status metadata to the most misleading active audit/plan docs so stale findings stop re-entering the backlog.

Important medium-sized completions:

1. Add `NotificationLog` and delivery metrics, then finish push reminder observability.
2. Add automated restore verification to weekly maintenance.
3. Finish the library-enrichment admin rollout by replacing or re-enabling the disabled admin endpoints.
4. Retire deprecated SRS endpoints and finish the `ReviewLog` / `UserProgress` migration cleanup.
5. Normalize loading states in the highest-traffic session/mode surfaces.

Bigger unfinished systems:

1. Finish the Express-to-Edge retirement plan and remove ambiguous legacy route ownership.
2. Build the runtime-owned scheduler/queue for push reminders.
3. Execute a real service-consolidation pass so “compatibility alias” layers stop growing.

Things to explicitly defer unless product strategy changes:

1. Full study-group/social rollout if the feature is not near-term and remains intentionally hidden.
2. Placeholder auxiliary AI surfaces like Spark Instant Calc or Smart Scribe infographic generation unless they become active roadmap items.
3. Dead-man-switch alerting until the current automation ownership model is fully settled.

## 11. Appendix: Evidence Map

| Work item | Primary docs | Primary code evidence | Status |
|---|---|---|---|
| Study session generation endpoint | `docs/audits/AUDIT_QUESTION_GENERATION.md`; `plans/COMPREHENSIVE_RECOMMENDATION_PLAN.md` | `functions/api/study/session/generate.ts`; `hooks/useSessionGenerator.ts` | Completed |
| Question quality gate + dashboard | `docs/QUESTION_GENERATION_IMPROVEMENT_PLAN.md`; `docs/QUESTION_SYSTEM_IMPROVEMENTS.md` | `lib/services/questionQualityService.ts`; `components/admin/QuestionQualityDashboard.tsx` | Completed |
| Mainline FSRS single-write path | `docs/audits/AUDIT_MAIN_SESSION_FSRS.md`; `docs/audits/AUDIT_TELEMETRY_FSRS.md` | `components/session/QuizView.tsx`; `functions/api/questions/attempt.ts`; `lib/services/drillReviewService.ts` | Completed |
| Review gate env wiring | `docs/audits/AUDIT-2026-04-06.md`; `docs/audits/AUDIT_CORRECTIONS.md` | `lib/services/mainSessionQuestionSelector.ts` | Completed |
| Dynamic study-path stack | `plans/phase6-dynamic-study-path-optimizer.md` | `functions/api/study-path/*`; `components/dashboard/StudyPathDashboard/index.tsx`; `services/optimizer/*` | Completed |
| Clinical-library normalization/freshness/auth fixes | `docs/audits/AUDIT_CLINICAL_LIBRARY.md` | `components/library/SmartConditionView.tsx`; `functions/api/content/condition/[conditionId]/*`; `functions/api/drugs/library.ts` | Completed |
| Push subscription model + cron auth | `docs/sprints/SPRINT7-CODE-REVIEW.md`; `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md` | `prisma/schema.prisma`; `functions/api/push/subscribe.ts`; `functions/api/cron/push-reminders.ts` | Completed |
| API validation hardening | `docs/audits/AUDIT_AUTH_SECURITY.md`; `docs/AUDIT_FOLLOW_UP.md`; `docs/api/API_OVERVIEW.md` | `npm run audit:zod`; `functions/api/push/subscribe.ts`; `functions/api/analytics/soap-note.ts`; `functions/api/reviews/second-chance.ts`; `functions/api/admin/**`; `functions/api/drills/submit-review.ts`; `functions/api/exam/*` | Partial |
| Express-to-Edge cleanup | `docs/edge-migration-plan.md`; `docs/express-to-edge-migration.md` | `server.ts`; `routes/**`; `package.json`; `functions/api/**` | Partial |
| Push reminder rollout | `docs/automation/scheduled-jobs-audit.md`; `docs/automation/MIGRATION_MAP.md` | `functions/api/cron/push-reminders.ts`; `.github/workflows/**`; `prisma/schema.prisma` | Partial |
| Study groups/social | `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md`; `docs/STRATEGIC_10_SPRINT_ROADMAP.md` | `services/domain/studyGroupService.ts`; `components/social/StudyGroupDashboard.tsx`; `config/lazyComponents.tsx` | Scaffold only |
| Legacy SRS cleanup | `docs/audits/AUDIT_PRISMA_DATA_INTEGRITY.md`; `docs/audits/AUDIT_TELEMETRY_FSRS.md` | `functions/api/questions/review.ts`; `functions/api/srs/submit.ts`; `prisma/README.md` | Partial |
| OSCE FSRS bridge cleanup | `docs/audits/AUDIT_OSCE_MODE.md` | `components/modes/PatientEncounterMode.tsx` | Partial |
| Library enrichment rollout | `plans/targeted-rag-enrichment-plan.md`; `docs/library-enrichment-pipeline.md` | `scripts/library-enrichment/*`; `components/admin/LibraryEnrichmentDashboard.tsx`; disabled admin endpoints | Partial |
| Loading-state normalization | `docs/CRITICAL_FIXES_SPRINT_TRACKER.md`; `docs/AUDIT_FOLLOW_UP.md` | `components/loading/index.tsx`; session/mode components with bespoke spinners | Partial |
| Service consolidation | `docs/audits/AUDIT_REPO_HYGIENE.md` | `npm run audit:services`; `services/session/index.ts`; `functions/geminiProxy.ts` | Partial |
| Auxiliary AI placeholders | `docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md`; `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md` | `functions/api/smart-scribe/generate-infographic.ts`; `functions/api/spark/instant-calc.ts`; `functions/api/_shared/aiQuestionService.ts` | Partial |
| Prisma disconnect cleanup | `docs/AUDIT_FOLLOW_UP.md` | `npm run audit:prisma`; affected handlers under `functions/api/cron/**` and `functions/api/users/me/**` | Partial |
| NotificationLog | `docs/integration-plan-2026-04-12.md`; `docs/PANACEA_COMPREHENSIVE_IMPROVEMENT_PLAN.md` | `prisma/schema.prisma`; `functions/api/cron/push-reminders.ts` | Not started |
| Dead-man-switch alerting | `docs/automation/WORKFLOW_STANDARDS.md`; `docs/automation/OPERATOR_DASHBOARD.md` | `.github/workflows/**`; `scripts/automation/**` | Not started |
| Backup restore verification | `docs/automation/FINAL_AUDIT.md`; `docs/automation/MIGRATION_MAP.md` | `.github/workflows/sched-weekly-maintenance.yml`; `scripts/emergency_restore.ts` | Not started |
| Runtime-owned replacement for push-reminders | `docs/automation/MIGRATION_MAP.md`; `docs/automation/CHANGELOG.md` | `.github/workflows/**`; `functions/api/cron/push-reminders.ts`; queue/service search | Not started |
| “session/generate is stub” claim | `docs/audits/AUDIT_QUESTION_GENERATION.md`; `plans/COMPREHENSIVE_RECOMMENDATION_PLAN.md` | `functions/api/study/session/generate.ts` | Obsolete |
| “ENABLE_REVIEW_GATE hardcoded” claim | `docs/audits/AUDIT-2026-04-06.md` | `lib/services/mainSessionQuestionSelector.ts`; `docs/audits/AUDIT_CORRECTIONS.md` | Obsolete |
| “TanStack Query unused” claim | `docs/audits/AUDIT-2026-04-06.md` | `index.tsx`; `hooks/useSRSItems.ts`; `components/analytics/TopicMasteryBreakdown.tsx` | Obsolete |
| “Question quality steps 9-10 pending” claim | `docs/QUESTION_GENERATION_IMPROVEMENT_PLAN.md` | `lib/services/questionQualityService.ts`; `components/admin/QuestionQualityDashboard.tsx` | Obsolete |
| “push-reminders still GitHub-cron-owned” claim | `docs/strategy/PANaCEa-Feature-Strategy-2026-Q2.md` | `docs/automation/MIGRATION_MAP.md`; workflow search | Obsolete |
| `OSCESimulator` as active OSCE runtime | `docs/audits/AUDIT_OSCE_MODE.md` | `config/lazyComponents.tsx`; `components/layout/DrillViewRouter.tsx`; `components/modes/osce/OSCESimulator.tsx` | Overtaken |
