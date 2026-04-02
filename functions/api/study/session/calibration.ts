/**
 * API: POST /api/study/session/calibration
 *
 * Generates a calibration session for cold-start users.
 * Serves a balanced easy/medium/hard mix across core systems.
 *
 * Sprint 2D — April 2026
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  getColdStartStatus,
  generateCalibrationSession,
} from '../../../../lib/services/coldStartCalibrationService';

const CalibrationSchema = z.object({
  body: z.object({
    size: z.number().int().min(10).max(50).optional(),
  }).optional().default({}),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  CalibrationSchema,
  async (context) => {
    const { env, auth, validated } = context;    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      // Check if user actually needs calibration
      const status = await getColdStartStatus(prisma, user.id);
      if (status.isCalibrated) {
        return new Response(
          JSON.stringify({
            message: 'User is already calibrated',
            baseline: status.baseline,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const questions = await generateCalibrationSession(
        prisma, user.id, validated.body?.size
      );

      return new Response(
        JSON.stringify({
          sessionType: 'calibration',
          questions,
          metadata: {
            totalCalibrationQuestions: questions.length,
            progress: status.progress,
            remaining: status.remaining,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message ?? 'Calibration session failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);