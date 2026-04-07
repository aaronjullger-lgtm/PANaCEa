/**
 * GET /api/study-plan/today
 *
 * Returns today's recommended study allocation split between MAIN (readiness)
 * and TARGETED (FSRS retention) sessions.
 *
 * Response shape: DailyStudyAllocation — see dailyStudyAllocatorService.ts
 *
 * Security: Authenticated endpoint — requires valid Clerk JWT.
 *
 * Sprint: Dual-Study Allocator — April 2026
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getDailyStudyAllocation } from '../../../lib/services/dailyStudyAllocatorService';

// GET endpoint — no request body needed
const EmptySchema = z.object({});
type EmptyQuery = z.infer<typeof EmptySchema>;

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context: AuthenticatedContext & ValidatedContext<EmptyQuery>) => {
    const { userId } = context.auth;
    const prisma = createEdgePrismaClient(context.env);

    try {
      const allocation = await getDailyStudyAllocation(prisma, userId);
      return { data: allocation };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
