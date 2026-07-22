# Builder Agent — Environment Variables

Document **names only**. Set values via `wrangler secret put` or 1Password injection. Never commit values.

## Required

| Variable | Where | Purpose |
|----------|-------|---------|
| `BUILDER_AGENT_API_KEY` | Worker secret | Bearer auth for `/api/*` routes |
| `BUILDER_AGENT_WEBHOOK_SECRET` | Worker secret | HMAC verification for inbound webhooks (`X-Builder-Signature`, `X-Builder-Timestamp`) |

## Recommended

| Variable | Where | Purpose |
|----------|-------|---------|
| `BUILDER_AGENT_WEBHOOK_SECRET` | GitHub/Linear/Sentry webhook config | Same value for signature generation |

## Worker vars (wrangler.toml)

| Variable | Default | Purpose |
|----------|---------|---------|
| `BUILDER_AGENT_DEFAULT_REPO` | `aaronjullger-lgtm/PANaCEa` | Target repository |
| `BUILDER_AGENT_DEFAULT_BRANCH` | `main` | Base branch |
| `BUILDER_AGENT_DRY_RUN` | `true` | When true, no live GitHub writes (mandatory default) |
| `BUILDER_AGENT_SANDBOX_ENABLED` | `false` | Enable Sandbox backend |
| `BUILDER_AGENT_ALLOWED_WORKSPACES` | `panacea` | Comma-separated workspace allowlist |
| `WORKER_LABEL` | `panacea-builder-agent` | Log tagging |

## Optional integrations

| Variable | Purpose | When missing |
|----------|---------|--------------|
| `GITHUB_TOKEN` | GitHub API (issues, PRs, checks) | `github: mocked` in dry-run |
| `LINEAR_API_KEY` | Linear GraphQL | `linear: mocked` |
| `SENTRY_AUTH_TOKEN` | Sentry REST API | `sentry: mocked` |
| `SENTRY_ORG` | Sentry org slug | Required with auth token |
| `CONTEXT7_API_KEY` | Documentation lookup | `docs: mocked` |
| `SENTRY_DSN` | Optional Worker error reporting | No Worker Sentry |

## Local dev vars (.dev.vars — gitignored)

```
BUILDER_AGENT_API_KEY=<your-dev-key>
BUILDER_AGENT_DRY_RUN=true
```

## 1Password / Cloudflare injection

Follow existing PANaCEa pattern in `docs/deployment/CLOUDFLARE_ENV_SETUP.md`:

1. Store secrets in 1Password vault item `PANaCEa Builder Agent`
2. Inject via Cloudflare Dashboard → Workers → panacea-builder-agent → Settings → Variables
3. Use separate values for preview/staging vs production

## Not used by Builder Agent

- `DATABASE_URL` — agent state is DO SQLite, not Prisma
- `GEMINI_API_KEY` — v1 uses structured phases; LLM calls added in v2
- `CURSOR_AGENTS_API_KEY` — legacy external runner only
