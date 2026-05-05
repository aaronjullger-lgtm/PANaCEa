// SAFE-OVERRIDE: no shell commands, "should" word in comment triggers ERE false positive
/**
 * API: GET /api/study/cold-start-status
 *
 * Returns the user's cold-start calibration status.
 * If not calibrated, the client redirects to the calibration flow.
 *
 * Sprint 2D — April 2026
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getColdStartStatus } from '../../../lib/services/coldStartCalibrationService';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { z } from 'zod';

const EmptySchema = z.object({});

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const { env, auth } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });
      const status = await getColdStartStatus(prisma, user.id);
      return ok(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check cold-start status';
      return fail(ErrorCode.INTERNAL_ERROR, { message });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
