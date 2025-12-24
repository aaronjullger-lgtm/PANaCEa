/**
 * API Endpoint: /api/performance/record
 * 
 * Record drill session performance data to the database
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

interface PerformanceData {
  drillType: string;
  startTime: string;
  endTime: string;
  questionsAttempted: number;
  correctAnswers: number;
  accuracy: number;
  timeSpent: number;
  bestStreak: number;
  metadata?: Record<string, any>;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Authenticate request
    const env = context.env as Env;
    const authResult = await authenticateRequest(context.request as any, env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let performanceData: PerformanceData;
    try {
      performanceData = await context.request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
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
    } = performanceData;

    if (!drillType || !startTime || !endTime) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['drillType', 'startTime', 'endTime'],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate data types
    if (
      typeof questionsAttempted !== 'number' ||
      typeof correctAnswers !== 'number' ||
      typeof accuracy !== 'number' ||
      typeof timeSpent !== 'number' ||
      typeof bestStreak !== 'number'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid data types',
          expected: {
            questionsAttempted: 'number',
            correctAnswers: 'number',
            accuracy: 'number',
            timeSpent: 'number',
            bestStreak: 'number',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Prisma client
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Check if user exists in database
      const user = await prisma.user.findUnique({
        where: { clerkId: authResult.userId },
        select: { id: true },
      });

      if (!user) {
        return new Response(
          JSON.stringify({
            error: 'User not found',
            message: 'User must be synced from Clerk webhook first',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
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
          streak: bestStreak,
          sessionStart: new Date(startTime),
          sessionEnd: new Date(endTime),
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          recordId: record.id,
          message: 'Performance data recorded successfully',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error recording performance:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
