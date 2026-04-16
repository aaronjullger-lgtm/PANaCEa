# Implementation Queue

Derived from `UNFINISHED_WORK_MASTER_AUDIT.md` (2026-04-16) and cross-checked against current code on 2026-04-16.

## Source-of-truth reconciliation notes

Before queueing tasks, I re-validated the audit's specific claims against current code and re-ran (improved, middleware-aware) versions of the repo-native audit tools. Findings that change the queue:

- **Audit's named "still flagged" Zod endpoints are already validated**: `functions/api/exam/start.ts`, `functions/api/exam/complete.ts`, `functions/api/feedback/submit.ts`, `functions/api/srs/sync.ts`, `functions/api/drills/submit-review.ts` all use `authenticatedEndpoint(Schema, handler)`, which internally runs `withValidation(schema)`. The original `scripts/audit-zod-validation.ts` had multiple detection gaps: it did not recognize the seven shared middleware wrappers (`authenticatedEndpoint`, `adminEndpoint`, `adminAuthenticatedEndpoint`, `aiEndpoint`, `refineryEndpoint`, `cmsEndpoint`, `publicEndpoint`), did not handle the TypeScript-generic call form `authenticatedEndpoint<Input>(...)`, did not recognize CRON_SECRET / Svix webhook as legitimate out-of-band security, and matched `JSON.parse(` as evidence of Zod. After the script fix, **real FAIL count drops to 2**: `drill/log-attempt.ts` (a deprecated 410-Gone tombstone that never reads the body) and `podcast/generate.ts` (a proxy that forwards to an external Node service).
- **Real file-level gaps that were accurate**: `users/me/daily-plan.ts` POST and `users/me/exam-outcome.ts` POST genuinely lacked Zod. Addressed this run as TASK-007 and TASK-008.
- **Prisma disconnect audit** flagged 3 files, all of which are false positives: `_shared/env-validation.ts` (match is in a JSDoc example comment), `_shared/prisma-user-scope.ts` (factory — caller owns disconnect), `functions/api/health.ts` (DOES disconnect, via an indirect `disconnect = ...; await disconnect(prisma)` pattern my regex missed). **Prisma disconnect cleanup is effectively complete.** The audit's "18 fails" is stale.
- **OSCE bogus `queueAnswer({ questionId: sessionId })`** — confirmed present at `components/modes/PatientEncounterMode.tsx:1015–1024`. Valid quick-win.

## This-run queue (ordered)

All tasks are scoped to the "Just Do It" bucket from `CLAUDE.md`: no schema migrations, no new production deps, no auth-middleware changes, no deploys.

| ID | Title | Category | Priority | Risk | Size | Depends on | Audit ref |
|---|---|---|---|---|---|---|---|
| TASK-001 | Remove bogus OSCE `queueAnswer({ questionId: sessionId })` write | Frontend bug | High | Low | S | — | §5 "OSCE mode still has an incorrect answer-queue write"; §10 Quick win #1 |
| TASK-002 | (STALE) `admin/staging/*` Zod validation | API hardening | — | — | — | — | Superseded: all four files already validated via `adminEndpoint`/`adminAuthenticatedEndpoint` wrapper (internally applies `withValidation(schema)`). Script detection gap. |
| TASK-003 | (STALE) `admin/content/*` + `admin/enrich-condition` Zod | API hardening | — | — | — | — | Superseded: validated via wrapper. Script detection gap. |
| TASK-004 | (STALE) `admin/media/approve`, `admin/refinery/action`, `admin/blueprint-coverage`, `admin/conditions/[id]/parent` Zod | API hardening | — | — | — | — | Superseded: validated via wrapper. Script detection gap. |
| TASK-005 | (PARTIAL → split) user-facing write Zod | API hardening | — | — | — | — | Split into TASK-007 (`daily-plan`) + TASK-008 (`exam-outcome`). `performance/record` was already wrapper-validated (generic-call form); `drill/log-attempt` is a 410 Gone tombstone that never reads body. |
| TASK-006 | (STALE) question-pipeline writes Zod | API hardening | — | — | — | — | Superseded: validated via wrapper. Script detection gap. |
| TASK-007 | Zod-harden `POST /api/users/me/daily-plan/complete` | API hardening | High | Low | S | — | §5 "API validation hardening"; §10 Quick win #2 |
| TASK-008 | Zod-harden `POST /api/users/me/exam-outcome` | API hardening | High | Low | S | — | §5 "API validation hardening"; §10 Quick win #2 |
| TASK-009 | Zod-harden `POST /api/podcast/generate` (proxy) | API hardening | Medium | Low | M | — | §5 "API validation hardening" — branch-specific validation: inline `.safeParse()` on JSON path (`.passthrough()` permissive schema), 415 content-type gate, 25 MB multipart size ceiling. External Node service retains authority on multipart field-level shape. |
| TASK-010 | Retire orphaned `/api/questions/review` endpoint (410 tombstone both methods) + delete 3 orphaned service files | Endpoint retirement / dead-code removal | Medium | Low | S | — | "Not doing now" row unparked: caller inventory was clean. `functions/api/srs/submit.ts` narrowing stays parked (active `SrsFlashcardView` caller). |
| TASK-011 | Harden WARN_MANUAL_ONLY multipart endpoints (`knowledge/upload`, `technique-check/analyze`) + document `sentry-tunnel` as intentional steady state | API hardening | Medium | Low | S | — | §5 "API validation hardening" WARN_MANUAL_ONLY tail. 415 content-type gates, 413 Content-Length short-circuits, bounded `query` string (technique-check). `sentry-tunnel` stays `WARN_MANUAL_ONLY` permanently — Sentry envelope format is structurally incompatible with Zod. |

