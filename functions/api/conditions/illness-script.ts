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

type Env = CloudflareEnv & { CACHE?: KVNamespace };

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof QuerySchema>;
    auth: { userId: string };
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check KV cache
    const cacheKey = validated.compare
      ? `illness-script:${validated.conditionId}:vs:${validated.compare}`
      : `illness-script:${validated.conditionId}`;

    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        });
      }
    }

    // Fetch primary condition
    const script = await fetchAndBuildScript(prisma, validated.conditionId);
    if (!script) {
      return new Response(
        JSON.stringify({ error: `Condition not found: ${validated.conditionId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let responseBody: Record<string, unknown>;

    // Optional comparison mode
    if (validated.compare) {
      const compareScript = await fetchAndBuildScript(prisma, validated.compare);
      if (!compareScript) {
        return new Response(
          JSON.stringify({ error: `Comparison condition not found: ${validated.compare}` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const comparison = compareScripts(script, compareScript);
      responseBody = {
        mode: 'comparison',
        scriptA: script,
        scriptB: compareScript,
        comparison,
      };
    } else {
      responseBody = {
        mode: 'single',
        script,
      };
    }

    const json = JSON.stringify(responseBody);

    // Cache for 1 hour
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, json, { expirationTtl: 3600 });
    }

    return new Response(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
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
