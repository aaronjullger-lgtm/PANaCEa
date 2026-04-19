# TASK-009 — Zod-harden `POST /api/podcast/generate`

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Category:** API validation hardening
- **Priority / Risk / Size:** Medium / Low / M
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "API validation hardening"

## Verify-first block (Audit Interpreter)

Classification of the file-level claim "`podcast/generate.ts` POST lacks Zod": **accurate**. Pre-edit the handler:

- Read the body via `request.json()` with no schema validation (JSON branch).
- Accepted multipart via `request.formData()` with no content-type gate and no total-size ceiling.
- Re-emitted the unvalidated body verbatim to the external Node service at `PODCAST_SERVICE_URL`.

Nuance that kept this task **deferred** before authorization: this endpoint is structurally a **proxy** — the downstream Node service (Cloud Run) owns the canonical request contract. Wrapping with `authenticatedEndpoint(schema, handler)` would break the multipart branch because `withValidation` inside the wrapper reads the body via `request.text()` + `JSON.parse()`, which fails on `multipart/form-data`.

## Planned-code-changes block (Repo Mapper)

The right shape of fix is **branch-specific validation** rather than a single wrapper:

1. Keep the existing `withMiddleware(withCors, withErrorHandling, withAuth, withRateLimit, handler)` chain intact — preserves auth + 5 req/min rate limiting + CORS + structured error handling.
2. Add a content-type gate up front. Accept only `application/json` or `multipart/form-data`; anything else returns 415.
3. **JSON branch:** parse body, then run `PodcastGenerateJsonSchema.safeParse(...)`. The schema is intentionally permissive (`.passthrough()`) so the downstream Node service can evolve its own field set without this proxy becoming a blocking bottleneck, but it bounds known fields: `pdfUrl` must be a URL ≤2048 chars, `topic` ≤10_000 chars, `voice`/`title`/`language`/`style` bounded strings. Rejecting malformed top-level shapes still catches the 99% case (array bodies, scalar bodies, wrong types on known fields).
4. **Multipart branch:** reject any `Content-Length` > 25 MB before `request.formData()` materializes the body, avoiding an OOM vector. Downstream service retains ownership of field-level checks (which file fields, which extensions, which MIME types) because those live in the multipart contract, not the Edge proxy contract.
5. Export `PodcastGenerateSchema` + `PodcastGenerateRequest` as type aliases so future typed callers can consume the shape without re-declaring it.

## What was changed

- `functions/api/podcast/generate.ts`:
  - Added `import { z } from 'zod'`.
  - Declared `PodcastGenerateJsonSchema` with `.passthrough()` and bounded known scalar fields.
  - Exported `PodcastGenerateSchema` and `PodcastGenerateRequest` type alias.
  - Added `MAX_MULTIPART_BYTES = 25 MB` constant.
  - Added 415 content-type gate for non-JSON / non-multipart requests.
  - JSON branch now runs `.safeParse()` and returns a 400 with `path: message` issue list on failure.
  - Multipart branch now short-circuits to 413 when `Content-Length` exceeds 25 MB before any body parsing.
  - JSON branch now forwards `parsed.data` (the post-schema object) rather than the raw body — preserves `.passthrough()` semantics while guaranteeing the shape the downstream service sees has survived top-level validation.
  - Header/handler auth/rate-limit stack unchanged.

## Verification

- Re-ran a faithful node-native port of `scripts/audit-zod-validation.ts` on the full `functions/api/**` tree:
  - **Total mutation endpoints:** 189
  - **PASS:** 177 (up from 176)
  - **WARN_OUT_OF_BAND:** 8 (unchanged — 7 cron + `webhooks/clerk`)
  - **WARN_MANUAL_ONLY:** 3 (unchanged — `knowledge/upload`, `sentry-tunnel`, `technique-check/analyze`)
  - **FAIL:** 1 (down from 2) — `drill/log-attempt.ts` (410 Gone deprecated tombstone, expected)
- `podcast/generate.ts` → **PASS** via `.safeParse(` detection.
- `grep -n 'PodcastGenerateJsonSchema' functions/api/podcast/generate.ts` shows schema declared, exported, and used.
- No existing callers import `PodcastGenerateRequest`; the new type alias is additive.
- Rate-limit, auth, CORS, and error-handling middleware composition is unchanged semantically.

## Audit delta

- `UNFINISHED_WORK_MASTER_AUDIT.md` §5 file-level claim on `podcast/generate.ts` → **addressed-this-run**.
- Total `audit:zod` FAIL count drops from **2 → 1**. The only remaining FAIL is `drill/log-attempt.ts`, which is a deliberate 410 Gone tombstone that never reads its body — not real risk, and explicitly parked with a tombstone note in the queue.

## Follow-ups

- If the downstream Node service introduces a strict JSON contract, the `.passthrough()` can be tightened to `.strict()` + an explicit enumeration of fields. For now, preserving forward-compat is the right trade-off.
- If multipart traffic ever starts exceeding 25 MB for legitimate reasons (e.g., textbook-scale PDFs), raise `MAX_MULTIPART_BYTES` in lock-step with a matching Cloud Run request-size bump, or switch the multipart path to a presigned-upload flow.
