import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getDailyStudyAllocation } from '../../../lib/services/dailyStudyAllocatorService';
import { getOrCreateDailyStudyPlan, sanitizeStudyPlanTasks } from '../../../lib/services/studyPlanService';
import { resolveOrCreateUserId } from '../_shared/user-resolver';

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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context: AuthenticatedContext & ValidatedContext<EmptyQuery>) => {
    const prisma = createEdgePrismaClient(context.env);

    try {
      const userId = await resolveOrCreateUserId(prisma, context.auth.userId);
      const [allocation, plan] = await Promise.all([
        getDailyStudyAllocation(prisma, userId),
        getOrCreateDailyStudyPlan(prisma as any, userId),
      ]);
      const tasks = sanitizeStudyPlanTasks(plan.recommendedSessions);
      return {
        data: {
          ...allocation,
          planId: plan.id,
          planDate: plan.planDate.toISOString().slice(0, 10),
          status: plan.status,
          progress: {
            questionsAnswered: plan.actualQuestionsAnswered,
            questionsTarget: plan.targetQuestionsCount,
            percentComplete:
              plan.targetQuestionsCount > 0
                ? Math.min(100, Math.round((plan.actualQuestionsAnswered / plan.targetQuestionsCount) * 100))
                : 0,
          },
          tasks,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
