# TASK-011 — Harden WARN_MANUAL_ONLY multipart endpoints + document Sentry-tunnel rationale

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** (pending this-run commit)
- **Category:** API hardening (content-type gates + Content-Length short-circuits)
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §5 "API validation hardening" (WARN_MANUAL_ONLY tail); improved audit script output on 2026-04-16 listing three endpoints under `WARN_MANUAL_ONLY`.

## Verify-first block (Audit Interpreter)

The improved `audit:zod` (post-META fix) puts three endpoints in the `WARN_MANUAL_ONLY` bucket:

1. `POST /api/knowledge/upload` — multipart/form-data upload of knowledge-base files (PDF / TXT / DOCX) forwarded to Gemini Files API.
2. `POST /api/technique-check/analyze` — multipart/form-data video upload + text query, forwarded to Gemini vision model.
3. `POST /api/sentry-tunnel.ts` — Sentry SDK envelope proxy (Content-Type `application/x-sentry-envelope`).

These are flagged `WARN_MANUAL_ONLY` because their bodies are not a single JSON object, so Zod doesn't fit cleanly via the shared wrappers. The audit script's job is to flag manual validation so a human can verify it is actually present and sufficient. Addressing this row means reviewing each endpoint's manual validation and tightening where appropriate; it does not mean shoe-horning Zod into a body shape it wasn't designed for.

### Caller inventory (2026-04-16 grep across `*.{ts,tsx,js,jsx}`)

- `/api/knowledge/upload` — one active caller: `components/pages/MyLibraryPage.tsx:227` builds a `FormData`, appends `file`, and POSTs with `Authorization: Bearer <token>`. Caller contract matches server contract.
- `/api/technique-check/analyze` — one active caller: `pages/TechniqueCheckPage.tsx:88` builds `FormData` with `video` (File) + `query` (trimmed string) and POSTs with `Authorization`. Caller contract matches server contract exactly.
- `/api/sentry-tunnel` — called by `lib/monitoring/sentry.ts:63` via Sentry SDK's `tunnel` config. Body format is owned by Sentry's SDK (not PANaCEa code), streaming envelope protocol with per-line JSON framing.

### Classification

- `knowledge/upload` → **accurate**; manual validation present but can be tightened with a pre-materialization content-type gate (415) and a `Content-Length` short-circuit (413) — the existing `file.size > MAX_FILE_SIZE` check fires only after `request.formData()` has already materialized up to 50 MB of body into memory.
- `technique-check/analyze` → **accurate**; manual validation present but uses `400 Bad Request` for wrong content-type (should be 415) and wrong-size video (should be 413), and has no `Content-Length` short-circuit before `formData()` materializes a 20 MB video. Also lacks an upper bound on `query` length — an adversarial caller could submit a pathologically long query string to run up Gemini token costs.
- `sentry-tunnel` → **structurally correct, leave alone**. Sentry envelopes are a newline-delimited streaming format owned by Sentry's SDK, not by PANaCEa. The right contract-matching validation is DSN extraction + project-ID whitelist (already implemented, lines 99–131), plus per-IP in-memory rate limiting (already implemented, lines 24–40). Adding Zod here would break the streaming protocol. This is the intended steady state for `WARN_MANUAL_ONLY`.

## Planned-code-changes block (Repo Mapper)

1. **`functions/api/knowledge/upload.ts`** — add two gates before `request.formData()`:
   - `Content-Type` gate: reject non-multipart with `415 Unsupported Media Type` and a pointer to the expected shape.
   - `Content-Length` short-circuit: if advertised body size exceeds `MAX_FILE_SIZE` (50 MB), reject with `413 Payload Too Large` before the edge runtime allocates a 50 MB buffer.
   - Keep the existing post-materialization `file.size > MAX_FILE_SIZE` guard as defense-in-depth for requests that omit or misreport `Content-Length`.
   - Update the file JSDoc with a "Validation model" block documenting the layered checks.

2. **`functions/api/technique-check/analyze.ts`** — four tightenings:
   - Flip the wrong-content-type response from `400` to `415` (proper HTTP semantics).
   - Add a `Content-Length` short-circuit (413) before `formData()` materializes up to 20 MB of video.
   - Flip the post-materialization oversized-video response from `400` to `413` (proper HTTP semantics).
   - Add `MAX_QUERY_CHARS = 2000` and reject `query.length > MAX_QUERY_CHARS` with a 400 (prevents pathologically long prompts reaching Gemini).
   - Update the file JSDoc with a "Validation model" block.