Evidence: after the script fix on 2026-04-16, TASK-002 through TASK-006 dissolved — the files are correctly validated via the shared middleware wrappers and were false positives of the original audit script. The only real file-level gaps were `users/me/daily-plan.ts` and `users/me/exam-outcome.ts` (now TASK-007 / TASK-008). See `docs/implementation/AUDIT_RECONCILIATION.md` for the per-claim reconciliation and the full audit-run deltas.

## Proposed execution order

1. TASK-001 — tiny, unblocks the "OSCE polluting sync/analytics" finding immediately. (done)
2. Fix `scripts/audit-zod-validation.ts` itself so follow-up audits do not keep generating false positives on wrapper-validated endpoints. (done)
3. TASK-007 + TASK-008 — user-facing mutation gaps surfaced by the fixed audit. (done)
4. TASK-009 — podcast/generate proxy gets branch-specific validation. (done; authorized past Ask First gate)
5. TASK-010 — `/api/questions/review` retirement. Caller inventory came back clean → both HTTP methods tombstoned as 410 Gone; 3 orphaned service files deleted. `/api/srs/submit` narrowing still parked (has active caller). (done)
6. TASK-011 — WARN_MANUAL_ONLY tail hardening. `knowledge/upload.ts` and `technique-check/analyze.ts` got 415 content-type gates, 413 `Content-Length` short-circuits, and proper HTTP semantics on oversized rejections. `technique-check/analyze.ts` also got a `MAX_QUERY_CHARS` bound. `sentry-tunnel.ts` documented as intentional `WARN_MANUAL_ONLY` steady state — Sentry envelope format is structurally incompatible with Zod, and its existing DSN + project-ID whitelist + IP rate-limit IS the right validation shape. (done)
7. TASK-012+ — library-enrichment `.disabled` endpoints, loading-state normalization, and the architecture-level items (NotificationLog schema, runtime-owned push scheduler, Express-to-Edge retirement, study-groups decision). Each still requires reading live callers before committing to a change shape.

## Not doing now — parked / deferred

