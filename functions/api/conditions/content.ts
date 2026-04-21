/**
 * GET /api/conditions/content?name={conditionName}
 *
 * PUBLIC endpoint - Returns condition content for question generation.
 * Used by frontend geminiService to get enriched content context.
 */

import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

// Flattened schema for query params
const ContentSchema = z.object({
  name: z.string().min(1, 'Condition name is required'),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  ContentSchema,
  async ({ env, validated }) => {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const conditionName = validated.name;

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

      // rx_side_effects is stored inside the content JSON blob, not as a top-level column.
      // Extract it explicitly so callers don't have to know the blob shape.
      const contentJson =
        record.content && typeof record.content === 'object' && !Array.isArray(record.content)
          ? (record.content as Record<string, unknown>)
          : {};
      const rxSideEffects =
        typeof contentJson['rx_side_effects'] === 'string' ? contentJson['rx_side_effects'] : null;

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
            signs: record.physicalExam ?? undefined,
            diagnostics: record.diagnostics,
            treatment: record.treatment,
            differentialDiagnosis: record.differentialDiagnosis,
            complications: record.complications,
            prognosis: record.prognosis,
            classicTriad: record.classic_triad ?? undefined,
            buzzwords: record.buzzwords,
            clinicalPearls: record.clinical_pearls ?? undefined,
            examFindings: record.physicalExam ?? undefined,
            riskFactors: record.riskFactors,
            firstLineTests: record.best_initial_test ?? undefined,
            goldStandardTest: record.gold_standard_dx ?? undefined,
            firstLineTreatment: record.first_line_rx ?? undefined,
            rxSideEffects: rxSideEffects ?? undefined,
            patientEducation: record.patient_education ?? undefined,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
