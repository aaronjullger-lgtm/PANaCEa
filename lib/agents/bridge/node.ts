/**
 * Node Agent Bridge
 *
 * Bridges Edge-side agent invocations to the Node-side agent orchestrator
 * (packages/agent-orchestrator/). Uses the shared agent protocol for
 * typed communication.
 *
 * The bridge operates in two modes:
 * 1. **HTTP mode** (production): Communicates with the Node orchestrator
 *    via its HTTP API (packages/agent-orchestrator/src/server/api.ts).
 * 2. **Direct mode** (testing): Imports Node agents directly when running
 *    in a Node.js environment (tests, CLI).
 *
 * Edge-runtime safe: HTTP mode uses fetch(), no Node.js imports.
 *
 * @module lib/agents/bridge/node
 */

import type {
  AgentIdentity,
  RegistryManifest,
  InvokeRequest,
  InvokeResult,
  AgentContext,
  RegistryClient,
} from '@/lib/agents/shared/protocol';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface NodeBridgeConfig {
  /** Base URL of the Node orchestrator HTTP API */
  orchestratorUrl?: string;
  /** API key for authenticating with the orchestrator */
  apiKey?: string;
  /** Timeout for HTTP requests in ms */
  timeoutMs?: number;
  /** Whether to use direct import mode (Node.js only) */
  directMode?: boolean;
}

const DEFAULT_ORCHESTRATOR_URL = 'http://localhost:3001/api/agents';
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Node Bridge Implementation ─────────────────────────────────────────────

/**
 * NodeAgentBridge — invokes Node-side agents from the Edge runtime.
 *
 * Usage:
 * ```ts
 * const bridge = new NodeAgentBridge({
 *   orchestratorUrl: 'http://localhost:3001/api/agents',
 * });
 *
 * // Discover available Node agents
 * const manifest = await bridge.discover();
 *
 * // Invoke a Node agent
 * const result = await bridge.invoke(
 *   { agent: 'content-audit', input: { system: 'Cardiovascular' } },
 *   { userId: 'user_123' },
 * );
 * ```
 */
export class NodeAgentBridge implements RegistryClient {
  private readonly config: Required<NodeBridgeConfig>;
  private cachedManifest: RegistryManifest | null = null;
  private manifestCacheTime = 0;
  private readonly MANIFEST_CACHE_TTL_MS = 60_000; // 1 minute

  constructor(config: NodeBridgeConfig = {}) {
    this.config = {
      orchestratorUrl: config.orchestratorUrl ?? DEFAULT_ORCHESTRATOR_URL,
      apiKey: config.apiKey ?? '',
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      directMode: config.directMode ?? false,
    };
  }

  /**
   * Discover all agents available in the Node orchestrator.
   */
  async discover(): Promise<RegistryManifest> {
    // Return cached manifest if fresh
    if (this.cachedManifest && Date.now() - this.manifestCacheTime < this.MANIFEST_CACHE_TTL_MS) {
      return this.cachedManifest;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.orchestratorUrl}/discover`,
        { method: 'GET' },
      );

      if (!response.ok) {
        return this.emptyManifest('degraded');
      }

      const data = await response.json() as {
        agents: Array<{
          name: string;
          description: string;
          tier: string;
          version: string;
          tags: string[];
        }>;
      };

      const manifest: RegistryManifest = {
        source: 'node',
        baseUrl: this.config.orchestratorUrl,
        agents: data.agents.map((a) => ({
          name: a.name,
          description: a.description,
          tier: a.tier as AgentIdentity['tier'],
          runtime: 'node',
          version: a.version ?? '0.1.0',
          tags: a.tags ?? [],
        })),
        health: 'ok',
        updatedAt: new Date().toISOString(),
      };

      this.cachedManifest = manifest;
      this.manifestCacheTime = Date.now();
      return manifest;
    } catch (err) {
      console.warn('[NodeAgentBridge] Discovery failed:', err);
      return this.emptyManifest('unavailable');
    }
  }

  /**
   * Check health of a specific Node agent.
   */
  async health(agentName: string): Promise<import('@/lib/agents/shared/protocol').AgentHealth> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.orchestratorUrl}/health?agent=${encodeURIComponent(agentName)}`,
        { method: 'GET' },
      );

      if (!response.ok) {
        return {
          identity: {
            name: agentName,
            description: '',
            tier: 'ops',
            runtime: 'node',
            version: '0.1.0',
            tags: [],
          },
          status: 'unavailable',
          lastHeartbeat: new Date().toISOString(),
          uptimeMs: 0,
          metrics: { totalInvocations: 0, errorRate: 1, avgLatencyMs: 0 },
        };
      }

      return await response.json() as import('@/lib/agents/shared/protocol').AgentHealth;
    } catch {
      return {
        identity: {
          name: agentName,
          description: '',
          tier: 'ops',
          runtime: 'node',
          version: '0.1.0',
          tags: [],
        },
        status: 'unavailable',
        lastHeartbeat: new Date().toISOString(),
        uptimeMs: 0,
        metrics: { totalInvocations: 0, errorRate: 1, avgLatencyMs: 0 },
      };
    }
  }

  /**
   * Invoke a Node-side agent.
   */
  async invoke<I, O>(
    request: InvokeRequest<I>,
    ctx: AgentContext,
  ): Promise<InvokeResult<O>> {
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      if (ctx.traceContext?.traceId) {
        headers['X-Trace-Id'] = ctx.traceContext.traceId;
      }

      const response = await this.fetchWithTimeout(
        `${this.config.orchestratorUrl}/invoke`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agent: request.agent,
            input: request.input,
            userId: ctx.userId,
            trace: request.trace,
          }),
        },
        ctx.signal,
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          status: 'internal_error',
          output: null,
          error: {
            status: 'internal_error',
            message: `Node orchestrator returned ${response.status}: ${errorText}`,
          },
          agent: request.agent,
          durationMs: Date.now() - start,
        };
      }

      const data = await response.json() as {
        status: string;
        output: O | null;
        error?: { status: string; message: string; cause?: string };
        agent: string;
        durationMs: number;
        telemetry?: Record<string, unknown>;
      };

      return {
        status: data.status as InvokeResult['status'],
        output: data.output,
        error: data.error
          ? {
              status: data.error.status as InvokeResult['error'] extends infer E | null
                ? E extends { status: infer S } ? S : never
                : never,
              message: data.error.message,
              cause: data.error.cause,
            }
          : null,
        agent: data.agent,
        durationMs: data.durationMs,
        telemetry: data.telemetry,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: request.agent },
        agent: request.agent,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check if the Node orchestrator is reachable.
   */
  async isReachable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.orchestratorUrl}/health`,
        { method: 'GET' },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate the cached manifest (force re-discovery on next call).
   */
  invalidateCache(): void {
    this.cachedManifest = null;
    this.manifestCacheTime = 0;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private emptyManifest(health: RegistryManifest['health']): RegistryManifest {
    return {
      source: 'node',
      agents: [],
      health,
      updatedAt: new Date().toISOString(),
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    // Combine external signal with timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let defaultBridge: NodeAgentBridge | null = null;

/**
 * Get or create the default NodeAgentBridge singleton.
 */
export function getNodeBridge(config?: NodeBridgeConfig): NodeAgentBridge {
  if (!defaultBridge) {
    defaultBridge = new NodeAgentBridge(config);
  }
  return defaultBridge;
}

/**
 * Reset the singleton (for testing).
 */
export function resetNodeBridge(): void {
  defaultBridge = null;
}
