/**
 * Node Agent Registry Client
 *
 * Discovers and invokes agents running in the Node-side agent-orchestrator
 * package (packages/agent-orchestrator/). Communicates via HTTP to the
 * orchestrator's API server.
 *
 * Edge-safe: uses only fetch() — no Node APIs.
 *
 * @module lib/agents/node-registry
 */

import type {
  RegistryManifest,
  AgentHealth,
  InvokeRequest,
  InvokeResult,
  AgentContext,
  RegistryClient,
} from './protocol';

// ─── Configuration ───────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'http://localhost:3002';

let _baseUrl: string | null = null;

export function setNodeRegistryUrl(url: string): void {
  _baseUrl = url;
}

export function getNodeRegistryUrl(): string {
  return _baseUrl ?? process.env['AGENT_ORCHESTRATOR_URL'] ?? DEFAULT_BASE_URL;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Node registry HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ─── Registry Client Implementation ──────────────────────────────────────

export const nodeRegistryClient: RegistryClient = {
  async discover(): Promise<RegistryManifest> {
    const baseUrl = getNodeRegistryUrl();
    try {
      const agents = await fetchJson<RegistryManifest['agents']>(`${baseUrl}/api/agents`);
      return {
        source: 'node',
        baseUrl,
        agents,
        health: 'ok',
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        source: 'node',
        baseUrl,
        agents: [],
        health: 'unavailable',
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async health(agentName: string): Promise<AgentHealth> {
    const baseUrl = getNodeRegistryUrl();
    try {
      return await fetchJson<AgentHealth>(`${baseUrl}/api/agents/${agentName}/health`);
    } catch {
      return {
        identity: {
          name: agentName,
          description: 'Unknown (registry unreachable)',
          tier: 'ops',
          runtime: 'node',
          version: '0.0.0',
          tags: [],
        },
        status: 'unavailable',
        lastHeartbeat: new Date().toISOString(),
        uptimeMs: 0,
        metrics: {
          totalInvocations: 0,
          errorRate: 1,
          avgLatencyMs: 0,
          lastError: 'Registry unreachable',
        },
      };
    }
  },

  async invoke<I, O>(request: InvokeRequest<I>, ctx: AgentContext): Promise<InvokeResult<O>> {
    const baseUrl = getNodeRegistryUrl();
    const start = Date.now();

    try {
      const result = await fetchJson<InvokeResult<O>>(`${baseUrl}/api/agents/${request.agent}/invoke`, {
        method: 'POST',
        body: JSON.stringify({
          input: request.input,
          trace: request.trace,
          userId: ctx.userId,
        }),
      });

      return {
        ...result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: {
          status: 'internal_error',
          message: `Node agent invocation failed: ${message}`,
          cause: request.agent,
        },
        agent: request.agent,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ─── Convenience Functions ───────────────────────────────────────────────

let _cachedManifest: RegistryManifest | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get the Node registry manifest with caching.
 */
export async function getNodeManifest(): Promise<RegistryManifest> {
  if (_cachedManifest && Date.now() < _cacheExpiry) {
    return _cachedManifest;
  }

  _cachedManifest = await nodeRegistryClient.discover();
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cachedManifest;
}

/**
 * Check if a Node agent exists by name.
 */
export async function hasNodeAgent(name: string): Promise<boolean> {
  const manifest = await getNodeManifest();
  return manifest.agents.some((a) => a.name === name);
}

/**
 * List all Node-side agents.
 */
export async function listNodeAgents(): Promise<RegistryManifest['agents']> {
  const manifest = await getNodeManifest();
  return manifest.agents;
}

/**
 * Invoke a Node-side agent by name.
 */
export async function invokeNodeAgent<I, O>(
  agentName: string,
  input: I,
  ctx: AgentContext,
): Promise<InvokeResult<O>> {
  return nodeRegistryClient.invoke<I, O>({ agent: agentName, input }, ctx);
}

/**
 * Clear the cached manifest (useful for testing).
 */
export function clearNodeRegistryCache(): void {
  _cachedManifest = null;
  _cacheExpiry = 0;
}
