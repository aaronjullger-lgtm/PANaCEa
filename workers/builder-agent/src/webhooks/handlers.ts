/**
 * Webhook handlers — normalize external events into intake payloads.
 */

import type { IntakePayload, TaskSource } from '@/lib/builder-agent/state/types';
import { redactUnknown } from '@/lib/builder-agent/observability/redaction';

export function normalizeGitHubWebhook(
  eventType: string,
  payload: Record<string, unknown>
): IntakePayload | null {
  if (eventType === 'issues' && payload.action === 'opened') {
    const issue = payload.issue as { number: number; title: string; body?: string };
    return {
      taskSource: 'github',
      sourceId: String(issue.number),
      objective: `${issue.title}\n\n${issue.body ?? ''}`,
      requestingUser: 'github-webhook',
    };
  }
  return null;
}

export function normalizeLinearWebhook(
  eventType: string,
  payload: Record<string, unknown>
): IntakePayload | null {
  if (eventType.includes('Issue') && payload.data) {
    const data = payload.data as { id?: string; title?: string; description?: string };
    if (!data.id || !data.title) return null;
    return {
      taskSource: 'linear',
      sourceId: data.id,
      objective: `${data.title}\n\n${data.description ?? ''}`,
      requestingUser: 'linear-webhook',
    };
  }
  return null;
}

export function normalizeSentryWebhook(
  eventType: string,
  payload: Record<string, unknown>
): IntakePayload | null {
  if (eventType === 'issue.created' || eventType === 'event_alert') {
    const issue = (payload.issue ?? payload.data) as {
      id?: string;
      title?: string;
      culprit?: string;
    };
    if (!issue?.id) return null;
    return {
      taskSource: 'sentry',
      sourceId: issue.id,
      objective: `Fix Sentry issue: ${issue.title ?? issue.id}\nCulprit: ${issue.culprit ?? 'unknown'}`,
      requestingUser: 'sentry-webhook',
    };
  }
  return null;
}

export function normalizeWebhook(
  provider: TaskSource | 'github' | 'linear' | 'sentry',
  eventType: string,
  payload: Record<string, unknown>
): IntakePayload | null {
  const safe = redactUnknown(payload) as Record<string, unknown>;
  switch (provider) {
    case 'github':
      return normalizeGitHubWebhook(eventType, safe);
    case 'linear':
      return normalizeLinearWebhook(eventType, safe);
    case 'sentry':
      return normalizeSentryWebhook(eventType, safe);
    default:
      return null;
  }
}
