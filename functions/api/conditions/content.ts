/**
 * GET /api/conditions/content?name={conditionName}
 *
 * PUBLIC endpoint - Returns condition content for question generation.
 * Used by frontend geminiService to get enriched content context.
 */

import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const ContentSchema = z.object({
  query: z.object({
    name: z.string().min(1, 'Condition name is required'),
  }),
});

export const onRequestGet = publicEndpoint(ContentSchema, async ({ env, validated }) => {
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const conditionName = validated.query.name;

    // Search for condition content by name (case-insensitive)
    let record = await prisma.medicalContent.findFirst({
      where: {
        condition: { equals: conditionName, mode: 'insensitive' },
        status: 'published',
      },
    });

    // Fallback: try searching by conditionId
    if (!record) {
      record = await prisma.medicalContent.findFirst({
        where: {
          conditionId: conditionName,
          status: 'published',
        },
      });
    }

    if (!record) {
      return {
        data: {
          found: false,
          message: `No published content found for: ${conditionName}`,
        },
      };
    }

    // Return structured content
    return {
      data: {
        found: true,
        conditionId: record.conditionId,
        condition: record.condition,
        system: record.system,
        subcategory: record.subcategory,
        content: {
          overview: record.overview,
          pathophysiology: record.pathophysiology,
          symptoms: record.symptoms,
          signs: record.signs,
          diagnostics: record.diagnostics,
          treatment: record.treatment,
          differentialDiagnosis: record.differentialDiagnosis,
          complications: record.complications,
          prognosis: record.prognosis,
          classicTriad: record.classicTriad,
          buzzwords: record.buzzwords,
          clinicalPearls: record.clinicalPearls,
          examFindings: record.examFindings,
          riskFactors: record.riskFactors,
          firstLineTests: record.firstLineTests,
          goldStandardTest: record.goldStandardTest,
          firstLineTreatment: record.firstLineTreatment,
          contraindications: record.contraindications,
          monitoring: record.monitoring,
          patientEducation: record.patientEducation,
          aiConfidence: record.aiConfidence,
        },
      },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
