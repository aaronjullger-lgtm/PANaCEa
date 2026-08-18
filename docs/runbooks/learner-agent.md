# Learner Agent Runbook

## Local setup

### 1. Enable flags

Cloudflare Pages / `.dev.vars` (names only — do not commit values):

```
ENABLE_LEARNER_AGENT=true
VITE_ENABLE_LEARNER_AGENT=true
```

### 2. Start app

```bash
npm install
npm run dev:wrangler
```

Use the dev auto-login query parameter documented in `.cursorrules` when testing auth locally.

### 3. Run learner-agent tests

```bash
npm test -- tests/learner-agent
```

### 4. Worker (optional local)

```bash
cd workers/learner-agent
npm install
npx wrangler dev
```

Set `LEARNER_AGENT_WORKER_URL` to your wrangler dev origin for WebSocket connect.

## Staging deployment

1. Deploy worker: `cd workers/learner-agent && npx wrangler deploy --env staging` (configure `[env.staging]` if needed)
2. Set Pages secrets/vars:
   - `ENABLE_LEARNER_AGENT=true`
   - `LEARNER_AGENT_WORKER_URL=https://<worker-host>`
   - `VITE_ENABLE_LEARNER_AGENT=true` (build-time)
3. Deploy Pages: `npm run deploy:local` or CI pipeline
4. Verify with test account:
   - `GET /api/learner-agent/recommendation`
   - Dashboard panel shows "Next best action"

## Production

**Do not enable broadly without explicit approval.**

Checklist before production:

- [ ] Evaluation baselines recorded (`docs/evaluations/learner-agent-evaluations.md`)
- [ ] Sentry tags for `correlationId` verified
- [ ] Rate limits observed (connect 30/min, run 25/min)
- [ ] Worker DO migrations applied
- [ ] No PHI in logs spot-check

## Incident response

| Symptom | Check |
|---------|-------|
| 404 on all learner-agent routes | `ENABLE_LEARNER_AGENT` unset |
| 401 on connect | Clerk token; KV token TTL expired |
| Wrong user's recommendation | Resolver bug — check Clerk → userId mapping |
| Model invents deadlines | Prompt regression — run faithfulness eval |
| FSRS drift | Ensure no tool writes `UserProgress` FSRS fields |

## Rollback

1. Set `ENABLE_LEARNER_AGENT=false` on Pages
2. Rebuild frontend with `VITE_ENABLE_LEARNER_AGENT=false`
3. Worker can remain deployed (inactive without connect traffic)

## Correlation IDs

Pass `x-correlation-id` on API requests. Returned in response headers and included in structured logs.
