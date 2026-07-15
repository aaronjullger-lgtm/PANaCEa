# PANaCEa Workflow DevKit

Durable automation workflows for repetitive repo operations, built with [Workflow DevKit](https://useworkflow.dev).

This runtime is **separate from the Cloudflare Pages production API** and the main Vite frontend. It runs locally (or on Vercel) via Nitro with full Node.js access in step functions.

## Quick start

```bash
# Start the workflow HTTP server (Nitro)
npm run workflow:dev

# Inspect runs
npm run workflow:inspect
npm run workflow:web

# Integration tests
npm run test:workflow
```

Health check: `GET /api/workflows/health` on the Nitro dev server port.

Use the base URL printed when you run `npm run workflow:dev` for the examples below (`$WF_SERVER`).

## Workflows

| Workflow | Endpoint | Mirrors |
|----------|----------|---------|
| **verify-change** | `POST /api/workflows/verify-change` | `panacea-verify` ladder — typecheck, critical tests, optional build |
| **db-health-cycle** | `POST /api/workflows/db-health-cycle` | `scripts/orchestrate.ts` — registry sync → validate → quality → relationships |
| **daily-ops** | `POST /api/workflows/daily-ops` | `scripts/automation/dailyOps.ts` |
| **weekly-maintenance** | `POST /api/workflows/weekly-maintenance` | `scripts/automation/weeklyMaintenance.ts` |
| **content-flag-review** | `POST /api/workflows/content-flag-review` | Admin content-quality flag approval via hooks |

### Example: verify a code change

```bash
curl -X POST "$WF_SERVER/api/workflows/verify-change" \
  -H 'Content-Type: application/json' \
  -d '{"typecheck": true, "criticalTests": true, "build": false}'
```

Poll result:

```bash
curl "$WF_SERVER/api/workflows/runs/<runId>"
```

### Example: content flag review (hook)

```bash
curl -X POST "$WF_SERVER/api/workflows/content-flag-review" \
  -H 'Content-Type: application/json' \
  -d '{"flagId":"flag_123","questionId":"q_456","flagType":"low_discrimination"}'

curl -X POST "$WF_SERVER/api/workflows/resume" \
  -H 'Content-Type: application/json' \
  -d '{"token":"content-flag-review:flag_123","data":{"decision":"approve","reviewerId":"admin_user"}}'
```

## Layout

```
workflows/           # "use workflow" orchestrators + "use step" helpers
workflow-server/     # Express routes (Nitro entry)
nitro.config.ts      # Workflow/Nitro runtime config
vitest.workflow.config.ts
artifacts/workflows/ # Lane reports (gitignored)
```

## Safety notes

- `db-health-cycle` with `generateContent: true` may invoke AI — off by default.
- Production cron jobs in `functions/api/cron/` remain the Edge runtime path; these workflows are for local/operator automation with retries and observability.
- Step failures on critical tasks stop the lane; non-critical tasks (e.g. deduplicate) log warnings and continue.
