# Preview Environments

How PANaCEa should run PR previews — and what's still missing today.

Last updated: 2026-04-18.

---

## Goal

Every PR gets a preview deployment where reviewers can click through real
flows against real infrastructure, **without** polluting production data or
rate-limit counters.

Specifically:

- Preview deployments share none of production's state that matters:
  - Separate KV namespaces (no rate-limit pollution, no cache collisions).
  - Separate database branch (no test data in prod, no prod data in tests).
  - Separate Clerk instance, or Clerk allowlist for preview URLs.
- Preview URLs are deterministic per PR (so bookmarks work).
- Preview deployments auto-teardown on PR close.

---

## Current state (2026-04-18)

Partial. Here's what's wired and what isn't.

### Wired

- **Cloudflare Pages preview deployments.** Every push to a non-main branch
  creates a `*.panacea.pages.dev` preview URL via Cloudflare's default
  integration. These inherit Production env vars unless overridden.
- **Neon DB branch-per-PR** — `.github/workflows/neon_workflow.yml` creates a
  preview branch on PR open and deletes it on PR close. 2-week TTL.

### Not wired

- **Preview env vars in `wrangler.toml`.** There is no `[env.preview]` block.
  Preview deployments use the same env vars as production, including:
  - Same `CLERK_SECRET_KEY` → preview signs real prod tokens.
  - Same `DATABASE_URL` → preview writes to prod DB (currently mitigated only
    by running migrations against a Neon branch, but the deployed Pages
    Function still connects to prod).
  - Same `RATE_LIMIT_KV` binding → preview consumes prod rate-limit budget.
  - Same `CACHE` KV → preview pollutes prod cache.
- **Neon branch DATABASE_URL is not piped to the preview deployment.** The
  Neon branch exists but nothing reads from it; the commented-out step in
  `neon_workflow.yml` would need to run migrations and export the
  `db_url_with_pooler` as a preview env var.
- **Clerk preview instance.** Preview URLs are not allowlisted in a
  non-production Clerk instance. Today, previews use production Clerk.

This is Sprint 3 of the Release & Quality Gate work.

---

## Sprint 3 — the fix

Three coordinated changes.

### 1. Add `[env.preview]` to `wrangler.toml`

Append to `wrangler.toml`:

```toml
# ─────────────────────────────────────────────────────────────────────────
# Preview environment — bound on non-main branch deployments.
# Create KV namespaces with:
#   npx wrangler kv:namespace create RATE_LIMIT_KV --preview
#   npx wrangler kv:namespace create CACHE --preview
# Paste the returned IDs below.
# ─────────────────────────────────────────────────────────────────────────
[env.preview]
# Preview vars override production vars. VITE_* stays the same (public keys).
vars = { NODE_VERSION = "22" }

[[env.preview.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<preview-rate-limit-kv-id>"

[[env.preview.kv_namespaces]]
binding = "CACHE"
id = "<preview-cache-kv-id>"
```

Then in Cloudflare Dashboard → **Pages** → **panacea** → **Settings** →
**Environment variables**, set these for **Preview** (not Production):

- `DATABASE_URL` — Neon preview branch pooled URL (set per-PR by CI; see
  section 3 below for how to make this dynamic).
- `CLERK_SECRET_KEY` — secret key from a separate Clerk development instance.
- `GEMINI_API_KEY` — separate key with a lower quota, so a preview exploit
  doesn't blow the prod budget.

### 2. Activate Clerk development instance for previews

- Create a "Development" instance in Clerk dashboard if one doesn't exist.
- Add preview deployment URL pattern (`*.panacea.pages.dev`) to allowed origins.
- Use that instance's `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
  for Preview deployments.

### 3. Pipe the Neon branch URL into the preview deploy

Uncomment the migration step in `neon_workflow.yml` and extend it:

```yaml
- name: Run Migrations against PR branch
  run: npm run db:migrate:deploy
  env:
    DATABASE_URL: ${{ steps.create_neon_branch.outputs.db_url_with_pooler }}

- name: Set preview DATABASE_URL on Cloudflare
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    PREVIEW_DB_URL: ${{ steps.create_neon_branch.outputs.db_url_with_pooler }}
  run: |
    # Cloudflare Pages supports per-deployment env via API
    # See: https://developers.cloudflare.com/api/operations/pages-deployment-create-deployment
    # The per-deployment pattern is preferred over per-env, since PR branches
    # all share the "Preview" env otherwise.
    echo "TODO: implement per-deployment DATABASE_URL via CF API"
```

That last step is the tricky bit — Cloudflare Pages Preview env vars are
per-environment, not per-deployment, so every open PR currently shares the
same Preview env. Options:

- **Option A (simplest):** Accept that previews share a Neon branch (use the
  `develop` long-lived branch for all previews, not per-PR). Trade precision
  for simplicity.
- **Option B (most correct):** Use the Cloudflare API to set
  per-deployment env vars. Requires a CF API call in CI after deployment.
- **Option C:** Route preview DB traffic through an edge-side lookup that maps
  `CF-Deployment-ID` → Neon branch URL via KV. More moving parts.

Recommend Option A for v1. Move to Option B only if parallel PR reviews
become a regular blocker.

---

## Verifying preview isolation

After Sprint 3 is wired, sanity checks to confirm a preview deploy is not
touching production:

1. **KV isolation:** Hit a preview endpoint that uses `RATE_LIMIT_KV`.
   Immediately after, hit the same endpoint on prod. The rate-limit counter
   should be independent (`wrangler kv:key list` against each namespace).
2. **DB isolation:** Create a row on the preview. Query the prod DB — row
   should not appear. Query the preview Neon branch — row should appear.
3. **Clerk isolation:** Sign into preview with a Clerk development-instance
   account. Attempt the same session on prod — should fail with
   `unauthorized` (different Clerk instance, different JWTs).

All three must pass before the preview env is considered safe.

---

## Promoting a preview to production

Today, the path is:

1. PR reviewed on preview URL.
2. Merge PR to `main`.
3. `ci.yml` runs. On success, `deploy.yml` fires via `workflow_run`.
4. `deploy.yml` runs `prisma migrate deploy`, builds, then `wrangler pages
   deploy dist --project-name=panacea`.
5. Cloudflare promotes the main-branch deployment to production.

No manual "promote this preview" step exists. The preview Pages URL stays
accessible for post-merge forensics but is not bit-identical to prod
(separate build).

For a truer promotion pattern (build once, deploy same artifact to preview
then prod), the deploy workflow would need to:

- Upload a stable build artifact on PR builds.
- On main-branch deploy, download that artifact (if the commit SHA matches)
  and deploy without rebuilding.

Not a priority today. Listed here so the design is documented.

---

## Teardown

- **Neon:** `delete_neon_branch` job in `neon_workflow.yml` fires on
  `pull_request.closed`. TTL is 14 days if the PR stays open but inactive.
- **Cloudflare Pages:** Preview deployments retain indefinitely until the
  next deploy supersedes them. No manual cleanup needed.
- **Clerk development instance:** Sessions expire per Clerk's default
  (7 days). No per-PR cleanup needed.