3. **`functions/api/sentry-tunnel.ts`** — **no code change**. Document the rationale in `AUDIT_RECONCILIATION.md` so a future audit pass doesn't re-queue this endpoint for "hardening." The file's existing JSDoc already explains the security model (project-ID whitelist, per-IP rate limit).

## What was changed

- `functions/api/knowledge/upload.ts`:
  - JSDoc expanded with a `Validation model:` block.
  - After `validateFunctionEnv`, added a `415` gate on `Content-Type !== 'multipart/form-data'` and a `413` short-circuit on `Content-Length > MAX_FILE_SIZE` (50 MB).
  - Post-materialization `file.size` guard retained verbatim.
- `functions/api/technique-check/analyze.ts`:
  - JSDoc expanded with a `Validation model:` block.
  - Added `MAX_QUERY_CHARS = 2000` constant.
  - Wrong-content-type response: `400` → `415`; added comment on intent.
  - Inserted `Content-Length` short-circuit (`413`) immediately after content-type gate.
  - Oversized-video response (post-materialization): `400` → `413`.
  - Added a `query.length > MAX_QUERY_CHARS` guard (`400`) right after the existing empty-query check.
- `functions/api/sentry-tunnel.ts`: **not modified.**

## Verification

- **Audit script (node-native faithful port of `scripts/audit-zod-validation.ts`):**
  - 189 mutation endpoints, **176 PASS**, **8 WARN_OUT_OF_BAND**, **3 WARN_MANUAL_ONLY**, **2 FAIL**.
  - `WARN_MANUAL_ONLY` roster unchanged: `knowledge/upload.ts`, `sentry-tunnel.ts`, `technique-check/analyze.ts`. **This is the intended outcome** — the script classifies by code-shape, not by validation depth. The three endpoints stay in `WARN_MANUAL_ONLY` because their bodies are not single JSON objects; Zod wouldn't fit. The hardening improves the manual validation **inside** the bucket without moving endpoints between buckets.
  - `FAIL` roster unchanged: `drill/log-attempt.ts` + `questions/review.ts` — both deliberate 410 tombstones.
- **Scoped typecheck** against the strict ambient-type surface (`--types @cloudflare/workers-types --strict --noUncheckedIndexedAccess`) on the two touched files: zero errors in either `knowledge/upload.ts` or `technique-check/analyze.ts`. (Pre-existing `process` errors surface from `_shared/auth.ts`, `_shared/env-validation.ts`, `_shared/prisma-edge.ts`, `_shared/secureLogger.ts` — unrelated transitive leaks, not introduced by this task.)
- **Caller contract check:** both active callers (`MyLibraryPage.tsx` for `knowledge/upload`, `TechniqueCheckPage.tsx` for `technique-check/analyze`) send well-formed multipart requests with legitimate file sizes and bounded query strings. Neither caller trips the new 415/413 gates or the `MAX_QUERY_CHARS` ceiling under normal operation; the new gates only fire on misrouted or adversarial traffic.

## Audit delta

- Closes the `WARN_MANUAL_ONLY` tail of §5 "API validation hardening" for `knowledge/upload` and `technique-check/analyze` — manual validation now has proper HTTP semantics (415/413) and defense-in-depth against oversized bodies + oversized prompts.
- `sentry-tunnel` reclassified from "latent hardening candidate" to "intentional steady state" — the endpoint's validation shape is correct given the Sentry envelope protocol; audit reconciliation updated to reflect this permanently.
- Audit `audit:zod` top-line counts unchanged (176 / 8 / 3 / 2) — the three `WARN_MANUAL_ONLY` endpoints remain in bucket by design. FAIL count remains 2, both tombstones, steady state.

## Follow-ups

- **Sentry-tunnel:** none. The endpoint is intentionally `WARN_MANUAL_ONLY`; its validation shape matches the Sentry envelope contract. If the Sentry SDK ever ships a second tunnel mode with a JSON body, revisit.
- **Knowledge/upload `displayName`:** caller (`MyLibraryPage.tsx`) computes a display name but doesn't forward it — server currently hardcodes `display_name: 'library'` in the Gemini upload call. Wiring the caller's value through would be a distinct UX cleanup task (out of scope here).
- **Query length bound (2000 chars):** conservative default; revisit if clinical-technique queries ever legitimately need longer prompts.
