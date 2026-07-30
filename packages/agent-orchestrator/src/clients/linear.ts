/**
 * Linear client — direct @linear/sdk for reliability over Composio wrappers.
 *
 * Issue-management + comment + search surface used by the incident-responder
 * and content-audit agents to file action items.
 *
 * Doc references (researched 2026-07):
 *  - SDK: https://github.com/linear/linear-node-sdk  (`@linear/sdk`)
 *  - LINEAR_API_KEY: personal API key from https://linear.app/settings/api
 *
 * @module packages/agent-orchestrator/src/clients/linear
 */

import { getEnv, getCapabilities } from '../config/env.js';

export interface LinearIssueInput {
  title: string;
  description?: string;
  /** Defaults to env.LINEAR_TEAM_ID. REQUIRED if not set there. */
  teamId?: string;
  priority?: number; // 0=urgent..4=low (linear ui uses 0-4; some MCP servers use 1=urgent..4=low — we normalize)
  labels?: string[];
  assigneeId?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string; // e.g. "ENG-123"
  title: string;
  url: string;
}

let _client: import('@linear/sdk').LinearClient | null = null;
let _initTried = false;

async function getClient(): Promise<import('@linear/sdk').LinearClient | null> {
  if (_initTried) return _client;
  _initTried = true;
  const env = getEnv();
  if (!env.LINEAR_API_KEY) return null;
  try {
    const { LinearClient } = await import('@linear/sdk');
    _client = new LinearClient({ apiKey: env.LINEAR_API_KEY });
    return _client;
  } catch (err) {
    console.warn(
      '[agent-orchestrator] @linear/sdk failed to init. Linear filing disabled.',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function createIssue(input: LinearIssueInput): Promise<LinearIssue | null> {
  const client = await getClient();
  const env = getEnv();
  if (!client) return null;
  const teamId = input.teamId ?? env.LINEAR_TEAM_ID;
  if (!teamId) {
    console.warn('[agent-orchestrator] Cannot create Linear issue: LINEAR_TEAM_ID not set and no teamId provided.');
    return null;
  }
  try {
    const res = await client.createIssue({
      teamId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      labelIds: input.labels,
      assigneeId: input.assigneeId,
    });
    const issue = await res.issue;
    return {
      id: issue?.id ?? '',
      identifier: issue?.identifier ?? '',
      title: issue?.title ?? input.title,
      url: issue?.url ?? '',
    };
  } catch (err) {
    console.warn('[agent-orchestrator] Linear createIssue failed:', err);
    return null;
  }
}

export async function searchIssues(query: string, limit = 20): Promise<LinearIssue[]> {
  const client = await getClient();
  if (!client) return [];
  try {
    const res = await client.issues({
      first: limit,
      filter: { or: [{ title: { contains: query } }, { description: { contains: query } }] },
    });
    return (res.nodes ?? []).map((n) => ({ id: n.id, identifier: n.identifier, title: n.title, url: n.url }));
  } catch (err) {
    console.warn('[agent-orchestrator] Linear searchIssues failed:', err);
    return [];
  }
}

export async function addComment(issueId: string, body: string): Promise<boolean> {
  const client = await getClient();
  if (!client) return false;
  try {
    await client.createComment({ issueId, body });
    return true;
  } catch (err) {
    console.warn(`[agent-orchestrator] Linear addComment to ${issueId} failed:`, err);
    return false;
  }
}

export function isLinearEnabled(): boolean {
  return getCapabilities().linear;
}

export { getCapabilities as isLinearConfiguredHint } from '../config/env.js';