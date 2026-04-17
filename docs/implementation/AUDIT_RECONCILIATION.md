# Audit Reconciliation

Per-claim reconciliation between `UNFINISHED_WORK_MASTER_AUDIT.md` (repo root) and actual code as of 2026-04-16. This file is **additive** — it does not rewrite the master audit. It records which audit claims were verified, which were stale, and what was done.

Classification values:
- `accurate` — audit matches code; fix is real work.
- `stale` — audit is out of date; the issue is already fixed in code.
- `already fixed` — synonym for stale but called out when the fix happened in a prior sprint.
- `addressed-this-run` — accurate when queued, fixed during this run.
- `parked` — accurate, but deferred (see `IMPLEMENTATION_QUEUE.md` deferred list).
- `partial` — partly accurate; scope narrower or broader than audit states.

---

## 2026-04-16 reconciliation pass

### §5 "API validation hardening — 145 endpoints fail audit:zod"

- **Original claim:** 145 endpoints fail `npm run audit:zod`. Named examples: `functions/api/exam/start.ts`, `functions/api/exam/complete.ts`, `functions/api/feedback/submit.ts`, `functions/api/srs/sync.ts`, `functions/api/drills/submit-review.ts`, plus "all admin mutations."
- **Verification:** Re-read each named file on 2026-04-16. All five use the middleware wrapper pattern `authenticatedEndpoint(Schema, handler)` which internally calls `withValidation(schema)`. These are properly Zod-validated.
- **Root cause of false positives:** `scripts/audit-zod-validation.ts` had four independent detection gaps, each compounding the false-positive count:
  1. It did not recognize the seven shared middleware wrappers (`authenticatedEndpoint`, `adminEndpoint`, `adminAuthenticatedEndpoint`, `aiEndpoint`, `refineryEndpoint`, `cmsEndpoint`, `publicEndpoint`) as validated call sites. The wrappers internally compose `withValidation(schema)`; the audit only looked for `validateRequest(`, `.safeParse(`, or `.parse(` literally.
  2. Its `.parse(` detection matched `JSON.parse(` as evidence of Zod. Any file that parsed a request body via `JSON.parse(...)` was erroneously classified PASS for the wrong reason, and any file using Zod only via a wrapper was classified FAIL.
  3. It did not handle the TypeScript generic call form `authenticatedEndpoint<Input>(...)`. Strongly-typed wrapper usages (e.g. `functions/api/performance/record.ts`) were flagged FAIL.
  4. It did not treat CRON_SECRET bearer-auth or Svix webhook signature verification as legitimate out-of-band security models — cron endpoints and `webhooks/clerk.ts` were flagged FAIL even though Zod is structurally not the right tool for them.
- **Fix applied this run:** `scripts/audit-zod-validation.ts` was rewritten. Detection now:
  - Enumerates all seven wrappers in `VALIDATED_WRAPPERS`.
  - Allows an optional TS generic argument between the wrapper name and its `(`: `\b${name}\s*(?:<[^>]*>)?\s*\(`.
  - Recognizes `withValidation(...)` composition anywhere in a file.
  - Rejects `JSON.parse(` via a line-scan that inspects the preceding token.
  - Classifies CRON_SECRET (`/\.CRON_SECRET\b/` + `Authorization|Bearer`) and Svix webhook patterns as `WARN_OUT_OF_BAND` — Zod not applicable.
  - Excludes `.test.ts` and `.disabled` paths from consideration.
- **Post-fix audit run on 2026-04-16:**
  - 176 PASS.
  - 8 WARN_OUT_OF_BAND (7 cron endpoints + `webhooks/clerk`).
  - 3 WARN_MANUAL_ONLY (`knowledge/upload` — multipart; `technique-check/analyze` — multipart; `sentry-tunnel` — Sentry envelope proxy).
  - **2 FAIL**: `drill/log-attempt.ts` (deprecated 410 Gone tombstone that never reads the body) and `podcast/generate.ts` (proxy forwarding to external Node service).
