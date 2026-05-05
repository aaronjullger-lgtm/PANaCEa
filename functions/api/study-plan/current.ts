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
import {
  ensureStudyPlanWindow,
  updateStudyPlanSettings,
} from '../_shared/studyPlanService';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import type { StudyPlanSettings } from '@/lib/api/types/studyPlan';

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(14).optional(),
});

const UpdateSchema = z.object({
  body: z.object({
    days: z.number().int().min(1).max(14).optional(),
    forceRegenerate: z.boolean().optional(),
    settings: z
      .object({
        dailyMinutesLimit: z.number().int().min(15).max(360).optional(),
        dailyQuestionGoal: z.number().int().min(5).max(300).optional(),
        preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
        focusAreas: z.array(z.string()).optional(),
        excludeAreas: z.array(z.string()).optional(),
        targetRetention: z.number().min(0.5).max(1).optional(),
        maxSessionsPerDay: z.number().int().min(1).max(6).optional(),
      })
      .optional(),
  }),
});

async function getInternalUserId(prisma: ReturnType<typeof createEdgePrismaClient>, clerkId: string) {
  const user = await resolveOrCreateUserRecord(prisma, clerkId, { id: true });
  return user.id;
}

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<z.infer<typeof QuerySchema>>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await getInternalUserId(prisma, context.auth.userId);
      const data = await ensureStudyPlanWindow(prisma, userId, {
        days: context.validated.days,
      });

      return { data };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

export const onRequestPut = authenticatedEndpoint(
  UpdateSchema,
  async (context: AuthenticatedContext & ValidatedContext<z.infer<typeof UpdateSchema>>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await getInternalUserId(prisma, context.auth.userId);
      const body = context.validated.body;

      if (body.settings) {
        await updateStudyPlanSettings(
          prisma,
          userId,
          body.settings as Partial<StudyPlanSettings>
        );
      }

      const data = await ensureStudyPlanWindow(prisma, userId, {
        days: body.days,
        forceRegenerate: body.forceRegenerate || !!body.settings,
      });

      return { data };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
