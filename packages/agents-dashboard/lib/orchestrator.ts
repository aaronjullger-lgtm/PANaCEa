'use client';

const ORCHESTRATOR_BASE = '/api/orchestrator';

export interface AgentInfo {
  role: string;
  name: string;
  description: string;
  inputHint: string;
}

export interface HealthInfo {
  ok: boolean;
  llm: string;
  model: string;
  environment: string;
  langfuse: boolean;
  langsmith: boolean;
  qdrant: boolean;
  composio: boolean;
  linear: boolean;
  n8n: boolean;
  github: boolean;
  sentry: boolean;
  vercel: boolean;
  runnable: boolean;
}

export interface InvokeResult {
  runId: string;
  role: string;
  startedAt: string;
  finishedAt: string;
  output: string;
  messageCount: number;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORCHESTRATOR_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`orchestrator ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthInfo> {
  return http<HealthInfo>('/health');
}

export function listAgents(): Promise<{ agents: AgentInfo[] }> {
  return http<{ agents: AgentInfo[] }>('/agents');
}

export function invokeAgent(role: string, messages: Array<{ role: string; content: string }>): Promise<InvokeResult> {
  return http<InvokeResult>(`/agents/${role}/invoke`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

export interface StreamEvent {
  event: string;
  data: unknown;
}

/**
 * Stream an agent run via SSE. Yields events as they arrive (token-level
 * on_chat_model_stream, tool calls, completion). Falls back to the non-streaming
 * invokeAgent if the orchestrator returns a non-SSE response.
 */
export async function* streamAgent(
  role: string,
  messages: Array<{ role: string; content: string }>,
  threadId?: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${ORCHESTRATOR_BASE}/agents/${role}/invoke-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, threadId }),
  });

  if (!res.ok || !res.headers.get('Content-Type')?.includes('text/event-stream')) {
    const result = await invokeAgent(role, messages);
    yield { event: 'complete', data: { output: result.output } };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as StreamEvent;
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export interface MemoryResult {
  collection: string;
  query: string;
  results: Array<{ id: string | number; score: number; payload: Record<string, unknown> }>;
}

export function recallMemory(collection: string, query: string): Promise<MemoryResult> {
  const q = new URLSearchParams({ query, limit: '10' });
  return http<MemoryResult>(`/memories/${collection}?${q.toString()}`);
}