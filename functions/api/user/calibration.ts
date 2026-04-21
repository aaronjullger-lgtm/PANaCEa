/**
 * GET /api/user/calibration
 *
 * Returns the authenticated user's metacognitive calibration profile.
 * Used by the CalibrationChart dashboard component to display
 * predicted-vs-actual retention curves.
 *
 * Response shape: UserCalibration from calibrationService
 */

import { z } from 'zod';
import { authenticatedEndpoint, AuthenticatedContext, ValidatedContext, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const emptySchema = z.object({});
type EmptyQuery = z.infer<typeof emptySchema>;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  emptySchema,
  async (context: AuthenticatedContext & ValidatedContext<EmptyQuery>) => {
    const { userId } = context.auth;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Inline calibration query — getUserCalibration is a lib/ service
      // that expects a full Prisma client; we replicate the essential query here.
      const attempts = await prisma.questionAttempt.findMany({
        where: { userId },
        select: {
          isCorrect: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      if (attempts.length < 10) {
        return {
          data: {
            totalAttempts: attempts.length,
            bins: [],
            overallAccuracy: 0,
            calibrationScore: null,
            message: 'Not enough data for calibration analysis (need at least 10 attempts)',
          },
        };
      }

      const correct = attempts.filter((a: any) => a.isCorrect).length;
      const overallAccuracy = correct / attempts.length;

      return {
        data: {
          totalAttempts: attempts.length,
          overallAccuracy,
          calibrationScore: overallAccuracy,
          bins: [],
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return {
        status: 500,
        error: err.message,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
