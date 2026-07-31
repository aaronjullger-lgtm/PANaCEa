/**
 * POST /api/agents/invoke/stream
 *
 * SSE streaming variant of /api/agents/invoke. Returns Server-Sent Events
 * so the frontend can show real-time progress while the agent runs:
 *   event: agent_started  — agent invocation begins
 *   event: agent_completed — final result ready (data payload matches invoke)
 *   event: agent_error     — agent failed (error payload)
 *
 * Token-level streaming (word-by-word) requires exposing compiled graph
 * .streamEvents() — not yet implemented at the registry level. This endpoint
 * provides event-level streaming (lifecycle events) which is sufficient for
 * UX loading states and progress feedback.
 *
 * @module functions/api/agents/invoke/stream
 */

import { z } from 'zod';
import {
  aiEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import '@/lib/agents/registry.encounter';
import { invokeAgent, listAgents } from '@/lib/agents/registry.encounter';

const ALLOWED_AGENT_NAMES = new Set(
  listAgents().filter((a) => a.tier === 'encounter').map((a) => a.name),
);

const StreamAgentRequestSchema = z.object({
  agent: z
    .string()
    .min(1)
    .max(64)
    .refine((name) => ALLOWED_AGENT_NAMES.has(name), {
      message: `Unknown or forbidden agent. Allowed: ${[...ALLOWED_AGENT_NAMES].join(', ')}`,
    }),
  input: z.record(z.string(), z.unknown()).refine(
    (val) => {
      try { return JSON.stringify(val).length <= 262144; } catch { return false; }
    },
    { message: 'Input payload exceeds 256KB limit.' },
  ),
});

type StreamAgentRequest = z.infer<typeof StreamAgentRequestSchema>;

interface StreamAgentContext
  extends AuthenticatedContext,
    ValidatedContext<StreamAgentRequest> {}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sanitizeClientError(message: string | undefined): string {
  if (!message) return 'Agent request failed.';
  const stripped = message.replace(/https?:\/\/[^\s'"<>]+/gi, '[url]');
  return stripped.length > 120 ? stripped.slice(0, 117) + '...' : stripped;
}

export const onRequestPost = aiEndpoint(
  StreamAgentRequestSchema,
  async (context: StreamAgentContext) => {
    const { env, auth, validated } = context;
    const log = createEndpointLogger('/api/agents/invoke/stream', auth.userId);
    const { agent: agentName, input } = validated;

    if (!ALLOWED_AGENT_NAMES.has(agentName)) {
      return { status: 403, error: `Agent "${agentName}" is not callable from production.` };
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(sseEvent('agent_started', { agent: agentName })));

        try {
          const result = await invokeAgent(agentName, input, {
            env: {
              GEMINI_API_KEY: env.GEMINI_API_KEY,
              OPENAI_API_KEY: env.OPENAI_API_KEY,
              ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
              DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
              DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY,
              LANGSMITH_API_KEY: env.LANGSMITH_API_KEY,
              LANGSMITH_PROJECT: env.LANGSMITH_PROJECT,
              LANGSMITH_SAMPLE_RATE: env.LANGSMITH_SAMPLE_RATE,
            },
            userId: auth.userId,
          });

          if (result.status === 'ok') {
            controller.enqueue(
              encoder.encode(sseEvent('agent_completed', {
                agent: result.agent,
                status: result.status,
                output: result.output,
                durationMs: result.durationMs,
                telemetry: result.telemetry,
              })),
            );
          } else {
            controller.enqueue(
              encoder.encode(sseEvent('agent_error', {
                agent: result.agent,
                status: result.status,
                error: { status: result.status, message: sanitizeClientError(result.error?.message) },
                durationMs: result.durationMs,
              })),
            );
          }
        } catch (err) {
          log.error('Stream agent unhandled error', { agentName, error: String(err).slice(0, 200) });
          controller.enqueue(
            encoder.encode(sseEvent('agent_error', {
              agent: agentName,
              status: 'internal_error',
              error: { status: 'internal_error', message: sanitizeClientError(err instanceof Error ? err.message : String(err)) },
              durationMs: 0,
            })),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  },
  { source: 'body', requestsPerMinute: 25 },
);