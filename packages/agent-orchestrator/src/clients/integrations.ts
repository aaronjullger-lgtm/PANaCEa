/**
 * n8n + Composio clients — workflow triggers + tool aggregator.
 *
 * n8n: trigger named workflows by tag via the n8n REST API.
 *   Doc: https://docs.n8n.io/api/  (N8N_API_URL + N8N_API_KEY from n8n Cloud / self-host)
 *   Common practice for triggering workflows programmatically: a webhook-trigger
 *   workflow exposes a URL; we POST to it. Some n8n Cloud plans also expose a
 *   workflow execute REST endpoint. We try the webhook pattern first (most portable),
 *   then fall back to N8N's REST execute endpoint (if enabled on the host).
 *
 * Composio: pulls connected apps (GitHub/Linear/Sentry/etc.) as callable tools.
 *   Doc: https://docs.composio.dev/  (`composio-core` on npm; COMPOSIO_API_KEY)
 *   The orchestrator exposes Composio tools to LangGraph agents via
 *   DynamicStructuredTool wrappers in tools/composio.ts.
 *
 * Depend on env vars being set before any method other than `is*Enabled`.
 *
 * @module packages/agent-orchestrator/src/clients/integrations
 */

import { getEnv, getCapabilities } from '../config/env.js';

// ─── n8n ────────────────────────────────────────────────────────────────────

export interface N8nTriggerResult {
  workflowId: string;
  success: boolean;
  executionId?: string;
  error?: string;
}

/**
 * Trigger an n8n workflow. Two-mode strategy:
 *  (1) If N8N_API_URL ends with `/webhook/<id>` or contains `/webhook/`, we POST directly.
 *      User can set N8N_WEBHOOK_URLS as a JSON map of {tag: url} for ad-hoc triggers.
 *  (2) Otherwise, use the n8n REST Execute Workflow endpoint (needs an api key with execute scope).
 */
export async function triggerN8nWorkflow(
  workflowIdOrWebhook: string,
  payload: Record<string, unknown>,
): Promise<N8nTriggerResult> {
  if (!getCapabilities().n8n) {
    return { workflowId: workflowIdOrWebhook, success: false, error: 'n8n not configured' };
  }

  const env = getEnv();

  // Mode 1: webhook URL (starts with http) — most portable for n8n Cloud.
  if (/^https?:\/\//i.test(workflowIdOrWebhook)) {
    try {
      const res = await fetch(workflowIdOrWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { workflowId: workflowIdOrWebhook, success: false, error: `HTTP ${res.status}` };
      }
      let executionId: string | undefined;
      try {
        const j = (await res.json()) as Record<string, unknown>;
        executionId = typeof j.executionId === 'string' ? j.executionId : undefined;
      } catch {
        // webhook may return non-JSON
      }
      return { workflowId: workflowIdOrWebhook, success: true, executionId };
    } catch (err) {
      return { workflowId: workflowIdOrWebhook, success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Mode 2: execute by workflow ID via REST API.
  const base = (env.N8N_API_URL ?? '').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/workflows/${workflowIdOrWebhook}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': env.N8N_API_KEY ?? '',
      },
      body: JSON.stringify({ data: payload }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { workflowId: workflowIdOrWebhook, success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const j = (await res.json()) as { executionId?: string; data?: { executionId?: string } };
    const executionId = j.executionId ?? j.data?.executionId;
    return { workflowId: workflowIdOrWebhook, success: true, executionId };
  } catch (err) {
    return {
      workflowId: workflowIdOrWebhook,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isN8nEnabled(): boolean {
  return getCapabilities().n8n;
}

// ─── Composio ──────────────────────────────────────────────────────────────

let _composio: unknown | null = null;
let _composioTried = false;

/**
 * Lazily initialize the Composio client. Returns null if unconfigured or the
 * `composio-core` package is missing. The actual tool surface is built in
 * `src/tools/composio.ts` using this client.
 */
export async function getComposioClient(): Promise<unknown | null> {
  if (_composioTried) return _composio;
  _composioTried = true;
  const env = getEnv();
  if (!env.COMPOSIO_API_KEY) return null;
  try {
    const mod = (await import('composio-core')) as {
      Composio: new (opts: { apiKey: string }) => unknown;
    };
    _composio = new mod.Composio({ apiKey: env.COMPOSIO_API_KEY });
    return _composio;
  } catch (err) {
    console.warn(
      '[agent-orchestrator] composio-core not installed or failed to init. Composio tools disabled.',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function isComposioEnabled(): boolean {
  return getCapabilities().composio;
}