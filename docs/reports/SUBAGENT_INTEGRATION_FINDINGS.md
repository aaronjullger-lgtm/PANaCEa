# Subagent Integration Findings

Status: consolidated 2026-05-05 12:03 EDT. All subagents were read-only.

## Findings By Agent

| Agent | Domain | Key Findings | Integration Decision |
|---|---|---|---|
| Hegel | Backend / Edge / AI routes | Admin AI routes were classified as `admin`, not `ai`; approval/mirror writes are not atomic; enhanced generation 202 review-held response was not handled by the client; generation rate-limit comments/contracts are inconsistent; `library/answer` leaked raw backend errors. | Fixed admin AI tiering, enhanced client review-held handling, and generic library answer errors. Atomic approval/mirror work remains P1. |
| Beauvoir | Session / FSRS pipeline | `syncAll()` could race immediate review sync; `/api/srs/submit` accepted `attemptId` without forwarding idempotency; review writes are not atomic; `useQuizSubmit` is a stale duplicate submission path; tests encode outdated FSRS assumptions. | Fixed sync drain and SRS idempotency. Durable transaction work and stale duplicate hook cleanup remain. |
| Rawls | Frontend / Dashboard / Routing | `/study` correctly uses `CommandCenterWorkspace -> AdaptiveDashboardPage`; legacy dashboard imports are clean; `CommandCenterPage`, `MenuView`, and `TrainingMenu` remain mixed legacy surfaces; deferred mode routes/tests disagree with visibility gates. | Keep adaptive dashboard canonical. Document route/mode cleanup as next work; do not delete route surfaces without focused import/UX verification. |
| Archimedes | Prisma / Data integrity | The earlier staged deletion of `20260426000000_osce_factorization` was high risk and has now been restored during push finalization; question identity contract is still duplicated; `UserProgress.conditionId` is effectively `MedicalContent.id`; new normalized `StudyPlan` tables are not authoritative; new migration has replay-safety concerns. | Migration history is preserved on the finalization branch. Treat `DailyStudyPlan.recommendedSessions` as canonical until dual-write parity exists, and keep future schema changes additive through new migrations. |
| Einstein | Docs / Scripts / Reports | Current reports disagree on grade; production ledger is stale; duplicate unfinished-work audit exists; docs link to absent `docs/archive`; health docs contradict actual `/api/health`; package scripts referenced missing migration files; e2e claims overstate coverage. | Scorecard and integration docs are canonical current status. Removed missing package scripts and updated root docs. Historical docs should be archived in a later docs sweep. |
| McClintock | Tests / Verification | Broad Vitest reportedly passed locally; `verify:health` was broken by config mismatch; sync tests need stronger endpoint-coupled coverage; untracked tests must be intentionally integrated. | Fixed `verify:health` script. Added focused regression coverage for this pass. Live browser smoke remains gated on runtime credentials. |

## Second-Pass Synthesis

| Theme | Confirmation | Action Taken | Remaining Risk |
|---|---|---|---|
| Legacy dashboard cleanup | Confirmed by local `rg` and Rawls. | No live import rollback. Root docs updated away from deleted widget names. | Historical docs/plans still mention old widgets. |
| Canonical FSRS writer | Confirmed by Beauvoir: `/api/questions/attempt` is stats-only and `drillReviewService` owns real review writes. | Forwarded legacy SRS `attemptId` as canonical idempotency key. | `drillReviewService` durable writes need transaction/degraded-result hardening. |
| AI fail-closed policy | Confirmed by Hegel: admin AI was the main gateway classification gap. | Admin generation/enrichment/critic/knowledge ingest paths now use AI gateway tier. | Per-endpoint AI wrapper limits/comments still need contract cleanup. |
| Runtime health truth | Confirmed by Einstein and McClintock. | `verify:health` now uses Wrangler Playwright config. | Requires Wrangler server or `BASE_URL`; cannot prove live Cloudflare locally without credentials. |
| Data identity | Confirmed by Archimedes and previous audits. | No migration in this pass. Findings carried into canonical decisions and next plan. | Remains top launch blocker. |
