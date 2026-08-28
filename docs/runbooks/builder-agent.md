# Builder Agent Operations Runbook

## Deploy

```bash
cd workers/builder-agent
npm install
npx wrangler secret put BUILDER_AGENT_API_KEY
# Optional:
npx wrangler secret put BUILDER_AGENT_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put LINEAR_API_KEY
npx wrangler secret put SENTRY_AUTH_TOKEN
npx wrangler secret put SENTRY_ORG
npx wrangler deploy
```

## Local dev

```bash
# Unit + dry-run tests (no Worker required)
npm run builder-agent:test

# Worker dev server (requires secrets in .dev.vars — never commit)
cd workers/builder-agent
echo 'BUILDER_AGENT_API_KEY=<your-dev-key>' > .dev.vars
npx wrangler dev
```

## Create a run

```bash
curl -X POST "https://panacea-builder-agent.<account>.workers.dev/api/runs" \
  -H "Authorization: Bearer $BUILDER_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskSource": "idea",
    "objective": "Add regression test for idempotency store",
    "requestingUser": "aaron@studypanacea.com",
    "dryRun": true
  }'
```

## Approve a plan

```bash
curl -X POST "https://panacea-builder-agent.<account>.workers.dev/api/runs/{runId}/approve" \
  -H "Authorization: Bearer $BUILDER_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalId": "{approvalId}",
    "approved": true,
    "resolvedBy": "aaron@studypanacea.com"
  }'
```

## Health check

```bash
curl https://panacea-builder-agent.<account>.workers.dev/health
```

## Webhooks

Configure GitHub/Linear/Sentry to POST to:

- `https://panacea-builder-agent.<account>.workers.dev/webhooks/github`
- `https://panacea-builder-agent.<account>.workers.dev/webhooks/linear`
- `https://panacea-builder-agent.<account>.workers.dev/webhooks/sentry`

Set header `X-Builder-Signature: sha256=<hmac>` where HMAC is computed over the raw body with `BUILDER_AGENT_WEBHOOK_SECRET`.

Duplicate deliveries are ignored via idempotency keys.

## Monitoring

- **Worker logs:** `npx wrangler tail panacea-builder-agent`
- **Structured events:** JSON lines with `type` field (`run.created`, `state.transition`, etc.)
- **Sentry:** Tag `correlation_id` and `run_id` — no prompt or secret content

## Incident response

| Symptom | Action |
|---------|--------|
| Run stuck in `awaiting_plan_approval` | POST `/api/runs/{id}/approve` or cancel |
| Duplicate PRs | Check `idempotency_keys` in DO state; should not happen if store healthy |
| Sandbox errors | Set `BUILDER_AGENT_SANDBOX_ENABLED=false`; verify fallback |
| Auth 401 | Rotate `BUILDER_AGENT_API_KEY` via wrangler secret |

## What NOT to do without explicit approval

- Set `BUILDER_AGENT_DRY_RUN=false` in production
- Enable merge execution (v1 returns 501)
- Deploy production schema migrations via agent
- Remove `scripts/cloud-agents/` or `.github/workflows/cloud-agents.yml`
