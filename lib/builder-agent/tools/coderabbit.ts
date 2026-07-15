import type { CodeRabbitAdapter, IntegrationMode, ToolContext } from './types';

export function createCodeRabbitAdapter(ctx: ToolContext): CodeRabbitAdapter {
  // CodeRabbit integrates via GitHub PR comments in v1
  const mode: IntegrationMode = ctx.env.GITHUB_TOKEN ? 'live' : 'mocked';

  return {
    mode,

    async getReviewFeedback(prUrl) {
      if (mode === 'mocked') {
        return [
          'Consider adding a regression test for the edge case.',
          'Validate error handling matches repository patterns.',
        ];
      }
      // Production: parse CodeRabbit bot comments from GitHub PR
      return [`Review feedback for ${prUrl}: no CodeRabbit comments parsed in v1`];
    },
  };
}
