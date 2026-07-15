import type { DocsAdapter, IntegrationMode, ToolContext } from './types';

export function createDocsAdapter(ctx: ToolContext): DocsAdapter {
  const apiKey = ctx.env.CONTEXT7_API_KEY?.trim();
  const mode: IntegrationMode = apiKey ? 'live' : 'mocked';

  return {
    mode,

    async query(query, libraryId) {
      if (mode === 'live' && apiKey) {
        // Context7 MCP/API would be called here; record URLs in production
        return {
          answer: `Documentation lookup for: ${query}`,
          sources: [`https://context7.com/docs?q=${encodeURIComponent(query)}`],
        };
      }
      return {
        answer: `Mock docs: ${query}${libraryId ? ` (${libraryId})` : ''}`,
        sources: ['https://developers.cloudflare.com/agents/'],
      };
    },
  };
}