- **Classification of specific named endpoints (exam/start, exam/complete, feedback/submit, srs/sync, drills/submit-review, and "all admin mutations"):** `stale`.
- **Classification of the umbrella "145 endpoints" claim:** `stale` — the number was an artifact of the detection gap, not real risk.
- **Classification of the residual file-level work:** `accurate` for `users/me/daily-plan.ts`, `users/me/exam-outcome.ts`, and `podcast/generate.ts` — all three addressed this run (TASK-007, TASK-008, TASK-009 respectively).
- **Deferred from this run:**
  - 7 cron endpoints (CRON_SECRET-gated; Zod not applicable).
  - `webhooks/clerk` (Svix signature; Zod not applicable).
- **Hardened this run (still `WARN_MANUAL_ONLY` by design, but with tightened manual validation):**
  - `knowledge/upload.ts` — added 415 content-type gate + 413 `Content-Length` short-circuit before `formData()` materializes up to 50 MB. Post-materialization `file.size` guard retained. (TASK-011)
  - `technique-check/analyze.ts` — flipped wrong-content-type 400 → 415 and oversized-video 400 → 413, added 413 `Content-Length` short-circuit before `formData()` materializes up to 20 MB, bounded `query` to `MAX_QUERY_CHARS = 2000` to prevent pathological Gemini prompts. (TASK-011)
  - `sentry-tunnel.ts` — **no change; intentional steady state.** Sentry envelopes are a newline-delimited streaming format owned by Sentry's SDK; the correct contract-matching validation is DSN extraction + project-ID whitelist (already present) plus per-IP rate limiting (already present). Zod does not structurally fit. (TASK-011)
- **Remaining FAIL after this run:** 2 — `functions/api/drill/log-attempt.ts` and `functions/api/questions/review.ts`, both deliberate 410 Gone tombstones that never read their request bodies. Real risk = 0; both parked with tombstone annotations. (`review.ts` became a tombstone in TASK-010 this run; `log-attempt.ts` was already a tombstone before this run.)

### §5 "Audit script detection gaps (meta)"

- **Classification:** `addressed-this-run`.
- **What changed:** `scripts/audit-zod-validation.ts` rewritten as described above. Also gained `WARN_OUT_OF_BAND` status and richer `AuditResult` fields (`usesWrapper`, `usesWithValidation`, `usesCronSecret`, `usesSvixWebhook`, `note`).
- **Impact:** Future `npm run audit:zod` runs produce a signal that's actually actionable. Without this fix, every sprint would have kept re-surfacing the same phantom 145-endpoint list.

### §5 "Prisma disconnect cleanup — 18 endpoints still flagged"

- **Original claim:** 18 endpoints still fail `npm run audit:prisma` — Prisma clients created without `safePrismaDisconnect` in finally.
- **Verification:** Ran improved Prisma audit (wrapper-aware) on 2026-04-16. Result: 354 PASS, 3 FAIL.
- **The 3 "fails" are all false positives:**
  - `functions/api/_shared/env-validation.ts` — the match is inside a JSDoc example comment, not real code.
  - `functions/api/_shared/prisma-user-scope.ts` — this is a factory (caller owns disconnect lifecycle).
  - `functions/api/health.ts` — does disconnect, via an indirect alias: `const disconnect = prismaEdge.safePrismaDisconnect; await disconnect(prisma)`. Regex-based audit misses the rebinding.
- **Classification:** `stale` / `already fixed`. Prisma disconnect cleanup is effectively complete.
- **Action this run:** none. No task queued.

### §5 "OSCE mode still has an incorrect answer-queue write"

- **Original claim:** `components/modes/PatientEncounterMode.tsx` writes `syncManager.queueAnswer({ questionId: sessionId, ... })` at the end of an OSCE session — pushing a fake review into the FSRS/analytics pipeline. OSCE is not a MAIN or DRILL session type and must not feed FSRS artifacts.
- **Verification:** Re-read `components/modes/PatientEncounterMode.tsx:1009–1024` on 2026-04-16. Block is present exactly as described, with `questionId: sessionId` (not a real question id), a fabricated rating (`isPass ? 3 : 1`), and `isMainSession: false` which nominally gates the FSRS path but still writes into the sync queue and downstream analytics.
- **Classification:** `accurate` — queued as TASK-001.
- **Scope of fix:** Remove the `syncManager.queueAnswer({...})` call and its argument block. Keep the adjacent `updateConditionSchedule(currentCase.id, ...)` call intact (condition-level spaced repetition is the appropriate OSCE artifact). Keep the enclosing `if (currentCase)` wrapper — `updateConditionSchedule` still needs it.
- **Parked follow-up (product decision, not code):** whether OSCE should emit a dedicated analytics event, a real review artifact for condition-level retention tracking, or no SRS artifact at all. Out of scope for this run.

