/**
 * Condition Details API (Lazy)
 * GET /api/content/condition/:conditionId/details
 *
 * Heavy relational + text data for Workup and Management tabs.
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { ConditionDetailsSchema } from '@/lib/schemas/medicalContent';

const ParamsSchema = z.object({
  conditionId: z.string().min(1).max(200),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated } = context;
    const { conditionId } = validated;

    if (!env.DATABASE_URL) {
      return {
        data: { error: 'Service unavailable', message: 'Database is not configured.', conditionId },
        status: 503,
      };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const content = await prisma.medicalContent.findFirst({
        where: { conditionId, status: 'published' },
        select: {
          id: true,
          conditionId: true,
          condition: true,
          system: true,
          subcategory: true,
          parent_category: true,
          symptoms: true,
          physicalExam: true,
          treatment: true,
          diagnostics: true,
          overview: true,
          pathophysiology: true,
          etiology: true,
          epidemiology: true,
          prognosis: true,
          differentialDiagnosis: true,
          riskFactors: true,
          complications: true,
          best_initial_test: true,
          gold_standard_dx: true,
          first_line_rx: true,
          disposition: true,
          patient_education: true,
          prevention: true,
          age_demographic: true,
          gender_bias: true,
          classic_patient: true,
          differentials: true,
          LabConditionLink: {
            include: {
              LabTest: {
                select: { id: true, name: true, displayName: true, category: true },
              },
            },
          },
          ImagingConditionLink: {
            include: {
              ImagingStudy: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  modality: true,
                  bodyRegion: true,
                },
              },
            },
          },
          DrugConditionLink: {
            include: {
              Drug: {
                select: {
                  id: true,
                  genericName: true,
                  brandName: true,
                  drugClass: true,
                },
              },
            },
          },
          FindingConditionLink: {
            include: {
              PhysicalExamFinding: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  category: true,
                  system: true,
                },
              },
            },
          },
          ECGConditionLink: {
            include: {
              ECGPattern: {
                select: { id: true, name: true, displayName: true, category: true },
              },
            },
          },
          TreatmentConditionLink: {
            include: {
              Treatment: {
                select: { id: true, name: true, displayName: true, category: true },
              },
            },
          },
          other_MedicalContent: {
            where: { status: 'published' },
            select: { id: true, conditionId: true, condition: true, system: true },
          },
        },
      });

      if (!content) {
        return {
          data: { error: 'not_found', message: 'Condition not found', conditionId },
          status: 404,
        };
      }

      const parsed = ConditionDetailsSchema.safeParse(content);
      if (!parsed.success) {
        console.warn('[condition/details] response shape validation failed', parsed.error.issues);
      }
      return {
        data: parsed.success ? parsed.data : content,
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[condition/details]', errMsg);
      return {
        data: {
          error: 'failed_to_load_details',
          message: 'Could not load condition details. Please try again later.',
          conditionId,
        },
        status: 503,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
