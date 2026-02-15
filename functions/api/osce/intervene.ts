/**
 * POST /api/osce/intervene
 * Dynamic Patient Encounter: apply intervention (e.g. drug) and update vitals via physiology engine.
 * Uses Drug.drugClass / mechanismOfAction and VitalSignRange for Code Blue check.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { IDSchema } from '../_shared/schemas';
import type { Prisma } from '@prisma/client';

const InterveneBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
    interventionId: z.string().min(1),
  }),
});

export interface VitalSigns {
  heartRate?: number;
  hr?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  bp?: string;
  respiratoryRate?: number;
  rr?: number;
  o2Sat?: number;
  o2?: number;
  temp?: number;
  temperature?: number;
  [key: string]: unknown;
}

interface VitalSignRangeRow {
  vitalSign: string;
  emergencyValues?: unknown;
  elevation?: unknown;
  depression?: unknown;
  ranges?: unknown;
}

function getNumericVital(vitals: VitalSigns, key: string, altKey: string): number {
  const v = vitals[key] ?? vitals[altKey];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (key === 'bp' || altKey === 'bp') {
      const parts = v.split('/').map(Number);
      const first = parts[0];
      return (Number.isFinite(first) ? first : 120) as number;
    }
    return Number(v) || 0;
  }
  return 0;
}

function getMultiplierFromRange(rangeJson: unknown, defaultVal: number): number {
  if (rangeJson == null) return defaultVal;
  const o = rangeJson as Record<string, unknown>;
  if (typeof o.multiplier === 'number') return o.multiplier;
  if (typeof o.factor === 'number') return o.factor;
  return defaultVal;
}

function applyIntervention(
  vitals: VitalSigns,
  drug: { drugClass: string[]; mechanismOfAction?: string | null },
  ranges: VitalSignRangeRow[]
): VitalSigns {
  const out = { ...vitals };
  const classes = drug.drugClass?.map((c) => c.toLowerCase()) ?? [];
  const moa = (drug.mechanismOfAction ?? '').toLowerCase();

  let hr = getNumericVital(vitals, 'heartRate', 'hr');
  let sys = getNumericVital(vitals, 'bpSystolic', 'bp') || 120;
  let dia = out.bpDiastolic ?? 80;
  if (typeof out.bp === 'string') {
    const parts = out.bp.split('/').map(Number);
    if (parts.length >= 2) {
      sys = parts[0] ?? 120;
      dia = parts[1] ?? 80;
    }
  } else if (out.bpSystolic != null) {
    sys = Number(out.bpSystolic);
    dia = Number(out.bpDiastolic ?? 80);
  }
  const rr = getNumericVital(vitals, 'respiratoryRate', 'rr');
  const o2 = getNumericVital(vitals, 'o2Sat', 'o2') || 98;

  const hrRange = ranges.find((r) => /heart|hr/i.test(r.vitalSign));
  const bpRange = ranges.find((r) => /blood|bp|systolic/i.test(r.vitalSign));
  const depHr = hrRange ? getMultiplierFromRange(hrRange.depression, 0.85) : 0.85;
  const depBp = bpRange ? getMultiplierFromRange(bpRange.depression, 0.9) : 0.9;
  const elevBp = bpRange ? getMultiplierFromRange(bpRange.elevation, 1.2) : 1.2;

  const isBetaBlocker =
    classes.some((c) => c.includes('beta') && c.includes('blocker')) ||
    moa.includes('beta blocker');
  const isVasopressor =
    classes.some((c) => c.includes('vasopressor') || c.includes('vasoconstrictor')) ||
    moa.includes('vasopressor');
  const isVasodilator =
    classes.some((c) => c.includes('vasodilator') || c.includes('nitro')) ||
    moa.includes('vasodilat');

  if (isBetaBlocker) {
    hr = Math.max(40, Math.round(hr * depHr));
    sys = Math.max(90, Math.round(sys * depBp));
    dia = Math.max(60, Math.round(dia * depBp));
  } else if (isVasopressor) {
    sys = Math.min(200, Math.round(sys * elevBp));
    dia = Math.min(120, Math.round(dia * 1.15));
  } else if (isVasodilator) {
    sys = Math.max(90, Math.round(sys * depBp));
    dia = Math.max(60, Math.round(dia * depBp));
  }

  out.heartRate = out.hr = hr;
  out.bpSystolic = sys;
  out.bpDiastolic = dia;
  out.bp = `${sys}/${dia}`;
  out.respiratoryRate = out.rr = rr;
  out.o2Sat = out.o2 = o2;
  return out;
}

function checkEmergencyValues(vitals: VitalSigns, ranges: VitalSignRangeRow[]): boolean {
  const hr = getNumericVital(vitals, 'heartRate', 'hr');
  const sys = getNumericVital(vitals, 'bpSystolic', 'bp') || 120;
  const rr = getNumericVital(vitals, 'respiratoryRate', 'rr');
  const o2 = getNumericVital(vitals, 'o2Sat', 'o2') || 98;

  for (const r of ranges) {
    const ev = r.emergencyValues as { min?: number; max?: number } | undefined;
    if (!ev) continue;
    const key = r.vitalSign.toLowerCase();
    if (key.includes('heart') || key.includes('hr')) {
      const min = ev.min ?? 0;
      const max = ev.max ?? 300;
      if (hr < min || hr > max) return true;
    }
    if (key.includes('blood') || key.includes('bp') || key.includes('systolic')) {
      const min = ev.min ?? 0;
      const max = ev.max ?? 300;
      if (sys < min || sys > max) return true;
    }
    if (key.includes('respiratory') || key.includes('rr')) {
      const min = ev.min ?? 0;
      const max = ev.max ?? 60;
      if (rr < min || rr > max) return true;
    }
    if (key.includes('o2') || key.includes('spo2') || key.includes('oxygen')) {
      const min = ev.min ?? 0;
      if (o2 < min) return true;
    }
  }
  return false;
}

function pushSystemMessage(messages: unknown, text: string): unknown[] {
  const arr = Array.isArray(messages) ? [...messages] : [];
  arr.push({
    role: 'system',
    content: text,
    timestamp: new Date().toISOString(),
  });
  return arr;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(InterveneBodySchema, async (context) => {
  const { env, validated, auth } = context;
  const log = createEndpointLogger('/api/osce/intervene', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;

  try {
    const { sessionId, interventionId } = validated.body;
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    const session = await prisma.patientEncounterSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true, physicalFindings: true, messages: true, status: true },
    });
    if (!session) {
      return { status: 404, error: 'Session not found' };
    }

    const drug = await prisma.drug.findUnique({
      where: { id: interventionId },
      select: { drugClass: true, mechanismOfAction: true, genericName: true },
    });
    if (!drug) {
      return { status: 404, error: 'Intervention (drug) not found' };
    }

    const ranges = await prisma.vitalSignRange.findMany({
      select: {
        vitalSign: true,
        emergencyValues: true,
        elevation: true,
        depression: true,
        ranges: true,
      },
    });
    let vitals: VitalSigns =
      session.physicalFindings && typeof session.physicalFindings === 'object'
        ? (session.physicalFindings as VitalSigns)
        : {};
    vitals = applyIntervention(vitals, drug, ranges);
    const isEmergency = checkEmergencyValues(vitals, ranges);

    const systemMessage = `15 minutes later. ${drug.genericName} administered. Vitals updated.`;
    const updatedMessages = pushSystemMessage(session.messages, systemMessage);

    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        physicalFindings: JSON.parse(JSON.stringify(vitals)) as Prisma.InputJsonValue,
        messages: JSON.parse(JSON.stringify(updatedMessages)) as Prisma.InputJsonValue,
        status: isEmergency ? 'Unstable' : 'active',
        updatedAt: new Date(),
      },
    });

    log.info('Intervention applied', {
      sessionId,
      interventionId,
      isEmergency,
    });

    return {
      data: {
        success: true,
        vitals,
        isEmergency,
        message: systemMessage,
      },
    };
  } catch (e) {
    log.error('Intervene error', e);
    return { status: 500, error: 'Failed to apply intervention' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