### §5 "NotificationLog schema + migration"

- **Classification:** `accurate`. Requires Prisma migrate → Ask First per CLAUDE.md.
- **Action this run:** deferred. Listed under "Not doing now" in `IMPLEMENTATION_QUEUE.md`.

### §5 "Runtime-owned replacement for GitHub-cron push reminders"

- **Classification:** `accurate`. Requires `web-push` production dependency + architecture decision. Ask First.
- **Action this run:** deferred.

### §5 "Express-to-Edge retirement"

- **Classification:** `accurate`. Architecture change → Ask First; needs route-parity audit.
- **Action this run:** deferred.

### §5 "Study-groups / social build-or-freeze"

- **Classification:** `accurate`. Product decision required.
- **Action this run:** deferred.

### §5 "Retire deprecated SRS endpoints"

- **Classification (original):** `accurate`. Needs active-caller inventory + product sign-off on lifecycle; medium risk if clients still hit these endpoints.
- **Action this run:** `functions/api/questions/review.ts` addressed via TASK-010 after a clean caller inventory (the endpoint was orphaned at the application level; only the companion client service `reviewSubmissionService.ts` called it, and it had no UI importers). `functions/api/srs/submit.ts` remains parked — it still has an active caller (`SrsFlashcardView`) sending `srsItemId`, which means narrowing it involves a product decision about whether flashcard practice switches to the FSRS pipeline.

### §6 "Library-enrichment admin endpoints (.disabled)"

- **Classification:** `accurate`. Two `.disabled` endpoints need a data-source decision (files vs DB vs admin API) before re-enable. Ask First.
- **Action this run:** deferred.

### §7 "Dead-man-switch alerting"

- **Classification:** `accurate`. Deferred per audit §10; wait for automation ownership to settle.
- **Action this run:** deferred.

### §7 "Automated backup restore verification"

- **Classification:** `accurate`. Medium-risk ops work; needs runbook before wiring into weekly maintenance.
- **Action this run:** deferred.

### §7 "Loading-state normalization rollout"

- **Classification (original):** `accurate`. Wide UI touch; better handled as its own dedicated sprint after current backend tranche.
- **Classification (post-TASK-012):** `partial`. First tranche addressed — the four highest-traffic session/mode full-page loading blocks (CoreAdaptiveSession `isLoading` + Suspense fallback, CramMode `!currentQuestion` guard, GrandRoundsMode `viewState === 'loading'` + `!currentQuestion` guard) now use the canonical `DrillLoadingState`.
- **Classification (post-TASK-013):** `partial` (narrower scope). Second tranche addressed this run — the canonical `InlineButtonSpinner` primitive was added to `components/loading/index.tsx` and the 8 inline button spinners deferred by TASK-012 (3 in GrandRoundsMode, 5 in PatientEncounterMode) all migrated to it. Remaining parked scope: (a) CramMode's real-progress generation block is an intentional steady state (canonical skeletons cannot represent `{completed}/{total}` counts); (b) ~25 other files flagged by the `animate-spin` grep (library, dashboard, command palette, my-library, admin, etc.) require a classify-then-migrate sweep per cluster — some are inline-button candidates for the new primitive, some are full-container blocks for `DrillLoadingState` / `ClinicalSkeleton` / `StreamingSkeleton`, a handful are likely intentional non-loading spinners.
- **Action this run:** closed the inline-button-spinner cluster in the two active encounter-style mode shells; remainder stays deferred to TASK-014+.

### §7 "Auxiliary AI placeholders (Spark instant-calc, Smart Scribe infographic)"

- **Classification:** `accurate` but low-priority per audit §10.
- **Action this run:** deferred.

### §10 Quick-win recommendations

- **Quick win #1 (OSCE queueAnswer):** addressed this run via TASK-001.
- **Quick win #2 (admin staging Zod):** addressed this run via TASK-002.
- Remaining quick wins fold into TASK-003…TASK-006.

---

## Per-task reconciliation entries

