/**
 * GET /api/osce/session/:sessionId/vitals
 * Returns vitals for the encounter (for Live tool get_current_vitals). From case.vitalSigns or defaults.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { createEndpointLogger } from '../../../_shared/secureLogger';

const VitalsParamsSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

interface Env {
  DATABASE_URL: string;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(VitalsParamsSchema, async (context) => {
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
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await prisma.patientEncounterSession.findFirst({
      where: { id: validated.sessionId, userId: user.id },
      select: { caseId: true },
    });
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify({
        data: { bp: String(bp), hr: Number(hr), rr: Number(rr), temp: Number(temp), o2: Number(o2) },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    log.error('OSCE vitals error', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { source: 'params' });
