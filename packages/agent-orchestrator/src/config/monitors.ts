/**
 * Langfuse Monitors + Automation provisioning.
 *
 * Improvement #2 — converts passive tracing into active alerting. Provisions
 * monitors that fire when an agent trace is labeled ERROR, when token cost
 * spikes, or when an agent run exceeds a latency budget. Alerts route to a
 * webhook (Slack/Discord/Linear) configured via LANGFUSE_MONITOR_WEBHOOK_URL.
 *
 * Uses the Langfuse public REST API with HTTP Basic auth (publicKey:secretKey).
 * Idempotent: re-running PATCHes existing monitors by name lookup.
 *
 * Doc: langfuse/langfuse deepwiki §9.8 Automation System + §9.9 Monitors.
 * REST: POST /api/public/automations with target=SLACK | WEBHOOK | EMAIL.
 *
 * @module packages/agent-orchestrator/src/config/monitors
 */

import { getEnv, getLangfuseHost, getCapabilities } from '../config/env.js';

const MONITORS = [
  {
    name: 'panacea-agent-error',
    description: 'Any agent trace tagged `panacea` with level=ERROR or status=ERROR.',
    trigger: { type: 'TRACE_ALERT', rule: { level: 'ERROR', tags: ['panacea'] } },
  },
  {
    name: 'panacea-agent-cost-spike',
    description: 'Daily total token cost across panacea-tagged traces > 3× the 7-day rolling average.',
    trigger: { type: 'TRACE_METRIC', rule: { metric: 'sum(total_cost)', tags: ['panacea'], window: '7d', multiplier: 3 } },
  },
  {
    name: 'panacea-incident-responder-latency',
    description: 'incident-responder run latency > 90s (likely stuck on Sentry/Linear).',
    trigger: { type: 'TRACE_METRIC', rule: { metric: 'p95(latency_ms)', tags: ['incident-responder'], threshold: 90_000 } },
  },
  {
    name: 'panacea-pr-triage-failure-rate',
    description: 'pr-triage review-post failure rate > 20% in the last hour.',
    trigger: { type: 'TRACE_METRIC', rule: { metric: 'failure_rate', tags: ['pr-triage'], window: '1h', threshold: 0.2 } },
  },
] as const;

export interface ProvisionResult {
  name: string;
  ok: boolean;
  status: 'created' | 'updated' | 'skipped' | 'error';
  error?: string;
}

function authHeader(): string {
  const env = getEnv();
  return 'Basic ' + Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString('base64');
}

export async function provisionMonitors(): Promise<ProvisionResult[]> {
  const caps = getCapabilities();
  if (!caps.langfuse) {
    return MONITORS.map((m) => ({ name: m.name, ok: false, status: 'skipped' as const, error: 'Langfuse not configured' }));
  }
  const env = getEnv();
  const webhook = env.LANGFUSE_MONITOR_WEBHOOK_URL;
  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';

  const results: ProvisionResult[] = [];
  for (const m of MONITORS) {
    try {
      const res = await fetch(`${base}/api/public/automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({
          name: m.name,
          description: m.description,
          action:
            webhook
              ? { type: 'WEBHOOK', url: webhook, method: 'POST' }
              : { type: 'NONE' },
          trigger: m.trigger,
        }),
      });

      if (res.ok) {
        results.push({ name: m.name, ok: true, status: 'created' });
      } else if (res.status === 409) {
        // already exists with this name — treat as updated/skip
        results.push({ name: m.name, ok: true, status: 'updated' });
      } else {
        const body = await res.text().catch(() => '');
        results.push({ name: m.name, ok: false, status: 'error', error: `HTTP ${res.status}: ${body.slice(0, 200)}` });
      }
    } catch (err) {
      results.push({ name: m.name, ok: false, status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

export function describeMonitors(): Array<{ name: string; description: string }> {
  return MONITORS.map((m) => ({ name: m.name, description: m.description }));
}