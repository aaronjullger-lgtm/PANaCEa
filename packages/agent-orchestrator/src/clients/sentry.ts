/**
 * Sentry client — for the incident-responder agent.
 *
 * Reads recent issues from a Sentry org via the REST API. Filing/updates back
 * to Sentry are intentionally NOT done by agents — Sentry finds the bug, Linear
 * tracks the action. Auth via SENTRY_AUTH_TOKEN.
 *
 * Doc references (researched 2026-07):
 *  - Issues list: GET https://sentry.io/api/0/organizations/{org}/issues/
 *  - Auth: Bearer token from https://sentry.io/settings/auth-tokens/ (scope: org:read, project:read, issue:read)
 *
 * @module packages/agent-orchestrator/src/clients/sentry
 */

import { getEnv, getCapabilities } from '../config/env.js';

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  firstSeen: string;
  lastSeen: string;
  count: string;
  level: string;
  status: string;
  url: string;
  project: { name: string; slug: string };
}

export async function listRecentIssues(limit = 10, query = 'is:unresolved'): Promise<SentryIssue[]> {
  if (!getCapabilities().sentry) return [];
  const env = getEnv();
  const org = env.SENTRY_ORG;
  const token = env.SENTRY_AUTH_TOKEN;
  if (!org || !token) return [];
  try {
    const url = new URL(`https://sentry.io/api/0/organizations/${org}/issues/`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('query', query);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[agent-orchestrator] Sentry issues list non-ok: ${res.status}`);
      return [];
    }
    const j = (await res.json()) as Array<{
      id: string;
      shortId: string;
      title: string;
      culprit: string;
      firstSeen: string;
      lastSeen: string;
      count: string;
      level: string;
      status: string;
      permalink: string;
      project: { name: string; slug: string };
    }>;
    return j.map((i) => ({
      id: i.id,
      shortId: i.shortId,
      title: i.title,
      culprit: i.culprit,
      firstSeen: i.firstSeen,
      lastSeen: i.lastSeen,
      count: i.count,
      level: i.level,
      status: i.status,
      url: i.permalink,
      project: i.project,
    }));
  } catch (err) {
    console.warn('[agent-orchestrator] Sentry issues list failed:', err);
    return [];
  }
}

export async function getIssueDetails(issueId: string): Promise<SentryIssue | null> {
  if (!getCapabilities().sentry) return null;
  const env = getEnv();
  if (!env.SENTRY_AUTH_TOKEN) return null;
  try {
    const res = await fetch(`https://sentry.io/api/0/issues/${issueId}/`, {
      headers: { Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as SentryIssue & { permalink?: string };
    return { ...j, url: j.permalink ?? j.url ?? `https://sentry.io/issues/${issueId}/` };
  } catch (err) {
    console.warn(`[agent-orchestrator] Sentry getIssueDetails ${issueId} failed:`, err);
    return null;
  }
}

export function isSentryEnabled(): boolean {
  return getCapabilities().sentry;
}