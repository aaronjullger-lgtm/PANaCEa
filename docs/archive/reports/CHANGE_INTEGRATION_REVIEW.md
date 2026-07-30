# PANaCEa Change Integration Review

Status: current integration pass, 2026-05-05 12:03 EDT.

## Current Repo State

| Area | Evidence | Integration Assessment | Next Action |
|---|---|---|---|
| Dirty worktree | `git status --short` shows broad modified/deleted/untracked work across frontend, backend, tests, docs, Prisma, and scripts. | Expected for this branch. Treat as a multi-agent integration branch, not a clean feature diff. | Review by domain and avoid reverting unrelated work. |
| Prisma migration history | Earlier integration inspection found `prisma/migrations/20260426000000_osce_factorization/migration.sql` staged for deletion. Push finalization restored the migration from `HEAD`; `git diff --cached` no longer contains it. | Migration history is preserved for this branch. | Keep restored; future schema changes must use new migrations rather than deleting historical files. |
| Active study entrypoint | `components/navigation/command-center/CommandCenterWorkspace.tsx` imports `components/dashboard/adaptive/page/DashboardPage.tsx`. | `/study` is integrated with the adaptive dashboard, not the deleted legacy dashboard. | Keep adaptive dashboard canonical. |
| Deleted dashboard imports | `rg "DashboardPage|UnifiedDashboard|Daily Pilot|Data Scientist"` shows active adaptive imports plus stale docs/plans only. | Legacy dashboard deletion is safe from live import perspective. | Update current docs; keep historical plans marked as historical instead of pretending they are current. |
| SRS helper deletion | `rg "lib/services/srsService"` shows docs/plans/logs only; active code uses API-backed `srsReviewClient` and `drillReviewService`. | Old localStorage SRS helper deletion is coherent. | Keep `/api/srs/*` compatibility shells until runtime route consumers are verified. |
| Todoist linking removal | Live code keeps `TodoistExportPanel` and `lib/services/todoistService.ts` CSV-only; deleted OAuth callback/modal are doc-only references. | CSV export is the canonical Todoist-compatible path. | Do not reintroduce client-side OAuth/token storage. |
| Package scripts | `package.json` referenced missing `scripts/migrateGuidelinesToDb.ts` and `scripts/migrateBuzzwordsToDb.ts`. | Operational script inventory was inaccurate. | Removed missing scripts from `package.json` and `docs/SCRIPTS_REFERENCE.md`. |
| Health smoke | `e2e/api-health.spec.ts` validates Cloudflare Functions liveness, while `verify:health` used default Vite Playwright config. | Script/test config mismatch made the health gate misleading. | `verify:health` now runs through `playwright.wrangler.config.ts`. |

## Integrated Code Fixes In This Pass

| Slice | Files | Why It Matters | Verification |
|---|---|---|---|
| Admin AI gateway classification | `functions/api/_middleware.ts`, `functions/api/_middleware.test.ts` | Admin generation/critic/ingest endpoints call AI and must fail closed when the gateway limiter is unavailable. | `npx vitest run functions/api/_middleware.test.ts` via focused suite. |
| Legacy SRS idempotency | `functions/api/srs/submit.ts`, `functions/api/srs/submit-compat.test.ts` | Legacy `/api/srs/submit` accepted `attemptId` but did not pass it to canonical review writes, allowing duplicate retries. | `npx vitest run functions/api/srs/submit-compat.test.ts` via focused suite. |
| Offline sync drain | `lib/services/sync/syncManager.ts`, `tests/syncManager.test.ts` | Session summary and plan completion can race pending review writes. `syncAll()` now awaits the in-flight drain and follows up fresh pending items. | `npx vitest run tests/syncManager.test.ts`. |
| Review-held enhanced generation | `services/ai/enhancedQuestionService.ts`, `services/ai/enhancedQuestionService.test.ts` | A 202 `requiresApproval` response must not be silently treated as no question or recorded as successful distribution. | Focused enhanced generation test suite. |
| Library answer error envelope | `functions/api/library/answer.ts` | Public endpoint should not return raw DB/vector/AI error messages. | `npx vitest run functions/api/library/answer.test.ts`. |
| Current documentation correction | `README.md`, `CLAUDE.md` | Root docs still described FSRS v5 and deleted dashboard widgets as active. | Static review plus `git diff --check`. |

## Remaining Launch-Risk Themes

| Severity | Risk | Evidence | Required Follow-Up |
|---|---|---|---|
| P0 | Canonical question/source identity is not fully migrated. | `Question`, `PreGeneratedQuestion`, `QuestionAttempt`, `ReviewLog`, `Card`, and `StudySession` still require source identity backfill and schema decisions. | Run the read-only identity probe, design migration/backfill, then implement in a separate DB migration pass. |
| P0 | Concept identity remains split between `Condition.id` and `MedicalContent.id`. | `UserProgress.conditionId` now relates to `MedicalContent`, while adjacent code still uses condition IDs in several domains. | Keep guards; plan explicit `medicalContentId` rename/backfill or mapping migration. |
| P1 | Approval/mirror writes are not transactionally unified. | `functions/api/_shared/staging-questions.ts` and `functions/api/admin/question-review.ts` can approve/mirror in multiple writes. | Wrap approval and mirror writes in a transaction or keep pending until all writes succeed. |
| P1 | Review writes are not fully atomic. | `lib/services/drillReviewService.ts` writes `ReviewLog`, `UserProgress`, and `Card` in separate phases. | Move durable progress/card writes into a transaction or return a degraded non-scheduled response on partial failure. |
| P1 | Browser smoke still needs a live runtime. | Local Vitest/build pass is not the same as Cloudflare/Clerk/Postgres smoke. | Run Wrangler/production smoke with `BASE_URL`, Clerk credentials, and Postgres test data. |
