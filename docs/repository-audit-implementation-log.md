# Repository Audit — Implementation Log

**Mission input:** `PANaCEa_Repository_Audit_Report.md` (17 findings). The standalone
file was not attached to the workspace, but the mission brief fully enumerated the
findings (DOC-001/002/003, CODE-001..004, SEC-001..004, FEAT-001..003, DEVOPS-001 =
15 IDs; 2 further findings in the "17" total were not itemized in the brief and are
noted as unspecified). Each itemized finding is **fixed**, **disproven/stale with
evidence**, or **approval-gated**.

**Branch:** `cursor/panacea-audit-stabilization-efdd` · **base:** `671bd417`.
**Constraints:** no prod connections/secrets/migrations; implicit-only FSRS (no rating buttons); no weakening of auth/RLS/validation/types/tests.

---

## Finding-by-finding

### DOC-001 — FSRS_V6_QUICK_REFERENCE describes stock 4-button FSRS — **FIXED**
- Evidence: doc used `import {...} from '@open-spaced-repetition/ts-fsrs'`, `scheduling[Rating.Good]`, "User selected Good", Rust optimizer, `new PrismaClient()`.
- Action: **rewrote** the doc to the real implicit model (internal `lib/fsrs.ts`, binary Again/Good + `normalizeRating`, `deriveContinuousRating` pipeline, submit-review wiring, `createReviewLogEntry`, Python optimizer, CODE-001 param safety, **no self-rating buttons**).
- Tests: `tests/fsrs-docs-guard.test.ts` (3). Files: `docs/FSRS_V6_QUICK_REFERENCE.md`, test. Status: **fixed + guarded**.

### DOC-002 — FSRS_V6_IMPLEMENTATION_SUMMARY references stock ts-fsrs/Rust — **FIXED**
- Action: prepended a **HISTORICAL/SUPERSEDED** banner correcting stock-ts-fsrs / Rust-optimizer / explicit-rating / migration-checklist references; points to the rewritten quick reference. Files: `docs/FSRS_V6_IMPLEMENTATION_SUMMARY.md`. Status: **quarantined/corrected**.

### CODE-001 — FSRS `w[6]` can silently become 0/undefined — **FIXED (live)**
- Evidence: `isParamsOnCurrentScale` only validated `w[19]/w[20]` finiteness; a missing/NaN `w[6]` passed and reached `next_ds` (`-(w[6] ?? 0)`), silently disabling difficulty mean-reversion (NaN would propagate).
- Action: `isParamsOnCurrentScale` now requires **all** weights finite (read-side reject→defaults); `normalizeParameters` repairs any non-finite required weight from defaults (constructor defense-in-depth). Files: `lib/fsrs.ts`. Tests: `tests/fsrs-param-validation.test.ts` (11). Status: **fixed**.

### DOC-003 — ReviewLog not written by production — **STALE (disproven)**
- Evidence: `lib/services/drillReviewService.ts` writes via `lib/services/reviewLogService.ts` (`createReviewLogEntry`); optimizer sidecar (`lib/fsrsOptimizerSidecar.ts`) filters `review_type: 'real'`; OSCE writes **no** ReviewLog (`functions/api/osce/**` has zero ReviewLog refs → cannot pollute FSRS). Existing tests: `reviewLogService.test.ts` (17) + `drillReviewService.test.ts` (17). Status: **stale/already-wired**. (Observation: `fsrsOptimizerService.ts` uses `{ not: 'rapid_guess' }` for a secondary query — noted, not scheduling-critical.)

### SEC-001 — hardcoded credentials in wrangler.toml — **STALE + guarded**
- Evidence: `wrangler.toml` assignment lines contain only client-public `VITE_*` (Clerk publishable `pk_live_`, Supabase anon, URLs, Sentry DSN). No server secrets (`sk_*`, service-role JWT, DATABASE_URL creds, Gemini key). `sk_live_...`/`AIzaSy...` appear only as placeholder **comments**.
- Action: added `tests/wrangler-config-safety.test.ts` (2) — fails if any server secret is ever committed. Rotation of the public anon key remains **owner/approval-gated** (documented in `docs/wrangler-config-remediation-plan.md`). Status: **verified public-by-design + regression guard**.

### SEC-002 — admin page unprotected — **STALE (false positive) + tested**
- Evidence: no `pages/admin/index.tsx`; all admin routes in `config/AppRoutes.tsx` are wrapped in `<AdminRoute>` (redirect unauth, 403 non-admin, Clerk role check) + server-side `adminAuthenticatedEndpoint`.
- Action: added `components/auth/AdminRoute.test.tsx` (5). Status: **verified protected + regression tests**.

