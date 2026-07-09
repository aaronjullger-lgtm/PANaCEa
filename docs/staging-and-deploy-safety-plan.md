# Staging & Deploy Safety Plan (Phase 3)

**Scope:** deployment traceability + a safe (no-resource-creation) plan for staging/preview. **No deploys, no cloud resources, no secret changes performed.**

---

## 1. Done this mission (repo-only, safe)
- **Removed `--commit-dirty=true`** from `.github/workflows/deploy.yml`; replaced with explicit `--branch="${{ github.ref_name }}" --commit-hash="${{ github.sha }}" --commit-message="deploy ${{ github.sha }}"`.
  - Safe because `dist/` and `.env.production.local` are gitignored (verified via `git check-ignore`), so the CI working tree is clean after build. Deploys now record the exact reviewed commit.
- **Advisory `npm audit` step** added to CI (`ci.yml`).

## 2. Current deploy topology (verified)
- `ci.yml` (build/typecheck:ci/lint/build/critical+unit tests/secret-scan/e2e-a11y gate) → on success, `deploy.yml` (`workflow_run`) runs Prisma migrate deploy + build (+ Sentry maps) + `wrangler pages deploy` → post-deploy health check (accepts 200/503) + advisory Lighthouse.
- **Gap (from audit, confirmed):** no staging/preview gate between CI-green and production; health check tolerates 503; migration recovery is hardcoded to one migration id.

## 3. Staging/preview plan (owner-executed; approval-gated — do NOT auto-run)
`wrangler.toml` already scaffolds `[env.preview]` (with `VITE_PRIVATE_BETA_LAUNCH=true`) but intentionally omits preview KV namespace ids (comment warns Wrangler validates real hex ids). To stand up staging safely:

1. **Create preview KV namespaces** (owner): `wrangler kv:namespace create RATE_LIMIT_KV --preview` and `... CACHE --preview`; add real `[[env.preview.kv_namespaces]]` ids.
2. **Set preview secrets** in Cloudflare Dashboard (Preview scope): `CLERK_SECRET_KEY` (test instance), a **non-prod** `DATABASE_URL` (staging Supabase or Neon preview — `neon_workflow.yml` already provisions PR DB branches), `GEMINI_API_KEY` (test/quota-limited).
3. **Promotion gate:** deploy `main` → preview first; run `npm run test:e2e:production-smoke` against the preview URL; require green before production `workflow_dispatch`.
4. **Rollback:** document in `docs/ROLLBACK.md` (referenced by deploy health failure); recommend `wrangler pages deployment` rollback + a generic migration-recovery step (replace the hardcoded `20260502000000_…` id with a parametrized input).
5. **Tighten health check** to require 200 (treat 503 as failure → trigger rollback).
6. **Never share prod state with preview** (the `[env.preview]` comment already mandates this).

## 4. Manual production release checklist (add to repo)
See `docs/devops-production-readiness-reconciliation.md` §Release Checklist — condensed: CI green → preview smoke green → migrations reviewed/approved → deploy → health 200 → smoke → Sentry watch → rollback ready.

**No external resources created; no deploy executed.**
