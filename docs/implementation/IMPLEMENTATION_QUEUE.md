# Implementation Queue

Derived from `UNFINISHED_WORK_MASTER_AUDIT.md` (2026-04-16) and cross-checked against current code on 2026-04-16.

## Source-of-truth reconciliation notes

Before queueing tasks, I re-validated the audit's specific claims against current code and re-ran (improved, middleware-aware) versions of the repo-native audit tools. Findings that change the queue:

- **Audit's named "still flagged" Zod endpoints are already validated**: `functions/api/exam/start.ts`, `functions/api/exam/complete.ts`, `functions/api/feedback/submit.ts`, `functions/api/srs/sync.ts`, `functions/api/drills/submit-review.ts` all use `authenticatedEndpoint(Schema, handler)`, which internally runs `withValidation(schema)`. The audit script `scripts/audit-zod-validation.ts` has a detection gap — it does not recognize the wrapper pattern and therefore classifies these as FAIL.
- **Improved Zod audit (wrapper-aware)** on 2026-04-16 reports: 193 mutation endpoints, 154 PASS, 5 WARN (manual-only), 34 FAIL — of which 4 are `.test.ts` files (test harnesses, not real endpoints). **30 real endpoints** need Zod validation.
- **Prisma disconnect audit** flagged 3 files, all of which are false positives: `_shared/env-validation.ts` (match is in a JSDoc example comment), `_shared/prisma-user-scope.ts` (factory — caller owns disconnect), `functions/api/health.ts` (DOES disconnect, via an indirect `disconnect = ...; await disconnect(prisma)` pattern my regex missed). **Prisma disconnect cleanup is effectively complete.** The audit's "18 fails" is stale.
- **OSCE bogus `queueAnswer({ questionId: sessionId })`** — confirmed present at `components/modes/PatientEncounterMode.tsx:1015–1024`. Valid quick-win.

## This-run queue (ordered)

All tasks are scoped to the "Just Do It" bucket from `CLAUDE.md`: no schema migrations, no new production deps, no auth-middleware changes, no deploys.

| ID | Title | Category | Priority | Risk | Size | Depends on | Audit ref |
|---|---|---|---|---|---|---|---|
| TASK-001 | Remove bogus OSCE `queueAnswer({ questionId: sessionId })` write | Frontend bug | High | Low | S | — | §5 "OSCE mode still has an incorrect answer-queue write"; §10 Quick win #1 |
| TASK-002 | Add Zod validation to `admin/staging/*` (approve, reject, run-critic, update) | API hardening | High | Low | M | — | §5 "API validation hardening"; §10 Quick win #2 |
| TASK-003 | Add Zod validation to `admin/content/create`, `admin/content/transition`, `admin/enrich-condition` | API hardening | High | Low | M | — | §5 "API validation hardening" |
| TASK-004 | Add Zod validation to `admin/media/approve`, `admin/refinery/action`, `admin/blueprint-coverage`, `admin/conditions/[id]/parent` | API hardening | High | Low | M | — | §5 "API validation hardening" |
| TASK-005 | Add Zod validation to user-facing writes: `users/me/daily-plan`, `users/me/exam-outcome`, `performance/record`, `drill/log-attempt` | API hardening | High | Low | M | — | §5 "API validation hardening" |
| TASK-006 | Add Zod validation to question-pipeline writes: `questions/curate`, `questions/flag/[flagId]/resolve`, `questions/seeds/*`, `questions/staging/*` | API hardening | High | Low | M | — | §5 "API validation hardening" |

Evidence for each: every file listed was inspected and lacks both a `withValidation(schema)` middleware wrapper and a direct `.safeParse`/`.parse` call. See `/tmp/zod-audit-output.txt` for the full improved-audit run.

## Proposed execution order

1. TASK-001 — tiny, unblocks the "OSCE polluting sync/analytics" finding immediately.
2. TASK-002 → TASK-004 — admin surface first (biggest blast radius per endpoint hit; all use the same shared middleware pattern so the repetition accelerates through the cluster).
3. TASK-005 — user-facing mutations second (cheaper blast radius per request, but higher request volume).
4. TASK-006 — content pipeline last (mostly cron-adjacent and seed/staging tools; lower request rate, still worth validating).

After TASK-006 I stop the run: the next tranche in the master audit (NotificationLog schema migration, runtime-owned scheduler, Express retirement, study-groups decision, deprecated SRS endpoint retirement) requires Aaron's "Ask First" approvals per `CLAUDE.md`.

## Not doing now — parked / deferred

| Item | Reason |
|---|---|
| NotificationLog schema + migration | Prisma migrate → Ask First per `CLAUDE.md`. Needs Aaron's approval. |
| Runtime-owned replacement for GitHub-cron push reminders | Requires `web-push` prod dep + architecture decision → Ask First. |
| Express-to-Edge retirement plan | Architecture change → Ask First; needs route-parity decision. |
| Study-groups/social build-or-freeze | Explicit product decision needed per audit §5. |
| Retire deprecated SRS endpoints (`functions/api/questions/review.ts`, narrow `functions/api/srs/submit.ts`) | Needs active-caller inventory + product sign-off on lifecycle; medium risk if clients still hit it. |
| Library-enrichment admin endpoints re-enable | Two `.disabled` endpoints need data-source decision (files vs DB vs admin API). Ask First. |
| Dead-man-switch alerting | Deferred per audit §10; wait for automation ownership to settle. |
| Automated backup restore verification | Medium-risk ops lane; needs runbook before wiring into weekly maintenance. |
| Loading-state normalization rollout | Scoped but wide UI touch; better handled as its own dedicated sprint after current backend tranche. |
| Auxiliary AI placeholders (Spark instant-calc, Smart Scribe infographic) | Per audit §10: defer unless roadmap activates. |
| Zod `.test.ts` fixtures flagged by improved audit (`authors/submit-question.test.ts`, `questions/attempt.test.ts`, `osce/analysis/grade.test.ts`, `osce/complete.test.ts`) | These are test harness fixtures, not production endpoints. |
| Cron endpoints without Zod (cron/batch-generate-questions, cron/compute-item-metrics, cron/content-quality-loop, cron/generate-daily-insights, cron/generate-variants, cron/push-reminders, cron/reservoir-maintenance) | Cron endpoints are gated by `CRON_SECRET` header, not user input. Adding request-body schemas adds little value; defer until the cron-auth model is reviewed as a unit. |
| Branch-merge endpoint (`branches/[branchName]/merge`), podcast/generate | Lower-risk long tail; pick up in a follow-up pass. |
| WARN (manual-only) endpoints (`knowledge/upload`, `questions/staging/[id]/check`, `sentry-tunnel`, `technique-check/analyze`, `webhooks/clerk`) | Already have manual validation; lower priority than FAIL endpoints. `webhooks/clerk` has a special signature-validation flow that is its own audit item. |

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
| TASK-001 | pending | — | — |
| TASK-002 | pending | — | — |
| TASK-003 | pending | — | — |
| TASK-004 | pending | — | — |
| TASK-005 | pending | — | — |
| TASK-006 | pending | — | — |
