/**
 * POST /api/admin/staging/approve
 * Approve: move StagingQuestion -> PreGeneratedQuestion (live pool) and delete staging entry.
 * Body: { id: string }
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { promoteToLive } from '../../_shared/staging-questions';

const ApproveBodySchema = z.object({
  body: z.object({
    id: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminEndpoint(ApproveBodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/approve');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const stagingId = validated.body.id;

  try {
    const staging = await prisma.stagingQuestion.findUnique({
      where: { id: stagingId },
    });
    if (!staging) {
      return { status: 404, error: 'Staging question not found' };
    }
    if (staging.status === 'approved') {
      return { status: 400, error: 'Already approved' };
    }

    if (staging.status === 'graded') {
      await promoteToLive(prisma, stagingId);
    } else {
      await prisma.preGeneratedQuestion.create({
        data: {
          id: crypto.randomUUID(),
          questionType: 'mcq',
          system: staging.system,
          conditionId: null,
          difficulty: staging.difficulty,
          questionData: {
            vignette: staging.vignette,
            question: staging.question,
            options: staging.options,
            correctAnswer: staging.correctAnswer,
            explanation: staging.explanation,
            tags: staging.tags,
          },
          quality: 10,
        },
      });
    }
    await prisma.stagingQuestion.delete({
      where: { id: stagingId },
    });

    log.info('Staging approved and removed', { stagingId });
    return { data: { success: true, message: 'Approved and moved to live pool' } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('has not passed adequacy check')) {
      return { status: 400, error: 'Run adequacy check first (status must be graded) or approve from pending with force' };
    }
    log.error('Staging approve error', e);
    return { status: 500, error: 'Failed to approve' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
