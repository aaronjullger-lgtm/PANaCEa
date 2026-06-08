# Sentry Setup Checklist

Use this checklist so error tracking and the Sentry tunnel work correctly in production.

---

## 1. Environment variables

### Client (Vite / browser)

| Variable | Required | Where to set | Description |
|----------|----------|--------------|-------------|
| `VITE_SENTRY_DSN` | Yes (for errors) | `.env` or deployment env | Your Sentry DSN from **Project Settings → Client Keys (DSN)**. Example: `https://[key]@o4510664011087872.ingest.us.sentry.io/4510664023212032` |

- **Without `VITE_SENTRY_DSN`:** Sentry is not initialized; no errors are sent.
- **Only used in production:** `lib/monitoring/sentry.ts` skips init when `import.meta.env.MODE !== 'production'`.

### Build (source maps upload)

| Variable | Required | Where to set | Description |
|----------|----------|--------------|-------------|
| `SENTRY_AUTH_TOKEN` | Yes (for uploads) | CI/deploy env only | Sentry auth token (**Settings → Auth Tokens**) with `project:releases` and `org:read`. |
| `SENTRY_ORG` | Yes (for uploads) | CI/deploy env | Sentry organization slug (URL: `sentry.io/organizations/<org>/`) |
| `SENTRY_PROJECT` | Yes (for uploads) | CI/deploy env | Sentry project slug |
| `SENTRY_UPLOAD` | Optional | CI/deploy env | Set to `true` to upload source maps on build (see `vite.config.ts`) |

### Backend (Cloudflare / API)

| Variable | Required | Where to set | Description |
|----------|----------|--------------|-------------|
| `SENTRY_DSN` | Optional | Cloudflare Pages env | Used by `functions/api/_shared/error-handler.ts` to send server-side errors to Sentry. Same DSN as client or a separate server DSN. |

---

## 2. Tunnel project ID match

The app sends events through **`/api/sentry-tunnel`** to avoid ad-blockers and CORS.

- **`functions/api/sentry-tunnel.ts`** has a hardcoded **project ID** and **host**.
- Your **`VITE_SENTRY_DSN`** must be for the **same project** (same project ID in the DSN path).

**Check:**

1. In Sentry: **Project Settings → Client Keys (DSN)**. The path part of the DSN is the project ID (e.g. `.../4510664023212032`).
2. In code: open `functions/api/sentry-tunnel.ts` and compare:
   - `SENTRY_HOST` (e.g. `o4510664011087872.ingest.us.sentry.io`)
   - `SENTRY_PROJECT_ID` (e.g. `4510664023212032`)
3. If you created a **new** Sentry project, update `SENTRY_HOST` and `SENTRY_PROJECT_ID` in `sentry-tunnel.ts` to match your DSN.

If they don't match, the tunnel returns **403 Invalid project ID** or Sentry may reject the envelope.

---

## 3. Tunnel 400 errors

If the browser shows **400** on `POST /api/sentry-tunnel`:

- The tunnel returns **400** when the envelope is missing, empty, or malformed.
- Response body uses PANaCEa's shared API error envelope with `ok: false`, `error.code`, and `message` (for example, `VALIDATION_FAILED` with `Empty envelope body`, `Failed to parse envelope header`, or `Invalid DSN format`). Use **Network** tab -> **sentry-tunnel** -> **Response** to inspect the envelope.
- **Typical causes:**
  - **Empty body:** Request sent without body (e.g. wrong method or middleware stripping body).
  - **Invalid format:** Envelope not newline-delimited JSON as Sentry expects.
  - **Invalid header:** First line of the envelope is not valid JSON.
  - **Invalid DSN:** DSN in the envelope is not a valid URL.

**What to do:**

1. Confirm the app is **production** build and **`VITE_SENTRY_DSN`** is set so the SDK actually sends to the tunnel.
2. Confirm no proxy or middleware is stripping or altering the body of `POST /api/sentry-tunnel`.
3. Ensure **`sentry-tunnel.ts`** uses the same project as your DSN (see section 2).

---

## 4. Source maps (optional but recommended)

To see readable stack traces in Sentry:

1. Create a Sentry **Auth Token** with `project:releases` and `org:read`.
2. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in the environment where you run **`npm run build`** (e.g. CI).
3. Set **`SENTRY_UPLOAD=true`** for that build so `vite.config.ts` runs the Sentry Vite plugin and uploads source maps.

---

## 5. Verify in Sentry

1. Deploy with **production** build and **`VITE_SENTRY_DSN`** set.
2. Trigger a test error (e.g. throw in a button handler).
3. In Sentry: **Issues** should show the event; **Releases** should show the release and source maps if upload is enabled.

---

## 6. Quick reference

| Goal | Action |
|------|--------|
| Enable client error tracking | Set `VITE_SENTRY_DSN` (production only). |
| Fix tunnel 400 | Check Network response `error.code` and `message`; align DSN and tunnel project ID; ensure POST body is sent. |
| Fix tunnel 403 | Update `SENTRY_PROJECT_ID` (and host if needed) in `sentry-tunnel.ts` to match your DSN. |
| Upload source maps | Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_UPLOAD=true` at build time. |
| Server-side errors to Sentry | Set `SENTRY_DSN` in Cloudflare Pages env for the API. |

Running **`npx ts-node scripts/system-health.ts`** (if available) can also report whether Sentry SDK and DSN are configured.

---

## 7. Other things to do (from app audit)

Besides Sentry, make sure:

| Item | Action |
|------|--------|
| **Gemini API 401** | Set `GEMINI_API_KEY` in the environment where `/api/gemini` runs (e.g. Cloudflare Pages env). Required for AI question generation and other Gemini features. |
| **Database 500s** | Set `DATABASE_URL` (and any required Prisma env) in the API environment so `/api/user/stats`, `/api/user/rolling-360-stats`, `/api/questions/session` can connect. |
| **Clerk auth** | Ensure `CLERK_SECRET_KEY` (or your Clerk secret env name) is set for authenticated endpoints. |
| **Source maps** | For readable Sentry stack traces, configure Sentry upload (section 4). |
