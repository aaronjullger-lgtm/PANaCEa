/**
 * GET /api/conditions/illness-script?conditionId=...
 *
 * Returns a structured illness script for a condition, composed from
 * MedicalContent and related clinical data (findings, labs, imaging).
 *
 * Query params:
 *   - conditionId (required): MedicalContent.conditionId
 *   - compare (optional): Second conditionId for differential comparison
 *
 * @see lib/services/illnessScriptService.ts — Pure builder logic
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';
import { d1GetOrSet } from '../_shared/d1-cache';
import {
  buildIllnessScript,
  compareScripts,
  type RawMedicalContent,
  type RawPhysicalFinding,
  type RawLabFinding,
  type RawImagingFinding,
} from '../../../lib/services/illnessScriptService';

const QuerySchema = z.object({
  conditionId: z.string().min(1),
  compare: z.string().optional(),
});

const ILLNESS_SCRIPT_TTL = 3600;

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, validated } = context as {
    env: CloudflareEnv;
    validated: z.infer<typeof QuerySchema>;
    auth: { userId: string };
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const cacheKey = validated.compare
      ? `illness-script:${validated.conditionId}:vs:${validated.compare}`
      : `illness-script:${validated.conditionId}`;

    const script = await d1GetOrSet(env.EDGE_DB, cacheKey, async () => {
      const primary = await fetchAndBuildScript(prisma, validated.conditionId);
      if (!primary) return null;

      if (validated.compare) {
        const secondary = await fetchAndBuildScript(prisma, validated.compare);
        if (!secondary) return null;
        return {
          mode: 'comparison',
          scriptA: primary,
          scriptB: secondary,
          comparison: compareScripts(primary, secondary),
        };
      }

      return { mode: 'single', script: primary };
    }, ILLNESS_SCRIPT_TTL);

    if (!script) {
      return new Response(
        JSON.stringify({ error: `Condition not found: ${validated.conditionId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const json = JSON.stringify(script);
    const cacheHit = await import('../_shared/d1-cache').then((m) =>
      m.d1Has(env.EDGE_DB, cacheKey)
    );

    return new Response(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': cacheHit ? 'HIT' : 'MISS' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Failed to build illness script: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ─── Data Fetching ───────────────────────────────────────────────────────

async function fetchAndBuildScript(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  conditionId: string
) {
  // 1. Fetch MedicalContent
  const mc = await prisma.medicalContent.findFirst({
    where: { conditionId },
    select: {
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      canonicalName: true,
      epidemiology: true,
      etiology: true,
      riskFactors: true,
      age_demographic: true,
      gender_bias: true,
      pathophysiology: true,
      overview: true,
      symptoms: true,
      physicalExam: true,
      diagnostics: true,
      gold_standard_dx: true,
      best_initial_test: true,
      differentialDiagnosis: true,
      differentials: true,
      complications: true,
      prognosis: true,
      treatment: true,
      first_line_rx: true,
      guidelines: true,
      buzzwords: true,
      classic_triad: true,
      classic_patient: true,
      clinical_pearls: true,
      mnemonic: true,
      pance_yield: true,
      evidenceGrade: true,
    },
  });

  if (!mc) return null;

  // 2. Fetch related physical findings via FindingConditionLink
  const findingLinks = await prisma.findingConditionLink.findMany({
    where: { conditionId },
    select: {
      PhysicalExamFinding: {
        select: {
          name: true,
          clinicalSignificance: true,
          sensitivity: true,
          specificity: true,
          positiveLR: true,
          negativeLR: true,
          isHighYield: true,
        },
      },
    },
  });
  const physicalFindings: RawPhysicalFinding[] = findingLinks.map((fl) => fl.PhysicalExamFinding);

  // 3. Fetch related labs via LabConditionLink
  const labLinks = await prisma.labConditionLink.findMany({
    where: { conditionId },
    select: {
      LabTest: {
        select: {
          name: true,
          commonAbnormalities: true,
          isHighYield: true,
        },
      },
    },
  });
  const labFindings: RawLabFinding[] = labLinks.map((ll) => ll.LabTest);

  // 4. Fetch related imaging via ImagingConditionLink
  const imagingLinks = await prisma.imagingConditionLink.findMany({
    where: { conditionId },
    select: {
      ImagingStudy: {
        select: {
          name: true,
          classicSigns: true,
          isHighYield: true,
        },
      },
    },
  });
  const imagingFindings: RawImagingFinding[] = imagingLinks.map((il) => il.ImagingStudy);

  // 5. Build the script
  return buildIllnessScript(
    mc as RawMedicalContent,
    physicalFindings,
    labFindings,
    imagingFindings
  );
}