| Item | Reason |
|---|---|
| NotificationLog schema + migration | Prisma migrate → Ask First per `CLAUDE.md`. Needs Aaron's approval. |
| Runtime-owned replacement for GitHub-cron push reminders | Requires `web-push` prod dep + architecture decision → Ask First. |
| Express-to-Edge retirement plan | Architecture change → Ask First; needs route-parity decision. |
| Study-groups/social build-or-freeze | Explicit product decision needed per audit §5. |
| Narrow `functions/api/srs/submit.ts` (drop `srsItemId` branch) + drop `SRSItem` model | Has active caller (`SrsFlashcardView`). Narrowing requires a product decision on whether flashcard practice flips to FSRS. `SRSItem` model drop is a Prisma migration → Ask First. (`functions/api/questions/review.ts` already retired this run — TASK-010.) |
| Library-enrichment admin endpoints re-enable | Two `.disabled` endpoints need data-source decision (files vs DB vs admin API). Ask First. |
| Dead-man-switch alerting | Deferred per audit §10; wait for automation ownership to settle. |
| Automated backup restore verification | Medium-risk ops lane; needs runbook before wiring into weekly maintenance. |
| Loading-state normalization rollout | Scoped but wide UI touch; better handled as its own dedicated sprint after current backend tranche. |
| Auxiliary AI placeholders (Spark instant-calc, Smart Scribe infographic) | Per audit §10: defer unless roadmap activates. |
| Zod `.test.ts` fixtures flagged by improved audit (`authors/submit-question.test.ts`, `questions/attempt.test.ts`, `osce/analysis/grade.test.ts`, `osce/complete.test.ts`) | These are test harness fixtures, not production endpoints. |
| Cron endpoints without Zod (cron/batch-generate-questions, cron/compute-item-metrics, cron/content-quality-loop, cron/generate-daily-insights, cron/generate-variants, cron/push-reminders, cron/reservoir-maintenance) | Cron endpoints are gated by `CRON_SECRET` header, not user input. Adding request-body schemas adds little value; defer until the cron-auth model is reviewed as a unit. |
| Branch-merge endpoint (`branches/[branchName]/merge`), podcast/generate | Lower-risk long tail; pick up in a follow-up pass. |
| WARN (manual-only) endpoints (`knowledge/upload`, `questions/staging/[id]/check`, `sentry-tunnel`, `technique-check/analyze`, `webhooks/clerk`) | `knowledge/upload` + `technique-check/analyze` hardened in TASK-011 (content-type gates, Content-Length short-circuits, HTTP-semantic fixes, query-length bound). `sentry-tunnel` documented as intentional steady state — Sentry envelope format is structurally incompatible with Zod. `webhooks/clerk` has a Svix signature-validation flow; its own audit item. `questions/staging/[id]/check` left for later review. |

## Status legend

- `pending` — queued, not started
- `in_progress` — currently being worked
- `completed` — implementation + verification done
- `partial` — partially completed; follow-up noted
- `obsolete` — no longer applicable after re-inspection
- `deferred` — moved out of this run

## Live status

| ID | Status | Commit | Notes |
|---|---|---|---|
| TASK-001 | completed | 0e0fed16 | OSCE `syncManager.queueAnswer` write removed; `updateConditionSchedule` preserved. |
| TASK-002 | obsolete | — | All admin/staging endpoints already wrapper-validated; script gap produced the false positive. |
| TASK-003 | obsolete | — | All admin/content endpoints already wrapper-validated; script gap produced the false positive. |
| TASK-004 | obsolete | — | All listed admin endpoints already wrapper-validated; script gap produced the false positive. |
| TASK-005 | obsolete | — | Split into TASK-007 + TASK-008. `performance/record` already wrapper-validated (generic-call form). `drill/log-attempt` is a 410 Gone tombstone. |
| TASK-006 | obsolete | — | All question-pipeline writes already wrapper-validated; script gap produced the false positive. |
| TASK-007 | completed | (pending commit) | `users/me/daily-plan.ts` POST switched to `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`. GET unchanged. |
| TASK-008 | completed | (pending commit) | `users/me/exam-outcome.ts` POST rewritten to `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })` with enum/date/range bounds. |
| TASK-009 | completed | (pending commit) | `podcast/generate.ts` now content-type gated (415 for non-JSON/non-multipart), JSON branch runs `PodcastGenerateJsonSchema.safeParse()` with `.passthrough()`, multipart branch 413s above 25 MB. Audit: 1 FAIL remaining (log-attempt tombstone, expected). |
| TASK-010 | completed | `fbad2689` (code) / `6771368a` (docs) | `functions/api/questions/review.ts` tombstoned (both GET and POST → 410 Gone with migration pointers). Deleted `lib/services/review/reviewSubmissionService.ts`, `lib/services/review/reviewService.ts`, `lib/services/review/reviewService.test.ts`, and the now-empty `lib/services/review/` directory. Caller inventory was clean — no UI/hook/store importers. Audit: 2 FAILs, both tombstones, expected. |
| TASK-011 | completed | (pending commit) | `functions/api/knowledge/upload.ts` + `functions/api/technique-check/analyze.ts` hardened with 415 content-type gates, 413 `Content-Length` short-circuits, and proper HTTP-semantic rejections (oversized now 413 not 400). `technique-check/analyze.ts` also bounded `query` to `MAX_QUERY_CHARS = 2000`. `functions/api/sentry-tunnel.ts` left unchanged and documented as intentional `WARN_MANUAL_ONLY` steady state (Sentry envelope protocol is structurally incompatible with Zod; DSN + project-ID whitelist + IP rate-limit IS the right shape). Audit: 176/8/3/2 unchanged — hardening tightens manual validation within the WARN bucket without moving endpoints between buckets. |
