/**
 * PATCH /api/admin/staging/update
 * Edit staging question (e.g. explanation) before approving.
 * Body: { id: string, explanation?: string, ... }
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const UpdateBodySchema = z.object({
  body: z.object({
    id: z.string().min(1),
    explanation: z.string().max(50000).optional(),
    question: z.string().max(5000).optional(),
    vignette: z.string().max(10000).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPatch = adminEndpoint(UpdateBodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/update');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const { id, ...updates } = validated.body;

  try {
    const staging = await prisma.stagingQuestion.findUnique({
      where: { id },
    });
    if (!staging) {
      return { status: 404, error: 'Staging question not found' };
    }
    const data: Record<string, unknown> = {};
    if (updates.explanation !== undefined) data.explanation = updates.explanation;
    if (updates.question !== undefined) data.question = updates.question;
    if (updates.vignette !== undefined) data.vignette = updates.vignette;
    if (Object.keys(data).length === 0) {
      return { data: { success: true, message: 'No changes' } };
    }
    await prisma.stagingQuestion.update({
      where: { id },
      data,
    });
    log.info('Staging updated', { id, fields: Object.keys(data) });
    return { data: { success: true, message: 'Updated' } };
  } catch (e) {
    log.error('Staging update error', e);
    return { status: 500, error: 'Failed to update' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
