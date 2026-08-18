/**
 * GET/POST/DELETE /api/learner-agent/memory
 *
 * User-controlled learner memories stored in Postgres (UserPreferences.customSettings).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import {
  listLearnerMemories,
  proposeLearnerMemory,
  confirmLearnerMemory,
  correctLearnerMemory,
  deleteLearnerMemory,
} from '../../../lib/services/learner/learnerMemoryStore';
import { correlationFromRequest } from '../../../lib/services/learnerAgent/observability';

const MemoryPostSchema = z.object({
  body: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('propose'),
      proposed: z.string().min(1).max(500),
      category: z.enum(['preference', 'goal', 'difficulty', 'schedule', 'rotation_note']),
      source: z.enum(['learner_stated', 'tool_derived', 'inferred']).optional(),
    }),
    z.object({
      action: z.literal('confirm'),
      memoryId: z.string().min(1).max(128),
    }),
    z.object({
      action: z.literal('correct'),
      memoryId: z.string().min(1).max(128),
      correctedText: z.string().min(1).max(500),
    }),
  ]),
});

const DeleteSchema = z.object({
  body: z.object({
    memoryId: z.string().min(1).max(128),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const { confirmed, pending } = await listLearnerMemories(prisma, user.id);
      return {
        status: 200,
        data: { memories: confirmed, pending },
        headers: { 'x-correlation-id': correlationFromRequest(context.request) },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

export const onRequestPost = authenticatedEndpoint(
  MemoryPostSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const body = context.validated.body;

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });

      if (body.action === 'confirm') {
        const memory = await confirmLearnerMemory(prisma, user.id, body.memoryId);
        return { status: 200, data: { memory } };
      }

      if (body.action === 'correct') {
        const memory = await correctLearnerMemory(
          prisma,
          user.id,
          body.memoryId,
          body.correctedText
        );
        return { status: 200, data: { memory } };
      }

      const result = await proposeLearnerMemory(prisma, user.id, {
        proposed: body.proposed,
        category: body.category,
        source: body.source,
      });

      return {
        status: result.pendingConfirmation ? 200 : 201,
        data: result,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'MEMORY_NOT_FOUND') {
        return { status: 404, error: 'Memory not found' };
      }
      throw err;
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

export const onRequestDelete = authenticatedEndpoint(
  DeleteSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      await deleteLearnerMemory(prisma, user.id, context.validated.body.memoryId);
      return { status: 200, data: { deleted: context.validated.body.memoryId } };
    } catch (err) {
      if (err instanceof Error && err.message === 'MEMORY_NOT_FOUND') {
        return { status: 404, error: 'Memory not found' };
      }
      throw err;
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
