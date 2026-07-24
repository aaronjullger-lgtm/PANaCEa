/**
 * LangSmith Tracing Configuration
 *
 * Wraps LangChain/LangGraph calls with observability.
 * Set these env vars in your LangGraph server environment:
 *
 *   LANGSMITH_TRACING=true
 *   LANGSMITH_API_KEY=<from 1Password LANGSMITH_API_KEY>
 *   LANGSMITH_ENDPOINT=https://api.smith.langchain.com
 *
 * For Edge functions (Cloudflare), tracing is set per-call
 * via the LangChain callback manager — see lib/agents/edge-trace.ts.
 */

export const LANGSMITH_CONFIG = {
  tracing: process.env.LANGSMITH_TRACING === 'true',
  apiKey: process.env.LANGSMITH_API_KEY ?? '',
  endpoint: process.env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com',
  project: process.env.LANGSMITH_PROJECT ?? 'panacea',
} as const;

export function isTracingEnabled(): boolean {
  return LANGSMITH_CONFIG.tracing && LANGSMITH_CONFIG.apiKey.length > 0;
}
