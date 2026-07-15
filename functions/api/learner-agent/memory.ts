/**
 * GET/POST/DELETE /api/learner-agent/memory
 *
 * User-controlled learner memories (KV-backed, not canonical Postgres v1).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import {
  memoryKvKey,
  proposeMemory,
  confirmMemory,
  correctMemory,
  type StoredLearnerMemory,
  type MemoryCategory,
} from '../../../lib/services/learnerAgent/memoryPolicy';

const ProposeSchema = z.object({
  body: z.object({
    proposed: z.string().min(1).max(500),
    category: z.enum(['preference', 'goal', 'difficulty', 'schedule', 'rotation_note']),
    source: z.enum(['learner_stated', 'tool_derived', 'inferred']).optional(),
  }),
});

const ConfirmSchema = z.object({
  body: z.object({
    memoryId: z.string().min(1).max(128),
  }),
});

const DeleteSchema = z.object({
  body: z.object({
    memoryId: z.string().min(1).max(128),
  }),
});

const CorrectSchema = z.object({
  body: z.object({
    memoryId: z.string().min(1).max(128),
    correctedText: z.string().min(1).max(500),
  }),
});

async function loadMemories(kv: { get: (k: string) => Promise<string | null> }, userId: string) {
  const raw = await kv.get(memoryKvKey(userId));
  if (!raw) return [] as StoredLearnerMemory[];
  try {
    return JSON.parse(raw) as StoredLearnerMemory[];
  } catch {
    return [];
  }
}

async function saveMemories(
  kv: { put: (k: string, v: string) => Promise<void> },
  userId: string,
  memories: StoredLearnerMemory[]
) {
  await kv.put(memoryKvKey(userId), JSON.stringify(memories));
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const kv = context.env.CACHE;

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const memories = kv ? await loadMemories(kv, user.id) : [];
      return { status: 200, data: { memories } };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

export const onRequestPost = authenticatedEndpoint(
  ProposeSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const kv = context.env.CACHE;
    if (!kv) {
      return { status: 503, error: 'Memory storage unavailable' };
    }

    const { proposed, category, source } = context.validated.body;
    const action = (context.request.headers.get('x-memory-action') ?? 'propose').toLowerCase();

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const memories = await loadMemories(kv, user.id);

      if (action === 'confirm') {
        const parsed = ConfirmSchema.safeParse({ body: context.validated.body });
        if (!parsed.success) {
          return { status: 400, error: 'memoryId required for confirm' };
        }
        const idx = memories.findIndex((m) => m.id === parsed.data.body.memoryId);
        if (idx < 0) return { status: 404, error: 'Memory not found' };
        memories[idx] = confirmMemory(memories[idx]!);
        await saveMemories(kv, user.id, memories);
        return { status: 200, data: { memory: memories[idx] } };
      }

      if (action === 'correct') {
        const parsed = CorrectSchema.safeParse({ body: context.validated.body });
        if (!parsed.success) {
          return { status: 400, error: 'memoryId and correctedText required' };
        }
        const idx = memories.findIndex((m) => m.id === parsed.data.body.memoryId);
        if (idx < 0) return { status: 404, error: 'Memory not found' };
        memories[idx] = correctMemory(memories[idx]!, parsed.data.body.correctedText);
        await saveMemories(kv, user.id, memories);
        return { status: 200, data: { memory: memories[idx] } };
      }

      const candidate = proposeMemory({
        proposed,
        category: category as MemoryCategory,
        source: source ?? 'learner_stated',
      });

      if (!candidate.requiresConfirmation) {
        const stored = confirmMemory(candidate);
        memories.push(stored);
        await saveMemories(kv, user.id, memories);
        return { status: 201, data: { candidate, stored } };
      }

      return { status: 200, data: { candidate, pendingConfirmation: true } };
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
    const kv = context.env.CACHE;
    if (!kv) return { status: 503, error: 'Memory storage unavailable' };

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const memories = await loadMemories(kv, user.id);
      const memoryId = context.validated.body.memoryId;
      const next = memories.filter((m) => m.id !== memoryId);
      if (next.length === memories.length) {
        return { status: 404, error: 'Memory not found' };
      }
      await saveMemories(kv, user.id, next);
      return { status: 200, data: { deleted: memoryId } };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
