/**
 * GET /api/user/calibration
 *
 * Returns the authenticated user's metacognitive calibration profile.
 * Used by the CalibrationChart dashboard component to display
 * predicted-vs-actual retention curves.
 *
 * Response shape: UserCalibration from calibrationService
 */

import { authenticatedEndpoint } from '../_shared/auth';
import { getPrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getUserCalibration } from '../../../lib/services/calibrationService';

export const onRequestGet: PagesFunction<Env> = authenticatedEndpoint(
  async (context, auth) => {
    const prisma = getPrismaClient(context.env);
    try {
      const calibration = await getUserCalibration(prisma, auth.userId);

      return new Response(JSON.stringify(calibration), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
