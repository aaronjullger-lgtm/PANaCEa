# Secrets & Config Remediation Plan (Phase 3)

**Scope:** committed configuration values in `wrangler.toml`. **No secrets are printed here; no values rotated.** Rotation happens in real services and is **owner-only (approval-gated)**.

---

## 1. What is committed (verified)

`wrangler.toml` `[vars]` and `[env.preview.vars]` contain **client-side (`VITE_`) values**, which are embedded in the browser bundle by design:

| Key | Class | Exposure reality |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) | **Publishable** (public by design) | Not a secret; Clerk publishable keys are meant to ship to the client. Security boundary is Clerk session verification server-side. |
| `VITE_SUPABASE_ANON_KEY` | **Anon key** (public by design) | Not a true secret, BUT it shifts the security boundary to **Supabase Row-Level Security correctness**. |
| `VITE_SUPABASE_URL`, `VITE_API_URL` | Public endpoints | Not sensitive. |
| `VITE_SENTRY_DSN` | DSN (public-ish) | Ingest endpoint; low sensitivity (can enable spam if abused). |

**No true secrets** (`CLERK_SECRET_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are committed — `wrangler.toml` explicitly documents these must be set in the Cloudflare Dashboard. Gitleaks runs in CI with an allowlist for publishable keys. `audit:zod`/`audit:prisma` clean.

**Correct severity:** LOW–MEDIUM (not "critical"). The audit's "hardcoded secrets → CRITICAL" is an over-classification; these are public client keys. The genuine risk is (a) reliance on Supabase RLS correctness, and (b) the values are duplicated across `[vars]` and `[env.preview.vars]`, so a rotation must update both.

---

## 2. Recommended remediation (owner-executed; approval-gated)

> These require touching real Cloudflare/Supabase/Sentry projects and are **not performed by this mission**.

1. **Move `VITE_*` to Cloudflare Dashboard build env** (Production + Preview). `scripts/inject-wrangler-env.js` already prefers `process.env` over `wrangler.toml`, so setting them in the Dashboard transparently overrides the committed values — enabling their removal from git afterward.
2. **After Dashboard values are set,** replace the committed `[vars]`/`[env.preview.vars]` `VITE_*` entries with a committed `wrangler.toml.example` template + gitignore the live values (or keep only non-sensitive `NODE_VERSION`).
3. **Rotate the Supabase anon key** (defense-in-depth) and **verify RLS policies** are the true access boundary — since the anon key was historically public. Rotate `VITE_SENTRY_DSN` if abuse is observed.
4. **Verify RLS enforcement** on all Supabase-exposed tables (student PII) before launch — this is the real control given the anon key is client-shipped.

## 3. `.env.example`
`.env.example` is already comprehensive (all secrets documented with placeholder patterns, per the DevOps audit). **No change required.** Optional nicety: annotate which `VITE_*` are safe-to-commit vs. dashboard-only. (Not done to avoid churn; low value.)

## 4. Rotation runbook (for the owner)
```
# Clerk publishable key: Clerk Dashboard → API Keys → rotate → update Cloudflare Pages env (Prod+Preview).
# Supabase anon key:     Supabase → Project Settings → API → rotate anon key → update CF env → redeploy.
#                        THEN re-verify RLS policies (the real boundary).
# Sentry DSN:            Sentry → Project → Client Keys (DSN) → rotate → update CF env.
# Never commit sk_live_/service-role/DATABASE_URL/GEMINI keys — Dashboard only (already the case).
```

**No secrets were rotated, printed, or added by this mission.**
