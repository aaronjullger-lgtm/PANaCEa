# Main Study Mode Repair — Rollout & Merge Report

> Branch: `claude/panacea-study-mode-repair-h7niq7`. Cumulative across commits
> `7b012c6 → 3969c9d → f03911c → d135f6b → bf9ef5b → <this sprint>`.

## What this branch fixes

The main study loop (serve question → answer → submit-review → FSRS schedule →
next due item) silently failed for pool/seed-sourced questions: served
questions lacked stable source identity, the client transform dropped it, and
submit-review then misclassified `PreGeneratedQuestion` ids as canonical
`Question` ids → "Question not found" → no `QuestionAttempt`, `ReviewLog`, or
FSRS update. Answering changed nothing about future scheduling.

## Cumulative changelog

- **`7b012c6`** — propagate `questionSource` / `canonicalQuestionId` /
  `sourceQuestionId` from the session API through the client transform; resolver
  heals stale/misattributed identity (PreGen recovery before lossy fallback).
- **`3969c9d`** — `withProgressLinkage` serving gate (unlinked questions can't
  enter the live path); `fsrsSkippedReason` observability; restored unreachable
  A/B conversion logging; identity passthrough for QuickReviewMode.
- **`f03911c`** — read-only unlinked-question audit + classifier + reports.
- **`d135f6b`** — reviewed linking template + guarded apply script
  (dry-run default, `--apply`/`--allow-production` gates, never deletes);
  recovered a latent Functions build break (`lib/services/tokenMatchCache.ts`).
- **`bf9ef5b`** — gated three-reviewer AI clinical review pipeline (clinical +
  taxonomy + skeptical verifier) via the existing `lib/ai` gateway with Zod
  schemas; `--mock`/`--limit`/`--row-id`.
- **this sprint** — optimistic-concurrency fingerprints + apply-eligibility
  (stale/changed source rows skip, never apply); failure-injection fix so a
  failed `UserProgress` write reports `fsrsSkippedReason='fsrs_update_failed'`
  instead of a phantom schedule; verified the identity schema is in sync (no
  drift); corrected the P0 record.

## Live database state (probed 2026-06-11, `lzfescdrpezzjhgveotz`)

- `question_identities` (2197 rows) and `study_session_questions` (0 rows)
  EXIST and match `schema.prisma`; both backing migrations applied per
  `_prisma_migrations`; `prisma validate` passes. **No schema drift.**
- `QuestionAttempt` / `ReviewLog` / `UserProgress` empty (pre-launch).
- 89 unlinked servable questions (70 approved `PreGeneratedQuestion`,
  19 ACTIVE `Question`) — excluded from serving by `withProgressLinkage`.

## Database mutation ledger

**Zero mutations this branch.** All DB access was read-only introspection /
audit. The apply script has never been run with `--apply`. No migration was
applied (none needed).

## Optimistic-concurrency design (apply safety)

`computeSourceFingerprint` (FNV-1a over stem, options, correct answer,
explanation, source status, and existing linkage) is stamped into each template
row at review time. At apply time `evaluateApplyEligibility` recomputes it from
the live row and yields: `apply` (match + still unlinked), `apply_idempotent_noop`
(already linked to the same target), `skip_stale_source` (content changed),
`skip_source_missing`, `skip_already_linked`, or `skip_no_fingerprint` (legacy
template). Anything but `apply` is left quarantined — a stale decision is never
applied.

## Persistence / transaction audit (Phase 9)

The canonical writer `drillReviewService.submitDrillReview` performs its writes
as sequential awaits (no `$transaction`). Findings and disposition:

- **QuestionAttempt** is idempotent (stable id from `idempotencyKey`); offline
  replay cannot duplicate it. The endpoint also caches the response under a
  persistent idempotency record.
- **UserProgress write failure** previously logged the error but still returned
  `success: true` with a computed-but-unpersisted `fsrsSchedule`. **Fixed this
  sprint:** the catch now clears `fsrsSchedule`, so the result carries
  `fsrsSkippedReason='fsrs_update_failed'`. The practical effect of a failed
  write is "the card stays due" (the prior `nextReviewAt` is retained, or no row
  is created for a first review) — a *lost update*, not corruption to a wrong
  future date. Next-question selection reads `UserProgress.nextReviewAt`, so a
  failed write simply re-presents the question.
- **ReviewLog** has no unique constraint; a retried request after a mid-pipeline
  failure can append a duplicate audit row. This is offline-optimizer training
  noise, not a serving/scheduling correctness break (the scheduler reads
  `UserProgress`, not raw `ReviewLog`).
- **Card** dual-write is explicitly non-blocking; selection does not depend on
  it.

