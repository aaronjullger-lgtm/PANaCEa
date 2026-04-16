import { z } from 'zod';
import {
  authenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../_shared/prisma-edge';
import { updateStudyPlanProgress } from '../_shared/studyPlanService';

const ProgressSchema = z.object({
  body: z.object({
    planDate: z.string().date(),
    taskId: z.string().min(1),
    action: z.enum(['start', 'complete', 'skip']),
    actualQuestionsAnswered: z.number().int().min(0).optional(),
    actualDurationMinutes: z.number().int().min(0).optional(),
    actualAccuracy: z.number().min(0).max(1).optional(),
    linkedSessionId: z.string().min(1).optional(),
  }),
});

async function getInternalUserId(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  clerkId: string
) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) {
    throw new Error('User not found');
  }
  return user.id;
}

export const onRequestPost = authenticatedEndpoint(
  ProgressSchema,
  async (
    context: AuthenticatedContext & ValidatedContext<z.infer<typeof ProgressSchema>>
  ) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await getInternalUserId(prisma, context.auth.userId);
      const day = await updateStudyPlanProgress(prisma, userId, context.validated.body);
      return { data: day };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
