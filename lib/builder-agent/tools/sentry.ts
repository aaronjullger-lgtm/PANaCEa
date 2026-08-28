import type { IntegrationMode, SentryAdapter, ToolContext } from './types';

export function createSentryAdapter(ctx: ToolContext): SentryAdapter {
  const token = ctx.env.SENTRY_AUTH_TOKEN?.trim();
  const org = ctx.env.SENTRY_ORG?.trim();
  const mode: IntegrationMode = token && org ? 'live' : 'mocked';

  return {
    mode,

    async getIssue(issueId) {
      if (mode === 'live' && token && org) {
        const res = await fetch(
          `https://sentry.io/api/0/organizations/${org}/issues/${issueId}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error(`Sentry issue fetch failed: ${res.status}`);
        const data = (await res.json()) as {
          title: string;
          culprit?: string;
          metadata?: { type?: string };
        };
        return {
          title: data.title,
          culprit: data.culprit,
          stackTrace: data.metadata?.type,
        };
      }
      return {
        title: `Mock Sentry ${issueId}`,
        culprit: 'app/example.ts',
        stackTrace: 'Error: mock stack trace',
        release: 'mock@1.0.0',
      };
    },
  };
}
