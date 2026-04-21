/**
 * GET /api/osce/session/:sessionId/vitals
 * Returns vitals for the encounter (for Live tool get_current_vitals). From case.vitalSigns or defaults.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { createEndpointLogger } from '../../../_shared/secureLogger';

const VitalsParamsSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

interface Env {
  DATABASE_URL: string;
}

export const onRequestGet = authenticatedEndpoint(
  VitalsParamsSchema,
  async (context) => {
    const { env, validated, auth } = context as {
      env: Env;
      validated: z.infer<typeof VitalsParamsSchema>;
      auth: { userId: string };
    };
    const log = createEndpointLogger('/api/osce/session/[sessionId]/vitals', auth.userId);

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) {
        return fail(ErrorCode.NOT_FOUND, { message: 'User not found' });
      }

      const session = await prisma.patientEncounterSession.findFirst({
        where: { id: validated.sessionId, userId: user.id },
        select: { caseId: true },
      });
      if (!session) {
        return fail(ErrorCode.NOT_FOUND, { message: 'Session not found' });
      }

      const caseData = await prisma.patientEncounterCase.findUnique({
        where: { id: session.caseId },
        select: { vitalSigns: true },
      });

      const vitalSigns = caseData?.vitalSigns;
      const vitals =
        vitalSigns && typeof vitalSigns === 'object' && vitalSigns !== null
          ? (vitalSigns as Record<string, unknown>)
          : {};

      const bp = vitals.bp ?? vitals.bloodPressure ?? '160/90';
      const hr = vitals.hr ?? vitals.heartRate ?? 110;
      const rr = vitals.rr ?? vitals.respiratoryRate ?? 22;
      const temp = vitals.temp ?? vitals.temperature ?? 98.6;
      const o2 = vitals.o2 ?? vitals.spo2 ?? 94;

      return ok({ bp: String(bp), hr: Number(hr), rr: Number(rr), temp: Number(temp), o2: Number(o2) });
    } catch (err) {
      log.error('OSCE vitals error', err);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Internal server error' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
