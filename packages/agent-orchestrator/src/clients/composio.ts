/**
 * Composio-backed tool surface — managed Linear/Sentry/GitHub actions.
 *
 * Improvement #6 — lets the incident-responder agent call Composio's pre-built,
 * authenticated actions (Linear attachments/hierarchy/labels, Sentry detail
 * enrichment, GitHub review actions) instead of the orchestrator hand-rolling
 * each REST payload. Composio handles OAuth/connected-account auth centrally.
 *
 * GRACEFUL FALLBACK: every method here degrades to the existing raw-fetch
 * clients (clients/linear.ts, clients/sentry.ts) when Composio is unconfigured
 * OR the connected account isn't provisioned. The agent never sees the
 * difference — it gets a typed result either way.
 *
 * Requires a Composio connected account: the operator links Linear + Sentry in
 * the Composio dashboard (app.composio.dev), then sets COMPOSIO_CONNECTED_USER
 * (any stable user-id string Composio recognizes).
 *
 * Doc: composio-core SDK (composio-core@0.5.x). getToolList(apps),
 *      executeToolAction(toolName, args, userId).
 *
 * @module packages/agent-orchestrator/src/clients/composio
 */

import { getComposioClient, isComposioEnabled } from './integrations.js';
import { getEnv } from '../config/env.js';
import * as linearFallback from './linear.js';
import * as sentryFallback from './sentry.js';

interface ComposioActionResult {
  data?: unknown;
  error?: string;
  successful: boolean;
}

interface ComposioClient {
  getToolList?: (opts: { user_id: string; apps: string[] }) => Promise<unknown[]>;
  executeToolAction?: (opts: { toolName: string; args: Record<string, unknown>; userId: string }) => Promise<ComposioActionResult>;
}

export function isComposioReady(): boolean {
  return isComposioEnabled() && !!getEnv().COMPOSIO_CONNECTED_USER;
}

async function runComposioAction(toolName: string, args: Record<string, unknown>): Promise<ComposioActionResult | null> {
  if (!isComposioReady()) return null;
  const client = (await getComposioClient()) as ComposioClient | null;
  const userId = getEnv().COMPOSIO_CONNECTED_USER!;
  if (!client?.executeToolAction) return null;
  try {
    return await client.executeToolAction({ toolName, args, userId });
  } catch (err) {
    console.warn(`[agent-orchestrator] Composio action "${toolName}" failed:`, err);
    return { successful: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Linear via Composio (fallback to clients/linear.ts) ────────────────────

export async function createLinearIssue(input: linearFallback.LinearIssueInput): Promise<linearFallback.LinearIssue | null> {
  const res = await runComposioAction('LINEAR_CREATE_ISSUE', {
    title: input.title,
    description: input.description ?? '',
    team_id: input.teamId,
    priority: input.priority,
    labels: input.labels,
    assignee_id: input.assigneeId,
  });
  if (res?.successful && res.data) {
    const d = res.data as { id?: string; identifier?: string; title?: string; url?: string };
    return { id: d.id ?? '', identifier: d.identifier ?? '', title: d.title ?? input.title, url: d.url ?? '' };
  }
  // fallback to direct SDK
  return linearFallback.createIssue(input);
}

export async function searchLinearIssues(query: string, limit = 20): Promise<linearFallback.LinearIssue[]> {
  const res = await runComposioAction('LINEAR_SEARCH_ISSUES', { query, limit });
  if (res?.successful && Array.isArray(res.data)) {
    return (res.data as Array<{ id: string; identifier: string; title: string; url: string }>).map((d) => ({
      id: d.id,
      identifier: d.identifier,
      title: d.title,
      url: d.url,
    }));
  }
  return linearFallback.searchIssues(query, limit);
}

// ─── Sentry via Composio (fallback to clients/sentry.ts) ────────────────────

export async function listSentryIssues(limit = 10, query = 'is:unresolved'): Promise<sentryFallback.SentryIssue[]> {
  const res = await runComposioAction('SENTRY_LIST_ISSUES', { limit, query });
  if (res?.successful && Array.isArray(res.data)) {
    return res.data as sentryFallback.SentryIssue[];
  }
  return sentryFallback.listRecentIssues(limit, query);
}