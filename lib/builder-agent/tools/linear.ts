import { buildIdempotencyKey } from '../idempotency/keys';
import { withIdempotency } from '../idempotency/store';
import type { IntegrationMode, LinearAdapter, ToolContext } from './types';

export function createLinearAdapter(ctx: ToolContext): LinearAdapter {
  const apiKey = ctx.env.LINEAR_API_KEY?.trim();
  const mode: IntegrationMode = apiKey ? 'live' : 'mocked';

  return {
    mode,

    async getIssue(id) {
      if (mode === 'live' && apiKey) {
        const res = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `query($id: String!) { issue(id: $id) { title description } }`,
            variables: { id },
          }),
        });
        if (!res.ok) throw new Error(`Linear issue fetch failed: ${res.status}`);
        const data = (await res.json()) as {
          data?: { issue?: { title: string; description?: string } };
        };
        const issue = data.data?.issue;
        if (!issue) throw new Error('Linear issue not found');
        return { title: issue.title, description: issue.description ?? '' };
      }
      return { title: `Mock Linear ${id}`, description: 'Mock description' };
    },

    async addComment(issueId, body, idempotencyKey) {
      const key = idempotencyKey || buildIdempotencyKey(ctx.runId, 'linear_comment', issueId);
      const { value, duplicate } = await withIdempotency(ctx.idempotency, key, async () => {
        if (ctx.dryRun || mode !== 'live') {
          return { commentId: `mock-comment-${issueId}` };
        }
        // GraphQL commentCreate would go here in production
        return { commentId: `linear-${crypto.randomUUID()}` };
      });
      return { ...value, commentId: duplicate ? `${value.commentId}-dup` : value.commentId };
    },
  };
}
