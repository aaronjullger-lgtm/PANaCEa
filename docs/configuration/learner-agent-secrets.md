# Learner Agent — Environment Variables

**Names only.** Set via Cloudflare Dashboard, Wrangler secrets, or local `.dev.vars` (never commit values).

## Pages / Functions

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENABLE_LEARNER_AGENT` | Staging+ | Feature gate (`true` / `1` / `yes` / `on`) |
| `LEARNER_AGENT_WORKER_URL` | If using DO | Base URL for WebSocket connect |
| `DATABASE_URL` | Yes | Prisma edge client |
| `CLERK_SECRET_KEY` | Yes | Auth verification |
| `GEMINI_API_KEY` | For `/api/learner-agent/run` | Agent model turns |
| `RATE_LIMIT_KV` | Recommended | Connection token storage + rate limits |
| `CACHE` | Recommended | Learner memory KV |

## Client (Vite build-time)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_ENABLE_LEARNER_AGENT` | Yes for UI | Show `LearnerAgentPanel` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Auth |
| `VITE_API_URL` | Yes | API base |

## Learner Agent Worker

| Variable | Required | Purpose |
|----------|----------|---------|
| `RATE_LIMIT_KV` | Yes | Validate `learner-connect:{token}` |
| `PAGES_API_URL` | Optional | Future server-side tool proxy |
| `CLERK_SECRET_KEY` | If validating JWT in worker | |
| `DATABASE_URL` | If running tools in worker | Prefer Pages API in v1 |

## Wrangler secrets commands

```bash
cd workers/learner-agent
npx wrangler secret put RATE_LIMIT_KV_BINDING  # use namespace binding in wrangler.toml instead
```

KV namespaces are bound in `wrangler.toml`; secrets are for API keys only.

## Staging example (dashboard vars only)

```
ENABLE_LEARNER_AGENT=true
LEARNER_AGENT_WORKER_URL=https://panacea-learner-agent.<account>.workers.dev
VITE_ENABLE_LEARNER_AGENT=true
```

## API reference

Endpoint contracts: [docs/api/API_OVERVIEW.md](../api/API_OVERVIEW.md#learner-agent-endpoint-contracts)
