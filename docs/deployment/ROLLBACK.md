# Cloudflare Pages Rollback Guide

## Overview

If a deployment introduces critical bugs, use this guide to roll back to a previous deployment.

## Option 1: Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Select your project (e.g. `panceai`)
3. Open the **Deployments** tab
4. Find the last known-good deployment
5. Click **⋯** (three dots) → **Rollback to this deployment**

## Option 2: Wrangler CLI

```bash
# List recent deployments
npx wrangler pages deployment list --project-name=panceai

# Rollback to a specific deployment (use deployment ID from list)
npx wrangler pages deployment rollback <DEPLOYMENT_ID> --project-name=panceai
```

**Note:** Cloudflare Pages rollback via CLI may vary by Wrangler version. Check [Cloudflare Pages docs](https://developers.cloudflare.com/pages/platform/deployments/#rollbacks) for the latest syntax.

## Option 3: Redeploy Previous Commit

If rollback features are unavailable, redeploy the previous working commit:

```bash
git checkout <previous-commit-sha>
npm ci
npm run build
npx wrangler pages deploy dist/ --project-name=panceai --branch=main
git checkout main  # Return to main when done
```

## Post-Rollback

1. **Verify health:** `curl https://studypanacea.com/api/health`
2. **Check Sentry** for any new errors
3. **Communicate** to team via Slack (workflow uses `SLACK_WEBHOOK_URL`)

## CI/CD Rollback Job

The workflow at `.github/workflows/ci-cd.yml` includes a manual rollback job. Trigger it via:

1. **Actions** → **StudyPANaCEa CI/CD Pipeline** → **Run workflow**
2. Set input `action` to `rollback`

Ensure `CLOUDFLARE_API_TOKEN` and `SLACK_WEBHOOK_URL` secrets are configured.
