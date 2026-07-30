/**
 * POST /api/agents/invoke
 *
 * Production dispatch endpoint for the LangGraph runtime agent framework
 * in `lib/agents/`. Accepts `{ agent, input }` and forwards to the named
 * registered agent via `invokeAgent`.
 *
 * Security constraints:
 *   - Only encounter-tier agents are callable from production. Ops-tier
 *     agents (callgemini-auditor etc.) are dev/CI-only and rejected here.
 *   - The full aiEndpoint middleware stack applies: Clerk auth, 25 rpm
 *     rate limit, env check, CORS, error handling.
 *   - The agent registry is loaded at module-import time; this endpoint
 *     adds zero per-request cost beyond the dispatch itself.
 *
 * Distinct from /api/agents/run (the legacy Gemini tool-using agent in
 * lib/services/agents/). That endpoint runs an open-ended tool loop;
 * this one dispatches to a specific named agent with a typed I/O contract.
 *
 * @module functions/api/agents/invoke
 */

import { z } from 'zod';
import {
  aiEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import '@/lib/agents/registry.encounter';
import { invokeAgent, listAgents, getAgent } from '@/lib/agents/registry.encounter';

// ─── Allowlist ────────────────────────────────────────────────────────────

/**
 * Encounter-tier agent names exposed via this endpoint. Ops-tier agents
 * are intentionally excluded — they belong in scripts/CI, not production.
 */
const ALLOWED_AGENT_NAMES = new Set(
  listAgents()
    .filter((a) => a.tier === 'encounter')
    .map((a) => a.name),
);

// ─── Request schema ─────────────────────────────────────────────────────────

const InvokeAgentRequestSchema = z.object({
  /** Registered agent name (must appear in ALLOWED_AGENT_NAMES). */
  agent: z
    .string()
    .min(1)
    .max(64)
    .refine((name) => ALLOWED_AGENT_NAMES.has(name), {
      message: `Unknown or forbidden agent. Allowed: ${[...ALLOWED_AGENT_NAMES].join(', ')}`,
    }),
  /**
   * Agent-specific input payload. Bounded to ~256KB serialized to prevent
   * abuse — agents that need larger transcripts should paginate or compress.
   * Each agent validates the shape itself via its own Zod inputSchema.
   */
  input: z.record(z.string(), z.unknown()).refine(
    (val) => {
      try {
        return JSON.stringify(val).length <= 262144;
      } catch {
        return false;
      }
    },
    { message: 'Input payload exceeds 256KB limit.' },
  ),
});

type InvokeAgentRequest = z.infer<typeof InvokeAgentRequestSchema>;

interface InvokeAgentContext
  extends AuthenticatedContext,
    ValidatedContext<InvokeAgentRequest> {}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = aiEndpoint(
  InvokeAgentRequestSchema,
  async (context: InvokeAgentContext) => {
    const { env, auth, validated } = context;
    const log = createEndpointLogger('/api/agents/invoke', auth.userId);
    const { agent: agentName, input } = validated;

    // Defense-in-depth: re-check the allowlist at request time in case the
    // registry was mutated between module load and now.
    if (!ALLOWED_AGENT_NAMES.has(agentName)) {
      log.warn('Rejected disallowed agent name', { agentName });
      return { status: 403, error: `Agent "${agentName}" is not callable from production.` };
    }

    const def = getAgent(agentName);
    if (!def) {
      // Should be unreachable given the schema refine, but guard anyway.
      log.error('Agent passed schema but not found in registry', { agentName });
      return { status: 404, error: `Agent not found: ${agentName}` };
    }

    log.info('Invoking agent', { agentName });

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

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
        },
        userId: auth.userId,
        log: (level, message, data) => {
          if (level === 'error') log.error(message, data as Record<string, unknown> | undefined);
          else if (level === 'warn') log.warn(message, data as Record<string, unknown> | undefined);
          else log.info(message, data as Record<string, unknown> | undefined);
        },
      });

      // Persist agent results that have database counterparts.
      if (result.status === 'ok' && result.output) {
        await persistAgentResult(prisma, agentName, result.output, input, auth.userId).catch((err) => {
          log.warn('Agent result persistence failed (non-blocking)', { agentName, error: String(err).slice(0, 200) });
        });
      }

      const httpStatus =
        result.status === 'ok'
          ? 200
          : result.status === 'schema_invalid' || result.status === 'no_input'
            ? 400
            : result.status === 'rate_limited'
              ? 429
              : result.status === 'safety_blocked'
                ? 422
                : 500;

      if (httpStatus === 200) {
        return {
          data: {
            agent: result.agent,
            status: result.status,
            output: result.output,
            durationMs: result.durationMs,
            telemetry: result.telemetry,
          },
        };
      }

      return {
        status: httpStatus,
        error: result.error?.message ?? `Agent ${agentName} returned status ${result.status}`,
        data: {
          agent: result.agent,
          status: result.status,
          error: result.error,
          durationMs: result.durationMs,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body', requestsPerMinute: 25 },
);

/**
 * Maps agent output to the appropriate Prisma model and persists it.
 * Non-blocking: failures are caught by the caller and logged, never blocking
 * the agent response. Extend this function as more agents need persistence.
 */
async function persistAgentResult(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  agentName: string,
  output: unknown,
  input: unknown,
  userId: string,
): Promise<void> {
  const sessionId = (input as { sessionId?: string })?.sessionId;
  if (!sessionId) return;

  if (agentName === 'spbench-grader' && output && typeof output === 'object' && 'overallScore' in output) {
    const scores = output as {
      QC: number; CC: number; CD: number; RC: number;
      LC: number; LN: number; CS: number; PD: number;
      overallScore: number; justification: string; gradedBy?: string;
    };
    await prisma.spbenchScore.upsert({
      where: { sessionId },
      create: {
        id: crypto.randomUUID(),
        sessionId,
        queryCompetence: scores.QC,
        caseCoverage: scores.CC,
        clinicalDepth: scores.CD,
        relevanceCheck: scores.RC,
        logicalConsistency: scores.LC,
        languageNaturality: scores.LN,
        clinicalSafety: scores.CS,
        professionalDemeanor: scores.PD,
        overallScore: scores.overallScore,
        justification: scores.justification,
      },
      update: {
        queryCompetence: scores.QC,
        caseCoverage: scores.CC,
        clinicalDepth: scores.CD,
        relevanceCheck: scores.RC,
        logicalConsistency: scores.LC,
        languageNaturality: scores.LN,
        clinicalSafety: scores.CS,
        professionalDemeanor: scores.PD,
        overallScore: scores.overallScore,
        justification: scores.justification,
      },
    });
  }
}