<!-- One short block added per task as it completes, recording which audit claim the change closes. -->

### TASK-001 (commit `0e0fed16`) → §5 OSCE queueAnswer write
- Classification updated to **addressed-this-run**.
- Bogus `syncManager.queueAnswer({ questionId: sessionId, ... })` removed from `components/modes/PatientEncounterMode.tsx`; `updateConditionSchedule(...)` retained.
- Parked follow-up: strategic question of whether OSCE should ever emit a review artifact (none / analytics event / OSCEAttempt pipeline) — product decision.

### TASK-007 → §5 `users/me/daily-plan.ts` POST Zod gap
- Classification updated to **addressed-this-run**.
- Switched `onRequestPost` from raw `withMiddleware(...)` to `authenticatedEndpoint(DailyPlanCompleteSchema, handler, { requestsPerMinute: 30 })`. Schema clamps `accuracy` to 0..1 and `durationMinutes` to 0..1440. GET handler untouched (no body).

### TASK-008 → §5 `users/me/exam-outcome.ts` POST Zod gap
- Classification updated to **addressed-this-run**.
- Rewrote `onRequestPost` to `authenticatedEndpoint(ExamOutcomeSchema, handler, { requestsPerMinute: 30 })`. Schema enforces `examType` enum, ISO `examDate` refine, 0..100 score/percentile, and 0..86400 bounds on `timeLimit` / `timeUsed`.

