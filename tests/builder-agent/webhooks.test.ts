import { describe, expect, it } from 'vitest';
import { normalizeWebhook } from '../../workers/builder-agent/src/webhooks/handlers';

describe('BuilderAgent webhook normalization', () => {
  it('normalizes GitHub issue opened', () => {
    const intake = normalizeWebhook('github', 'issues', {
      action: 'opened',
      issue: { number: 42, title: 'Bug', body: 'Details' },
    });
    expect(intake?.taskSource).toBe('github');
    expect(intake?.sourceId).toBe('42');
    expect(intake?.objective).toContain('Bug');
  });

  it('returns null for unhandled GitHub events', () => {
    expect(normalizeWebhook('github', 'push', {})).toBeNull();
  });

  it('normalizes Sentry issue alert', () => {
    const intake = normalizeWebhook('sentry', 'issue.created', {
      issue: { id: 'sentry-1', title: 'TypeError', culprit: 'app.ts' },
    });
    expect(intake?.taskSource).toBe('sentry');
    expect(intake?.sourceId).toBe('sentry-1');
  });
});
