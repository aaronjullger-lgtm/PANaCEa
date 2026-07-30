/**
 * Langfuse + LangSmith tracing handler factory.
 *
 * Returns the LangChain callback array to pass to every agent `.invoke()`.
 * - Langfuse: primary, open-source, captures full trace tree (generations, spans, scores)
 * - LangSmith: secondary, native LangGraph trace tree when LANGSMITH_TRACING=true
 *
 * Doc references (researched 2026-07):
 *  - Langfuse+LangChain JS: https://langfuse.com/integrations/frameworks/langchain
 *  - CallbackHandler import: `import { CallbackHandler } from "@langfuse/langchain"`
 *  - trace_id linking for nested agents: use startActiveObservation / propagateAttributes
 *  - LangSmith env tracing: LANGSMITH_TRACING=true + LANGSMITH_API_KEY auto-instruments
 *
 * Pattern: the orchestrator always returns a callbacks array (possibly empty).
 * Agents never branch on "is tracing on" — they just pass the array.
 *
 * @module packages/agent-orchestrator/src/clients/tracing
 */

import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { getEnv, getCapabilities, optionalEnv, getLangfuseHost } from '../config/env.js';

type LangfuseCtor = new (opts?: {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  flushAt?: number;
  timeout?: number;
}) => BaseCallbackHandler & { flushAsync?: () => Promise<void> };

let _langfuseHandler: (BaseCallbackHandler & { flushAsync?: () => Promise<void> }) | null = null;
let _initAttempted = false;

/**
 * Lazily build the Langfuse CallbackHandler, or null if unconfigured.
 * Cached for the process lifetime. Uses dynamic import so the orchestrator
 * still loads if @langfuse/langchain isn't installed (graceful degradation).
 */
async function getLangfuseHandler(): Promise<BaseCallbackHandler | null> {
  if (_initAttempted) return _langfuseHandler;
  _initAttempted = true;

  const env = getEnv();
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return null;
  }

  try {
    const mod = (await import('@langfuse/langchain')) as {
      CallbackHandler: LangfuseCtor;
    };
    _langfuseHandler = new mod.CallbackHandler({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: getLangfuseHost() ?? 'https://cloud.langfuse.com',
      flushAt: 1, // flush aggressively — infrequent agent runs, not hot-path
      timeout: 10_000,
    });
    return _langfuseHandler;
  } catch (err) {
    console.warn(
      '[agent-orchestrator] @langfuse/langchain not installed or failed to init. Langfuse tracing disabled.',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Returns the callbacks array to attach to agent invocations.
 * Async so we can dynamically load the optional @langfuse/langchain dep.
 *
 * For per-trace naming / tags / metadata in Langfuse, wrap your agent.invoke
 * in `propagateAttributes({ traceName, tags, metadata, userId, sessionId }, ...)`
 * from `@langfuse/tracing` (see agents/*.ts for the pattern).
 */
export async function getTracingCallbacks(): Promise<BaseCallbackHandler[]> {
  const handler = await getLangfuseHandler();
  return handler ? [handler] : [];
}

/** Whether ANY tracing backend is live (env-driven LangSmith counts). */
export function isTracingEnabled(): boolean {
  const caps = getCapabilities();
  return caps.langfuse || caps.langsmith;
}

/** Flush pending Langfuse events (serverless-safe / finally block). */
export async function flushTracing(): Promise<void> {
  if (_langfuseHandler?.flushAsync) {
    try {
      await _langfuseHandler.flushAsync();
    } catch {
      // silent — never block on observability
    }
  }
}

export async function shutdownTracing(): Promise<void> {
  await flushTracing();
}