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

import { z } from 'zod';
import {
  authenticatedEndpoint,
  withCors,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { logger } from '../_shared/secureLogger';

// Zod schema for performance record submission
const PerformanceRecordSchema = z.object({
  drillType: z.string().min(1).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  questionsAttempted: z.number().int().min(0).max(1000),
  correctAnswers: z.number().int().min(0).max(1000),
  accuracy: z.number().min(0).max(1),
  timeSpent: z.number().int().min(0).max(86400000), // Max 24 hours in ms
  bestStreak: z.number().int().min(0).max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type PerformanceRecordInput = z.infer<typeof PerformanceRecordSchema>;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  PerformanceRecordSchema,
  async (context: AuthenticatedContext & ValidatedContext<PerformanceRecordInput>) => {
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

      // Create performance record
      const record = await prisma.performanceRecord.create({
        data: {
          userId: user.id,
          mode: drillType,
          score: correctAnswers,
          totalQuestions: questionsAttempted,
          accuracy,
          timeSpent,
          streak: bestStreak ?? 0,
          sessionStart: new Date(startTime),
          sessionEnd: new Date(endTime),
          metadata: metadata ? JSON.stringify(metadata) : null,
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