### TASK-009 → §5 `podcast/generate.ts` POST Zod gap (proxy)
- Classification updated to **addressed-this-run** (authorized past the original Ask-First deferral).
- Kept the custom `withMiddleware` chain (required because `withValidation` can't handle multipart). Added branch-specific validation: 415 content-type gate, `PodcastGenerateJsonSchema.safeParse()` with `.passthrough()` on the JSON branch, and a 25 MB `Content-Length` ceiling on the multipart branch before `formData()` parses.
- Audit state after this task: **177 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 1 FAIL** (`drill/log-attempt.ts` 410 tombstone — no action needed).

### Audit-script fix → meta
- Classification **addressed-this-run**.
- `scripts/audit-zod-validation.ts` rewritten to cover the seven shared middleware wrappers, the TS-generic call form, CRON_SECRET / Svix out-of-band security, and to reject `JSON.parse(` as false Zod evidence. Post-fix FAIL count is 2 (log-attempt tombstone + podcast/generate proxy), matching reality.

### TASK-010 → "Retire deprecated SRS endpoints" (partial — `/api/questions/review` only)
- Classification updated to **addressed-this-run** (for `functions/api/questions/review.ts`).
- Tombstoned both `onRequestGet` and `onRequestPost` with 410 Gone + migration pointers (`POST /api/drills/submit-review` for writes; proactive reservoir for reads). Deleted three orphaned files: `lib/services/review/reviewSubmissionService.ts`, `lib/services/review/reviewService.ts`, `lib/services/review/reviewService.test.ts`. Removed the now-empty `lib/services/review/` directory.
- Caller inventory (2026-04-16): zero UI/hook/store importers of the deleted client service; only reference outside the retired files was the endpoint's own JSDoc and 3 historical audit docs.
- Audit state after this task: **176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 2 FAIL** (`drill/log-attempt.ts` + `questions/review.ts` — both deliberate 410 tombstones, both expected).
- Still parked: `functions/api/srs/submit.ts` (active caller in `SrsFlashcardView`) and the `SRSItem` model itself (requires schema migration → Ask First).

### TASK-011 → §5 WARN_MANUAL_ONLY tail (`knowledge/upload`, `technique-check/analyze`, `sentry-tunnel`)
- Classification updated to **addressed-this-run** for the two multipart endpoints; **structurally correct / intentional steady state** for `sentry-tunnel`.
- `knowledge/upload.ts`: added `415` content-type gate and `413` `Content-Length` short-circuit before `formData()` materializes up to 50 MB. JSDoc updated with "Validation model" block. Defense-in-depth `file.size` guard retained.
- `technique-check/analyze.ts`: flipped wrong-content-type from `400` to `415`; flipped oversized-video from `400` to `413`; added `413` `Content-Length` short-circuit before `formData()` materializes up to 20 MB; added `MAX_QUERY_CHARS = 2000` bound on the `query` field to prevent pathological Gemini prompts. JSDoc updated.
- `sentry-tunnel.ts`: **no code change.** The endpoint's validation surface (DSN extraction + project-ID whitelist + per-IP in-memory rate limit) is structurally correct for a Sentry envelope proxy. Sentry envelopes are newline-delimited streaming JSON owned by Sentry's SDK — Zod cannot validate that shape. This endpoint stays `WARN_MANUAL_ONLY` permanently by design, and future audit passes should not re-queue it.
- Caller contract check: `MyLibraryPage.tsx` (knowledge/upload), `TechniqueCheckPage.tsx` (technique-check/analyze), and `lib/monitoring/sentry.ts` (sentry-tunnel via Sentry SDK) all send compliant requests and are not affected by the new gates under normal operation.
- Audit state after this task: **176 PASS, 8 WARN_OUT_OF_BAND, 3 WARN_MANUAL_ONLY, 2 FAIL** — unchanged, by design. The audit script classifies by code-shape, not validation depth; the hardening tightens manual validation within the bucket without moving endpoints between buckets.

### TASK-012 → §6/§7 "Loading-state normalization rollout" (partial — full-page session/mode loaders)
- Classification updated from `accurate` / `deferred` → **`partial`** (first tranche addressed).
- `components/session/CoreAdaptiveSession.tsx`: added `import { DrillLoadingState } from '@/components/loading'`; replaced the `isLoading` return block's handrolled `animate-spin rounded-full h-10 w-10 border-...` div with `<DrillLoadingState message="Resolving your study plan..." variant="question" showTimer showProgress />`; replaced the `<Suspense fallback={...}>` inner handrolled spinner with `<DrillLoadingState message="Preparing your questions..." variant="question" showTimer showProgress />`.
- `components/modes/CramMode.tsx`: added `DrillLoadingState` import; replaced the `!currentQuestion` guard block's `Loader2` spinner with `<DrillLoadingState message="Loading question..." variant="question" showTimer showProgress />`. **Intentionally left the generation-progress block untouched** — it uses `Loader2` alongside a real `{completed}/{total}` progress bar driven by `loadingProgress`; canonical primitives cannot represent real progress counts without losing the UX value. `Loader2` import retained for that block.
- `components/modes/GrandRoundsMode.tsx`: added `DrillLoadingState` import; replaced the `viewState === 'loading'` block with `<DrillLoadingState message={`Loading ${modeLabel}...`} ... />` (preserving the Grand Rounds / Targeted Daily Question template); replaced the `!currentQuestion` guard with `<DrillLoadingState ... />`. **Intentionally left three inline button spinners (lines 702, 1027, 1194) untouched** — they are scoped in-button feedback and need a canonical `InlineButtonSpinner` primitive that does not yet exist. `Loader2` import retained.
- `components/modes/PatientEncounterMode.tsx`: surveyed, **not modified this sprint.** All five remaining spinners in this file are inline button feedback matching the GrandRoundsMode pattern and are deferred to the same `InlineButtonSpinner` follow-up.
- Verification: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` completed via Desktop Commander background runner. Zero errors in any of the three touched files or in `components/loading/index.tsx`; pre-existing 1,152 repo-wide error lines unchanged (all in unrelated `services/optimizer/*`, `services/imageOptimizationService.ts`, `functions/api/admin/refinery/action.ts`). No regression test surface (zero existing tests referencing the touched components or `DrillLoadingState`). Behavioral parity verified — `DrillLoadingState`'s `min-h-[500px]` wrapper + centered content column replaces the bespoke containers correctly and adds `aria-live` / `role="status"` affordances the bespoke spinners lacked. Diff footprint: 3 files, ~40 lines removed, ~25 lines added, net −15 lines.
- Audit state after this task: Zod audit unchanged (176 PASS / 8 WARN_OUT_OF_BAND / 3 WARN_MANUAL_ONLY / 2 FAIL) — this task is a frontend consolidation and does not touch `functions/api/**`. §6/§7 "Loading-state normalization" moves from `deferred` to `partial`.
- Still deferred: (a) inline button spinners (3 GrandRoundsMode + 5 PatientEncounterMode) pending an `InlineButtonSpinner` primitive task; (b) CramMode's real-progress generation block (intentional steady state until canonical primitives gain a `ProgressWithCount` variant); (c) the ~25 other `animate-spin` occurrences in components (library, dashboard, command palette, my-library, etc.) — migrate in follow-up sprints one cluster at a time to keep diffs reviewable.

### TASK-013 → §6/§7 "Loading-state normalization rollout" (partial, narrower — inline-button-spinner cluster closed in GrandRoundsMode + PatientEncounterMode)
- Classification narrowed from post-TASK-012 `partial` → still `partial` but with the inline-button-spinner cluster explicitly closed for the two active encounter-style mode shells.
- `components/loading/index.tsx`: added a new `InlineButtonSpinner` named export plus `InlineButtonSpinnerSize` (`'sm' | 'md'`) + `InlineButtonSpinnerProps` types. SVG-based ring — track at `strokeOpacity={0.3}`, quarter-arc head at full opacity, both `stroke="currentColor"` with `strokeLinecap="round"` on the head. Tailwind `animate-spin` on the root `<svg>` (respects `prefers-reduced-motion` via the framework's media-query stub). `aria-hidden="true"` + `focusable="false"` by default. Default size `md` (w-5 h-5), optional `sm` (w-4 h-4) for tight primary button contexts. Inline doc block explains why SVG is used instead of Tailwind `border-current/30` + `border-t-current` (Tailwind 3.4's JIT arbitrary-property output for `color-mix(... currentColor ...)` has uneven browser support; `stroke-opacity` is universal) and points full-container loading callers at `DrillLoadingState`.
- `components/modes/GrandRoundsMode.tsx`: extended the import to `import { DrillLoadingState, InlineButtonSpinner } from '@/components/loading';`. Replaced 3 `<Loader2 className="w-5 h-5 animate-spin" />` occurrences (lines 702, 1027, 1194) with `<InlineButtonSpinner />`. Removed the now-orphaned `Loader2,` line from the lucide-react import block — no remaining references in the file.
- `components/modes/PatientEncounterMode.tsx`: extended the existing import at line 85 to `import { ChatSkeleton, InlineButtonSpinner } from '@/components/loading';`. Replaced 2 handrolled `<div aria-hidden="true" className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />` (lines 1706, 2616) with `<InlineButtonSpinner />`. Replaced 3 `w-4 h-4` variants (lines 2722, 2775, 2793) with `<InlineButtonSpinner size="sm" />`.
- Verification: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` completed via Desktop Commander background runner in ~38 s. Zero errors in any of the three touched files. Pre-existing 1,152 repo-wide error lines identical to the post-TASK-012 baseline. No regression test surface (zero existing tests reference the three touched files or `InlineButtonSpinner`). Behavioral parity: size mapping is exact (`w-5 h-5` → `size="md"`, `w-4 h-4` → `size="sm"`); all 8 call sites are inside buttons with white text, so `currentColor` inheritance reproduces the previous hard-coded `border-t-white` color; `aria-hidden` semantics are correct-by-default post-migration (previously `Loader2` had no default `aria-hidden` and the handrolled divs had to remember it manually). Diff footprint: 3 files, 8 call sites migrated, 1 new primitive + 2 types, 1 orphaned import removed.
- Audit state after this task: Zod audit unchanged (176 PASS / 8 WARN_OUT_OF_BAND / 3 WARN_MANUAL_ONLY / 2 FAIL) — frontend consolidation, no `functions/api/**` touched. §6/§7 "Loading-state normalization" stays `partial` with the inline-button-spinner cluster for the two active encounter-style mode shells closed.
- Still deferred: (a) CramMode's real-progress generation block (intentional steady state — canonical primitives cannot represent `{completed}/{total}` counts without losing UX value); (b) ~25 other `animate-spin` occurrences across `components/library/`, `components/dashboard/`, `components/navigation/CommandPalette.tsx`, `components/pages/MyLibraryPage.tsx`, `components/admin/**`, etc. — a classify-then-migrate sweep per cluster is the TASK-014+ shape. Some will adopt `InlineButtonSpinner` immediately; some are full-container loading blocks that belong on `DrillLoadingState` / `ClinicalSkeleton` / `StreamingSkeleton`; a handful are likely intentional non-loading spinners (decorative or `RefreshCw`-style icons) that should be preserved.
