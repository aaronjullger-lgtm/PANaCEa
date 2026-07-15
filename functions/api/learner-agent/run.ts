/**
 * POST /api/learner-agent/run
 *
 * Stateless agent turn using learner tools (fallback when WebSocket DO unavailable).
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import { runAgent } from '../../../lib/services/agents/agentRunner';
import { LEARNER_AGENT_SYSTEM_PROMPT, buildLearnerContextAddendum } from '../../../lib/services/learnerAgent/prompts';
import { createLearnerAgentToolRegistry, LEARNER_AGENT_TOOL_NAMES } from '../../../lib/services/learnerAgent/tools';
import { correlationFromRequest } from '../../../lib/services/learnerAgent/observability';
import { getLearnerContext } from '../../../lib/services/learner';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';

const RunSchema = z.object({
  message: z.string().min(1).max(4000),
  includeSteps: z.boolean().optional(),
});

export const onRequestPost = aiEndpoint(
  RunSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const correlationId = correlationFromRequest(context.request);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const learnerCtx = await getLearnerContext(prisma, user.id);

      const addendum = buildLearnerContextAddendum({
        rotation: learnerCtx.profile.currentRotation,
        examDate: learnerCtx.profile.examDate,
        overdueCount: learnerCtx.dueItemCounts.overdueFsrs,
      });

      const registry = createLearnerAgentToolRegistry();
      const result = await runAgent({
        userMessage: context.validated.message,
        registry,
        config: {
          allowedTools: [...LEARNER_AGENT_TOOL_NAMES],
          allowedCategories: ['read', 'compute', 'write'],
          systemInstruction: `${LEARNER_AGENT_SYSTEM_PROMPT}\n\n${addendum}`,
          maxIterations: 6,
        },
        toolContext: {
          prisma,
          userId: user.id,
          env: context.env,
          log: (level, message, data) => {
            console.log(JSON.stringify({ level, message, correlationId, data }));
          },
        },
        geminiContext: {
          env: context.env,
          auth: context.auth,
          waitUntil: context.waitUntil,
        },
      });

      return {
        status: 200,
        data: {
          correlationId,
          finalText: result.finalText,
          stopReason: result.stopReason,
          iterations: result.iterations,
          steps: context.validated.includeSteps ? result.steps : undefined,
        },
        headers: { 'x-correlation-id': correlationId },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 25 }
);
