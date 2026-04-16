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
import { getTodayStudyPlan } from '../_shared/studyPlanService';

const EmptySchema = z.object({});

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

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context: AuthenticatedContext & ValidatedContext<Record<string, never>>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await getInternalUserId(prisma, context.auth.userId);
      const today = await getTodayStudyPlan(prisma, userId);
      return { data: today };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
