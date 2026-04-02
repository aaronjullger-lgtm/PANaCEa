/**
 * API: GET /api/study/cold-start-status
 *
 * Returns the user's cold-start calibration status.
 * If not calibrated, the client should redirect to the calibration flow.
 *
 * Sprint 2D — April 2026
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getColdStartStatus } from '../../../lib/services/coldStartCalibrationService';
import { z } from 'zod';

const EmptySchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const { env, auth } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      const status = await getColdStartStatus(prisma, user.id);

      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message ?? 'Failed to check cold-start status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);