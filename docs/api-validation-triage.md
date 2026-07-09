# API Validation Triage

**Date:** 2026-07-09
**Audit command:** `npm run audit:zod`
**Current result:** **202 PASS · 2 WARN (out-of-band) · 0 WARN-manual · 0 FAIL**

> The 2026-04-16 audit claimed "145 endpoints fail Zod validation." That number was a **detection
> bug** in `scripts/audit-zod-validation.ts` (it did not recognize the 7 shared middleware wrappers
> that internally run `withValidation(schema)`), fixed by a prior agent (see
> `docs/implementation/AUDIT_RECONCILIATION.md` §5). Today the audit is green. This doc records the
> current risk tiers so future passes do not re-open the phantom backlog.

## 1. Validation architecture (how endpoints are validated)

Mutation endpoints are validated through shared wrappers in `functions/api/_shared/` that compose
`withValidation(schema)` + auth + rate limiting + `safePrismaDisconnect`:

`authenticatedEndpoint` · `adminEndpoint` · `adminAuthenticatedEndpoint` · `aiEndpoint` ·
`refineryEndpoint` · `cmsEndpoint` · `publicEndpoint`

The audit script recognizes these wrappers (including the TS-generic form `authenticatedEndpoint<Input>(...)`),
`withValidation(...)` composition, and out-of-band security models (CRON_SECRET, Svix webhook signatures).

## 2. Risk tiers (current state)

| Tier | Endpoints | Status |
|---|---|---|
| **Admin mutations** | `functions/api/admin/**` (staging, content, media/approve, refinery/action, blueprint-coverage, branches/[…]/merge, …) | ✅ Validated via `adminEndpoint`/`adminAuthenticatedEndpoint`. |
| **Drill / review submission** | `functions/api/drills/submit-review.ts` | ✅ `authenticatedEndpoint(Schema, …)`. |
| **Exam start / complete** | `functions/api/exam/start.ts`, `functions/api/exam/complete.ts` | ✅ Wrapper-validated. |
| **Feedback submission** | `functions/api/feedback/submit.ts` | ✅ Wrapper-validated. |
| **SRS sync** | `functions/api/srs/sync.ts`, `functions/api/srs/submit.ts` | ✅ Wrapper-validated (retirement is a separate concern — see `fsrs-legacy-retirement-plan.md`). |
| **User-facing writes** | `users/me/daily-plan/complete`, `users/me/exam-outcome` | ✅ Hardened by TASK-007/008 (`authenticatedEndpoint` + bounded schemas). |
| **Multipart uploads** | `knowledge/upload`, `technique-check/analyze`, `podcast/generate` | ✅ Hardened by TASK-009/011 (415 content-type gates, 413 Content-Length ceilings, bounded fields). Zod can't validate multipart bodies structurally; manual gates are the correct shape. |

## 3. The 2 remaining WARNs (intentional, out-of-band — Zod not applicable)

| Endpoint | Why Zod is N/A |
|---|---|
| `functions/api/sentry-tunnel.ts` | Sentry envelopes are newline-delimited streaming JSON owned by the Sentry SDK. Correct validation = DSN extraction + project-ID whitelist + per-IP rate limit (already present). |
| `functions/api/webhooks/clerk.ts` | Svix webhook signature verification is the security model; request shape is Clerk-owned. |

Cron endpoints (`cron/**`) are gated by the `CRON_SECRET` bearer header, not user input; the audit
classifies them `WARN_OUT_OF_BAND`, and adding request-body schemas adds little value.

## 4. Recommendation

**No code change required this run** — the highest-risk mutation surface is already validated. Guard
against regressions by keeping `npm run audit:zod` in CI and trusting its (fixed) output rather than
re-deriving endpoint counts from stale audit docs. If a new endpoint is added, use the existing
`authenticatedEndpoint(Schema, handler)` pattern and add a handler test.
