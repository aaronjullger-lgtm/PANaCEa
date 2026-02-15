/**
 * Admin Debug: Inspect Targeted Daily Attempt
 *
 * GET /api/admin/targeted-daily?clerkId=USER_ID&date=YYYY-MM-DD
 *
 * - Admin / superadmin only (adminEndpoint)
 * - Defaults:
 *   - clerkId: current authenticated admin's Clerk ID
 *   - date: today (UTC)
 * - Returns the stored TargetedDailyAttempt row and lightweight question metadata (no correct answer).
 */

import { z } from 'zod';
import { adminEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AdminTargetedDailyQuery = z.object({
  clerkId: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
    .optional(),
});

function getUtcDateFromIso(dateStr?: string): Date {
  if (!dateStr) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const onRequestGet = adminEndpoint(
  AdminTargetedDailyQuery,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/admin/targeted-daily', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const targetClerkId = validated.clerkId || auth.userId;
      const date = getUtcDateFromIso(validated.date);

      const user = await prisma.user.findUnique({
        where: { clerkId: targetClerkId },
        select: { id: true, email: true, role: true },
      });
      if (!user) {
        return { status: 404, error: 'Target user not found' };
      }

      const attempt = await prisma.targetedDailyAttempt.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date,
          },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          systems: true,
          questionId: true,
          answerIndex: true,
          isCorrect: true,
          timeSpentMs: true,
          completedAt: true,
          createdAt: true,
        },
      });

      if (!attempt) {
        return {
          data: {
            found: false,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
            },
            attempt: null,
          },
        };
      }

      // Lightweight question metadata – no correct answers
      const question = await prisma.preGeneratedQuestion.findUnique({
        where: { id: attempt.questionId },
        select: {
          id: true,
          system: true,
          difficulty: true,
          questionData: true,
        },
      });

      const meta = question?.questionData
        ? {
            id: question.id,
            system: question.system,
            difficulty: question.difficulty,
            // Only basic stem + options; omit any explicit correct answer fields
            question: (question.questionData as any)?.question ?? null,
            vignette: (question.questionData as any)?.vignette ?? null,
            hasOptions: Boolean((question.questionData as any)?.options),
          }
        : null;

      log.info('Admin fetched targeted daily attempt', {
        adminClerkId: auth.userId,
        targetClerkId,
        userId: user.id,
        date: date.toISOString().slice(0, 10),
        attemptId: attempt.id,
      });

      return {
        data: {
          found: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          attempt,
          questionMeta: meta,
        },
      };
    } catch (error: any) {
      log.error('Admin targeted daily debug error', { error: error?.message ?? String(error) });
      return { status: 500, error: 'Failed to fetch targeted daily debug data' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
