/**
 * panacea-cron-worker
 *
 * Cloudflare Worker that replaces the 3 GitHub Actions cron workflows by
 * POSTing to the /api/cron/* endpoints on the panacea Pages project.
 *
 * Why this exists:
 *   Cloudflare Pages Functions don't support cron triggers, but a standalone
 *   Worker does. This worker is intentionally tiny — it doesn't contain any
 *   business logic. All work happens in the already-tested Pages cron
 *   endpoints. The worker is just the scheduler.
 *
 * Deployment:
 *   cd crons/panacea-cron-worker
 *   npx wrangler secret put CRON_SECRET       # same value as Pages CRON_SECRET
 *   npx wrangler secret put PRODUCTION_URL    # https://studypanacea.com
 *   npx wrangler deploy
 *
 * Verify:
 *   npx wrangler tail panacea-cron-worker
 *
 * Schedule semantics (keyed by cron expression in wrangler.toml):
 *   0 * * * *       — hourly   — health-check style + hourly reservoir top-up
 *   0 /2 * * *      — 2-hourly — reservoir maintenance (matches internal policy)
 *   0 3 * * *       — daily    — analytics + daily plans
 *   0 7 * * 0       — weekly   — deep health check + user reports
 *   0 /4 * * *      — 4-hourly — push reminder batch
 */

export interface Env {
  CRON_SECRET: string;
  PRODUCTION_URL: string;       // e.g. https://studypanacea.com
  WORKER_LABEL?: string;        // purely for log tagging
}

// Every /api/cron/* endpoint expects:
//   Method: POST
//   Header: Authorization: Bearer <CRON_SECRET>
//   Body  : (ignored by most endpoints; send {} for safety)
async function callCron(env: Env, path: string): Promise<{
  path: string;
  status: number;
  ok: boolean;
  ms: number;
  error?: string;
}> {
  const start = Date.now();
  const url = `${env.PRODUCTION_URL.replace(/\/$/, '')}/api/cron/${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': `${env.WORKER_LABEL ?? 'panacea-cron'}/1.0`,
      },
      body: '{}',
    });
    return {
      path,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - start,
    };
  } catch (err) {
    return {
      path,
      status: 0,
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Map the cron expression → which endpoints to hit.
// Expressions must match wrangler.toml exactly.
const SCHEDULES: Record<string, string[]> = {
  // Hourly — fast, idempotent health + top-up
  '0 * * * *': [
    'nightly-health-check',      // light, tolerant of running hourly
  ],
  // Every 2 hours — reservoir queue maintenance
  '0 */2 * * *': [
    'reservoir-maintenance',
  ],
  // Every 4 hours — push notifications
  '0 */4 * * *': [
    'push-reminders',
  ],
  // Daily at 03:00 UTC — replaces daily-automation.yml
  '0 3 * * *': [
    'aggregate-analytics',
    'daily-prescription',
    'replenish-pool',
    'generate-daily-plans',
    'generate-daily-insights',
    'compute-content-health',
    'compute-item-metrics',
    'aggregate-distributions',
    'calibrate-items',
    'analyze-exam-outcomes',
  ],
  // Weekly — Sunday 07:00 UTC — replaces weekly-automation.yml
  '0 7 * * 0': [
    'content-quality-loop',
    'xapi-export',
    'populate-prerequisites',
    'generate-variants',
    'batch-generate-questions',
  ],
};

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const cronExpr = event.cron;
    const endpoints = SCHEDULES[cronExpr];

    if (!endpoints || endpoints.length === 0) {
      console.warn(`[panacea-cron] No endpoints mapped for cron expression: ${cronExpr}`);
      return;
    }

    console.log(
      `[panacea-cron] Trigger ${cronExpr} — firing ${endpoints.length} endpoint(s): ${endpoints.join(', ')}`
    );

    // Run endpoints in parallel; waitUntil lets them finish after the event
    // handler returns so we don't block subsequent triggers.
    const promise = Promise.all(endpoints.map((p) => callCron(env, p))).then(
      (results) => {
        for (const r of results) {
          const tag = r.ok ? 'OK' : 'FAIL';
          console.log(
            `[panacea-cron] ${tag} ${r.path} — status=${r.status} ${r.ms}ms${r.error ? ` error=${r.error}` : ''}`
          );
        }
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          console.error(
            `[panacea-cron] ${failed.length}/${results.length} endpoint(s) failed for cron ${cronExpr}`
          );
        }
      }
    );

    ctx.waitUntil(promise);
  },

  // Optional fetch handler — lets you manually trigger via:
  //   curl -X POST https://panacea-cron-worker.<acct>.workers.dev/trigger/<cron>
  //        -H "Authorization: Bearer <CRON_SECRET>"
  // Useful for testing without waiting for the next schedule.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        worker: env.WORKER_LABEL ?? 'panacea-cron',
        productionUrl: env.PRODUCTION_URL,
        schedules: Object.keys(SCHEDULES),
      });
    }

    // Manual trigger: /trigger?cron=<expression> or /trigger/<endpoint>
    if (url.pathname.startsWith('/trigger')) {
      // Direct endpoint trigger
      const pathMatch = url.pathname.match(/^\/trigger\/(.+)$/);
      if (pathMatch && pathMatch[1]) {
        const result = await callCron(env, pathMatch[1]);
        return Response.json(result);
      }
      // Cron-group trigger
      const cron = url.searchParams.get('cron');
      if (cron && SCHEDULES[cron]) {
        const results = await Promise.all(
          SCHEDULES[cron]!.map((p) => callCron(env, p))
        );
        return Response.json({ cron, results });
      }
      return new Response('Missing or unknown cron/endpoint', { status: 400 });
    }

    return new Response('panacea-cron-worker — see /health', { status: 200 });
  },
};
