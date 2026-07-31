/**
 * Node Agent HTTP Client
 *
 * Lightweight HTTP client for communicating with the Node-side agent
 * orchestrator (packages/agent-orchestrator/). This allows Edge-side code
 * to discover and invoke Node agents without importing Node-only dependencies
 * (Qdrant, Linear, GitHub, Sentry SDKs) into the Cloudflare Edge bundle.
 *
 * The Node orchestrator exposes a REST API on configurable port (default :4100).
 * This client is a thin wrapper around fetch() — Edge-compatible, no Node deps.
 *
 * When the orchestrator is not running, Node agents are listed as "offline"
 * and invocations return a clear error rather than crashing.
 *
 * @module lib/agents/node-client
 */

import type { AgentContext, InvokeResult } from './shared/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NodeAgentInfo {
  role: string;
  name: string;
  description: string;
  inputHint: string;
  status: 'online' | 'offline' | 'unknown';
}

export interface NodeAgentInvokeInput {
  role: string;
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
  threadId?: string;
}

export interface NodeAgentInvokeOutput {
  messages: Array<{ role: string; content: string; tool_calls?: unknown[] }>;
}

export interface NodeAgentHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  agents: NodeAgentInfo[];
  uptime: number;
  version: string;
}

// ─── Configuration ─────────────────────────────────────────────────────────

const DEFAULT_ORCHESTRATOR_URL = 'http://localhost:4100';

function getOrchestratorUrl(): string {
  // In Edge runtime, use env var; in Node/local, fall back to default
  if (typeof process !== 'undefined' && process.env?.ORCHESTRATOR_API_URL) {
    return process.env.ORCHESTRATOR_API_URL;
  }
  return DEFAULT_ORCHESTRATOR_URL;
}

// ─── Client ────────────────────────────────────────────────────────────────

/**
 * Fetch the list of available Node agents from the orchestrator.
 * Returns an empty array if the orchestrator is unreachable (no throw).
 */
export async function listNodeAgents(): Promise<NodeAgentInfo[]> {
  try {
    const baseUrl = getOrchestratorUrl();
    const response = await fetch(`${baseUrl}/agents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { agents?: NodeAgentInfo[] };
    return (data.agents ?? []).map((a) => ({ ...a, status: 'online' as const }));
  } catch {
    // Orchestrator not running — return empty, no error
    return [];
  }
}

/**
 * Check the health of the Node orchestrator.
 */
export async function checkNodeOrchestratorHealth(): Promise<NodeAgentHealthResponse | null> {
  try {
    const baseUrl = getOrchestratorUrl();
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;

    return (await response.json()) as NodeAgentHealthResponse;
  } catch {
    return null;
  }
}

/**
 * Invoke a Node agent via the orchestrator HTTP API.
 *
 * This is a fire-and-forget proxy — the orchestrator handles the full
 * LangGraph ReAct loop, tool execution, and tracing. The Edge side just
 * waits for the final result.
 */
export async function invokeNodeAgent(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();

  try {
    const baseUrl = getOrchestratorUrl();

    // Convert the generic input to the Node agent message format
    const messages = convertInputToMessages(input);

    const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(role)}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth context if available
        ...(ctx.userId ? { 'X-User-Id': ctx.userId } : {}),
      },
      body: JSON.stringify({
        messages,
        threadId: `edge-${role}-${Date.now()}`,
      }),
      signal: ctx.signal ?? AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      return {
        status: 'internal_error',
        output: null,
        error: {
          status: 'internal_error',
          message: `Node orchestrator returned ${response.status}: ${errorBody.slice(0, 200)}`,
          cause: role,
        },
        agent: `node:${role}`,
        durationMs: Date.now() - start,
      };
    }

    const data = (await response.json()) as { messages?: NodeAgentInvokeOutput['messages'] };
    const output = extractFinalResponse(data.messages ?? []);

    return {
      status: 'ok',
      output,
      error: null,
      agent: `node:${role}`,
      durationMs: Date.now() - start,
      telemetry: {
        source: 'node-orchestrator',
        messageCount: data.messages?.length ?? 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish "orchestrator not running" from other errors
    if (message.includes('fetch') || message.includes('ECONNREFUSED') || message.includes('Connection refused')) {
      return {
        status: 'internal_error',
        output: null,
        error: {
          status: 'internal_error',
          message: `Node orchestrator is not running at ${getOrchestratorUrl()}. Start it with: cd packages/agent-orchestrator && npm run dev`,
          cause: role,
        },
        agent: `node:${role}`,
        durationMs: Date.now() - start,
      };
    }

    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message, cause: role },
      agent: `node:${role}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Stream a Node agent invocation via SSE.
 * Returns a ReadableStream of SSE events for the Edge endpoint to proxy.
 */
export async function streamNodeAgent(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<Response> {
  const baseUrl = getOrchestratorUrl();
  const messages = convertInputToMessages(input);

  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(role)}/invoke-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.userId ? { 'X-User-Id': ctx.userId } : {}),
    },
    body: JSON.stringify({
      messages,
      threadId: `edge-stream-${role}-${Date.now()}`,
    }),
    signal: ctx.signal ?? AbortSignal.timeout(300_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Node orchestrator stream failed: ${response.status}`);
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a generic input payload to the message format expected by Node agents.
 */
function convertInputToMessages(
  input: unknown,
): Array<{ role: 'user' | 'system' | 'assistant'; content: string }> {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;

    // If input already has messages array, use it
    if (Array.isArray(obj.messages)) {
      return obj.messages as Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
    }

    // If input has a prompt/message field
    if (typeof obj.prompt === 'string') {
      return [{ role: 'user', content: obj.prompt }];
    }
    if (typeof obj.message === 'string') {
      return [{ role: 'user', content: obj.message }];
    }
    if (typeof obj.query === 'string') {
      return [{ role: 'user', content: obj.query }];
    }

    // Fallback: serialize the whole object
    return [{ role: 'user', content: JSON.stringify(obj) }];
  }

  return [{ role: 'user', content: String(input) }];
}

/**
 * Extract the final assistant response from a list of LangChain messages.
 */
function extractFinalResponse(
  messages: Array<{ role: string; content: string }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && (msg.role === 'ai' || msg.role === 'assistant')) {
      return msg.content;
    }
  }
  return messages.at(-1)?.content ?? '';
}