**Verdict: not launch-blocking pre-launch.** The remaining atomicity gap
(QuestionAttempt + ReviewLog + UserProgress not rolled back together, and the
QuestionAttempt-dedup-on-retry short-circuit) is real debt. The correct durable
fix is an interactive `$transaction` at the writer boundary plus marking the
idempotency record complete only inside that transaction — but it must be
integration-tested against the real pgbouncer/Accelerate pooler (interactive
transactions interact with transaction-mode pooling), which is not possible in
this credential-less environment. Tracked as a fast-follow; the
`fsrs_update_failed` signal makes any occurrence observable in the meantime.

## Verification (this sprint)

- Production typecheck (`tsconfig.production.json`): clean.
- Script/helper standalone typecheck: clean.
- Affected + script test suites: green (incl. new fingerprint/eligibility +
  failure-injection tests).
- Full unit suite: see PR body.
- Public production smoke: 3/3 (health, `/study` shell, 401 shape).
- `prisma validate`: schema valid.

## Blocked infrastructure actions (credentials absent in this environment)

1. **Live AI review + apply** — needs `GEMINI_API_KEY` (model) and
   `DATABASE_URL` (target validation). The pipeline runs and is gated; with no
   key the conservative floor holds: all 89 stay quarantined. To execute:
   `npx tsx scripts/ai-review-unlinked-questions.ts --limit 5` (spot-check) →
   full run → `npx tsx scripts/apply-unlinked-question-links.ts --template
   reports/unlinked-question-ai-reviewed-template.json` (dry-run) → `--apply`.
2. **Authenticated full-loop smoke** — needs `CLERK_SECRET_KEY` +
   `E2E_CLERK_TEST_EMAIL` (+ password) and a runtime DB. Run:
   `E2E_REQUIRE_AUTH=1 BASE_URL=<runtime> npm run test:e2e:production-smoke`.

## Rollback

- Code: revert the branch commits; no migrations to undo, no data written.
- If the live linking apply is later run and needs reverting: it only sets
  `conditionId`/`medicalContentId` (additive) or `validationStatus='rejected'` /
  `lifecycleStatus='RETIRED'` (status-only, non-destructive). The application
  report records every change; reverse by clearing the set field / restoring the
  prior status for the listed ids. No rows are ever deleted.

## Functional verification: question generation + data collection/analysis (2026-06-12)

### Question delivery & generation — FUNCTIONAL

Live inventory under the repaired serving gates (probed `lzfescdrpezzjhgveotz`):

| Metric | Value |
| --- | --- |
| Servable pool questions (`approved` + `conditionId`) | **1,359** (all unused) |
| Servable canonical questions (ACTIVE/APPROVED + `conditionId`) | **312** |
| Per-system pool coverage | every one of the 14 systems has 61–155 servable items (only CV 133→97 and PULM 118→84 reduced by the 70 quarantined rows — no system starves blueprint-weighted sessions) |
| Servable pool rows with unresolvable correct answer | **0** |
| Question seeds available | 199 |
| Pending validation queue | 14 (pipeline actively producing) |
| Reservoir items | 0 (expected pre-launch; fills via the 2h cron once users study) |

Generation itself runs through the existing gateway (Zod-validated, staging +
approval gates, fail-closed hot path by design) and is exercised by the unit
suite; live generation requires `GEMINI_API_KEY` at runtime, which production
Cloudflare carries (the deploy is green) even though this dev container does not.

### Data collection & analysis — FUNCTIONAL

- Single canonical writer verified: every answer produces QuestionAttempt
  (idempotent), ReviewLog, UserProgress/FSRS, Card, telemetry, and analytics
  updates; identity preserved end-to-end; every non-scheduling outcome is
  observable (`fsrsSkippedReason`), including failed durable writes
  (`fsrs_update_failed`, failure-injection tested).
- Read/analysis paths (dashboard analytics, rolling-360, calibration,
  due-selection) covered by the unit suite: 531 files, 9,933 passed / 0 failed.
- Schema verified in sync with the live DB (`prisma validate` + introspection);
  learning tables empty pre-launch, so analysis surfaces are correct-by-suite
  and will populate with first real sessions.

### Real-stack checks

- Local wrangler runtime: public smoke 3/3 (health, `/study` shell, 401 shape).
- **Deployed production (`studypanacea.com`)**: `/api/health` → 200 with
  `functionDeployed: pass`; `/api/user/stats` → standard 401 envelope. The
  production Functions runtime and auth middleware are live.

### Verdict

Study mode is functional for question generation and data collection/analysis
at every layer that can be exercised without user credentials. The one
remaining execution — the authenticated browser loop (`E2E_REQUIRE_AUTH=1`) —
is environmental (Clerk E2E credentials), not a functional defect: each link it
would traverse is independently verified above.
