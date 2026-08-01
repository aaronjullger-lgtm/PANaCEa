/**
 * Agent Protocol API Endpoint
 *
 * Implements the Agent Communication Protocol standard for
 * interoperable agent communication. Follows the agent-protocol
 * spec from langchain-ai/agent-protocol.
 *
 * Endpoints:
 *   POST /api/agents/protocol/run     — Create and execute an agent run
 *   GET  /api/agents/protocol/agents  — List available agents
 *
 * @module functions/api/agents/protocol
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext } from '../_shared/middleware';
import { invokeUnifiedAgent, getAllAgents, getBridgeHealth } from '@/lib/agents/unified';
import type { AgentContext } from '@/lib/agents/shared/types';

const RunRequestSchema = z.object({
  agentName: z.string().min(1),
  input: z.unknown(),
  threadId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const onRequestPost = authenticatedEndpoint(
  RunRequestSchema,
  async (context: AuthenticatedContext & { validated: z.infer<typeof RunRequestSchema> }) => {
    const { agentName, input, threadId, metadata } = context.validated;
    const userId = context.userId ?? 'anonymous';

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();

    const ctx: AgentContext = {
      env: context.env as AgentContext['env'],
      userId,
    };

    const start = Date.now();

    try {
      const agentResult = await invokeUnifiedAgent({
        name: agentName,
        input,
        ctx,
        trace: {
          name: `protocol/${agentName}`,
          tags: ['agent-protocol', agentName],
          metadata,
          sessionId: threadId,
        },
      });

      return new Response(JSON.stringify({
        id: runId,
        status: agentResult.status === 'ok' ? 'completed' : 'failed',
        agentName,
        input,
        output: agentResult.output,
        error: agentResult.error?.message,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      }), {
        status: agentResult.status === 'ok' ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({
        id: runId,
        status: 'failed',
        agentName,
        input,
        error: message,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
);

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context: AuthenticatedContext) => {
    const agents = await getAllAgents();
    const health = await getBridgeHealth();

    return new Response(JSON.stringify({
      agents: agents.map((a) => ({
        name: a.name,
        description: a.description,
        tier: a.tier,
        source: a.source,
        status: a.status,
      })),
      health: {
        edge: health.edge,
        node: health.nodeHttp.status === 'ok' ? 'online' : 'offline',
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
);