### SEC-003 — RLS / service-role bypass risk — **PARTIAL fix + gated**
- Evidence: `lib/supabase/admin.ts` (service-role) has a runtime browser guard; no client-side dir imports it. RLS migrations exist (`20260104_add_rls_policies`, `20260407200000_...`, etc.).
- Action: added import-boundary guard (`tests/import-boundaries.test.ts`) — client-bundled dirs may never import the service-role client/key. Actual **RLS policy changes remain DB/approval-gated**. Status: **safe boundary added; DB policy work gated**.

### SEC-004 — unsafe dangerouslySetInnerHTML/XSS — **STALE + hardened tests**
- Evidence: all 3 production usages (QuizView, QuestionDisplay, AnswerFeedback) route through `sanitizeForRationale` (`lib/sanitizeHtml.ts`, allowlist sanitizer). Content is trusted-generated rationale/pearls/tables.
- Action: added adversarial tests (`tests/sanitizeHtml.test.ts`, now 8) — data:/vbscript:/file: protocols dropped, mixed-case script removed, `rel=noopener` enforced, svg/img+handlers stripped, medical formatting preserved. Status: **verified safe + strengthened**.

### CODE-002 — deprecated lib/toast.ts with active callers — **STALE (false positive)**
- Evidence: `lib/toast.ts` has **no `@deprecated`**; it is the canonical **imperative** API that already delegates to `useToastStore` ("Now wires directly into the Zustand store"). Callers using `import { toast }` in services/callbacks are correct; migrating to the hook would break non-React contexts. Status: **stale — no migration warranted** (documented).

### CODE-003 — dead/orphaned files — **STALE (already removed)**
- Evidence: `lib/sessionInterleaving.ts`, `services/core/enhancedQuestionPool.ts`, `scripts/demo-question-sprint-b.ts` **do not exist**. Import-boundary test also guards against `_trash/` imports (0 offenders). Status: **stale/already-clean**.

### CODE-004 — implicit-metrics under-tested — **FIXED (added coverage)**
- Action: `lib/implicit-metrics.extra.test.ts` (13) — `perCardRtZScore` (per-card z-score + insufficient-data fallback + maturity dampening at stability boundaries + fast-response-never-dampened), `QUESTION_TYPE_WEIGHTS` (keys/finite/sum≈1), Welford latency stats + percentile fallback, answer-switch penalty monotonicity. Complements existing suite (grade boundaries, hint penalty, telemetry quality). Status: **fixed**.

### FEAT-001 / FEAT-002 — Express local dev lacks custom-session / lab-cases — **FIXED (root cause)**
- Evidence: `server.ts` imports `./routes`, but the route system was moved to `_trash/old-routes/` → `dev:server`/`dev:all` crash ("Cannot find module './routes'"). The endpoints exist as Cloudflare Functions (`functions/api/questions/custom-session.ts`, `functions/api/drills/lab-cases.ts`) and work under `dev:wrangler`.
- Action: `dev:server`/`dev:all` now run `scripts/dev/express-retired.mjs` (fail-fast + redirect to `dev:wrangler`); raw command preserved as `dev:server:legacy`; the local-dev runbook updated. Status: **fixed (retired broken path, documented parity path)**.

### FEAT-003 — behavioral signals not wired across UIs — **STALE/verified wired**
- Evidence: `hooks/useImplicitMetrics.ts` ("derive FSRS rating without explicit user buttons") captures timeToFirstClick/answerSwitches/dwell/timezone and POSTs to `/api/user/behavior-metrics`; consumed by `QuizView`, `SrsFlashcardView`, `useDrillFSRS`, and drill hooks. `deriveContinuousRating` also handles hover/commitmentGap/hint when present; `assessTelemetryQuality` classifies full/partial/minimal. Status: **verified wired (optional signals classified by quality)**.

### DEVOPS-001 — missing LICENSE — **APPROVAL-GATED**
- Evidence: no root `LICENSE`. `docs/license-decision-needed.md` already exists (options + recommendation). No license added; `package.json` license field not set to a specific license without owner choice. Status: **gated (owner must choose)**.

### Unspecified findings (2 of 17)
The brief itemized 15 findings; 2 more implied by "17" were not described. Not actionable without the source rows; recorded here for traceability. If the file is provided, they can be triaged in a follow-up.

---

## Browser QA (Phase 14) — BLOCKED (documented)
Running the app end-to-end requires Clerk auth + a database (`dev:wrangler` needs `CLERK_SECRET_KEY`/`DATABASE_URL`; authed routes need a Clerk test user). Per the hard boundaries (no prod services, no secrets), authenticated browser flows **cannot be exercised here**. Evidence is provided instead via the automated suite (unit/integration + new targeted tests) and the RTL AdminRoute/sanitizer tests. Manual checklist: see final report §Browser flows.
