/**
 * Condition Content API
 * GET /api/content/condition/{conditionId}
 *
 * Public endpoint for fetching medical condition content by ID.
 * Returns full content + relations for SmartConditionView (Triage, Recognize, Order, Manage).
 */

import { z } from 'zod';
import { publicEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ConditionContentSchema = z.object({
  params: z.object({
    conditionId: z.string().min(1).max(200),
  }),
});

export const onRequestGet = publicEndpoint(ConditionContentSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/content/condition/[conditionId]');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { conditionId } = validated.params;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const contentSelect = {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      parent_category: true,
      overview: true,
      etiology: true,
      pathophysiology: true,
      epidemiology: true,
      symptoms: true,
      physicalExam: true,
      diagnostics: true,
      treatment: true,
      prognosis: true,
      differentialDiagnosis: true,
      riskFactors: true,
      complications: true,
      pance_yield: true,
      synonyms: true,
      buzzwords: true,
      classic_triad: true,
      clinical_pearls: true,
      differentials: true,
      mnemonic: true,
      relatedSystems: true,
      best_initial_test: true,
      gold_standard_dx: true,
      first_line_rx: true,
      age_demographic: true,
      gender_bias: true,
      classic_patient: true,
      disposition: true,
      patient_education: true,
      prevention: true,
      content: true,
      DrugConditionLink: {
        include: {
          Drug: { select: { id: true, genericName: true, brandName: true, drugClass: true } },
        },
      },
      FindingConditionLink: {
        include: {
          PhysicalExamFinding: {
            select: { id: true, name: true, category: true, system: true },
          },
        },
      },
      LabConditionLink: {
        include: {
          LabTest: { select: { id: true, name: true, category: true } },
        },
      },
      ImagingConditionLink: {
        include: {
          ImagingStudy: { select: { id: true, name: true, modality: true, bodyRegion: true } },
        },
      },
      ECGConditionLink: {
        include: {
          ECGPattern: { select: { id: true, name: true, category: true } },
        },
      },
      TreatmentConditionLink: {
        include: {
          Treatment: { select: { id: true, name: true, displayName: true, category: true } },
        },
      },
      other_MedicalContent: {
        where: { status: 'published' },
        select: { id: true, conditionId: true, condition: true, system: true },
      },
    } as const;

    const content = await prisma.medicalContent.findFirst({
      where: {
        conditionId,
        status: 'published',
      },
      select: contentSelect,
    });

    if (!content) {
      logger.info('Condition not found', {
        conditionId: conditionId.substring(0, 100),
      });

      return {
        data: {
          error: 'Condition not found',
          conditionId,
        },
        status: 404,
      };
    }

    logger.info('Condition content fetched', {
      conditionId: conditionId.substring(0, 100),
      condition: content.condition?.substring(0, 50),
      system: content.system,
    });

    return {
      data: {
        id: content.id,
        conditionId: content.conditionId,
        condition: content.condition,
        system: content.system,
        subcategory: content.subcategory,
        parent_category: content.parent_category,
        overview: content.overview,
        etiology: content.etiology,
        pathophysiology: content.pathophysiology,
        epidemiology: content.epidemiology,
        symptoms: content.symptoms,
        physicalExam: content.physicalExam,
        diagnostics: content.diagnostics,
        treatment: content.treatment,
        prognosis: content.prognosis,
        differentialDiagnosis: content.differentialDiagnosis,
        riskFactors: content.riskFactors,
        complications: content.complications,
        // SmartConditionView / Layered Disclosure fields
        pance_yield: content.pance_yield,
        synonyms: content.synonyms,
        buzzwords: content.buzzwords,
        classic_triad: content.classic_triad,
        clinical_pearls: content.clinical_pearls,
        differentials: content.differentials,
        mnemonic: content.mnemonic,
        relatedSystems: content.relatedSystems,
        best_initial_test: content.best_initial_test,
        gold_standard_dx: content.gold_standard_dx,
        first_line_rx: content.first_line_rx,
        age_demographic: content.age_demographic,
        gender_bias: content.gender_bias,
        classic_patient: content.classic_patient,
        disposition: content.disposition,
        patient_education: content.patient_education,
        prevention: content.prevention,
        content: content.content,
        // Relations
        DrugConditionLink: content.DrugConditionLink,
        FindingConditionLink: content.FindingConditionLink,
        LabConditionLink: content.LabConditionLink,
        ImagingConditionLink: content.ImagingConditionLink,
        ECGConditionLink: content.ECGConditionLink,
        TreatmentConditionLink: content.TreatmentConditionLink,
        other_MedicalContent: content.other_MedicalContent,
      },
    };
  } catch (error) {
    logger.error('Condition content error', {
      error: error instanceof Error ? error.message : String(error),
      conditionId: validated.params.conditionId.substring(0, 100),
    });
    throw new Error('Failed to fetch condition content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
