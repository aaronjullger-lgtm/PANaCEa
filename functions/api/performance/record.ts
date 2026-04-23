/**
 * API Endpoint: /api/performance/record
 *
 * Record drill session performance data to the database
 *
 * SECURITY: Sprint 4 - Converted to middleware pattern
 * - authenticatedEndpoint for auth enforcement
 * - Zod schema validation
 * - Secure logging
 * - Safe Prisma disconnect
 */

import {
  authenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { logger } from '../_shared/secureLogger';

// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/performance/record contract, edit lib/api/schemas/performance.ts.
import { PerformanceRecordRequestSchema as PerformanceRecordSchema } from '../../../lib/api/schemas/performance';
import type { PerformanceRecordRequest as PerformanceRecordInput } from '../../../lib/api/schemas/performance';

export const onRequestPost = authenticatedEndpoint<PerformanceRecordInput>(
  PerformanceRecordSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const {
        drillType,
        startTime,
        endTime,
        questionsAttempted,
        correctAnswers,
        accuracy,
        timeSpent,
        bestStreak,
        metadata,
      } = validated;

      // Check if user exists in database
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        logger.warn('User not found for performance record', { clerkId: auth.userId });
        return {
          status: 404,
          error: 'User not found. User must be synced from Clerk webhook first.',
        };
      }

      // Create drill session record (session-level; per-question data uses PerformanceRecord)
      const record = await prisma.drillSessionRecord.create({
        data: {
          userId: user.id,
          mode: drillType,
          score: correctAnswers,
          totalQuestions: questionsAttempted,
          accuracy,
          timeSpentMs: timeSpent,
          streak: bestStreak ?? 0,
          sessionStart: new Date(startTime),
          sessionEnd: new Date(endTime),
          metadata: metadata != null ? (JSON.parse(JSON.stringify(metadata)) as object) : undefined,
        },
      });

      logger.info('Performance record created', {
        userId: user.id,
        recordId: record.id,
        drillType,
        accuracy,
      });

      return {
        data: {
          success: true,
          recordId: record.id,
          message: 'Performance data recorded successfully',
        },
        status: 201,
      };
    } catch (error) {
      logger.error('Error recording performance', error, { userId: auth.userId });
      return {
        status: 500,
        error: 'Failed to record performance data',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
