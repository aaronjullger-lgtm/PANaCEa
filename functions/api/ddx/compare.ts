/**
 * GET /api/ddx/compare
 *
 * Deep comparison of 2+ conditions with all linked entity data
 * Returns comprehensive comparison data from junction tables
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const CompareSchema = z.object({
  query: z.object({
    ids: z.string().min(1),
  }),
});

interface DeepConditionData {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  classic_patient?: string;
  symptoms?: string;
  buzzwords?: string[];
  pathophysiology?: string;
  etiology?: string;
  riskFactors?: string;
  physicalExam?: string;
  gold_standard_dx?: string;
  best_initial_test?: string;
  diagnostics?: string;
  differentialDiagnosis?: string;
  first_line_rx?: string;
  treatment?: string;
  rx_mechanism?: string;
  rx_side_effects?: string;
  age_demographic?: any;
  gender_bias?: string;
  complications?: string;
  prognosis?: string;
  prevention?: string;
  pance_yield?: number;
  clinical_pearls?: any;
  mnemonic?: string;
  linkedLabs?: Array<{
    name: string;
    expectedResult?: string;
    significance?: string;
    isHighYield: boolean;
  }>;
  linkedImaging?: Array<{
    name: string;
    modality: string;
    expectedFindings?: string[];
    classicFindings?: string;
  }>;
  linkedFindings?: Array<{
    name: string;
    system: string;
    clinicalSignificance?: string;
    sensitivity?: number;
    specificity?: number;
  }>;
  linkedDrugs?: Array<{
    genericName: string;
    brandName?: string;
    isFirstLine: boolean;
    mechanismOfAction?: string;
  }>;
  linkedScoringSystem?: Array<{ name: string; category: string; whenToUse?: string }>;
}

export const onRequestGet = publicEndpoint(CompareSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/ddx/compare');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const conditionIds = validated.query?.ids?.split(',').filter(Boolean) || [];

    if (conditionIds.length < 2) {
      return {
        data: { error: 'At least 2 condition IDs required (comma-separated)' },
        status: 400,
      };
    }

    if (conditionIds.length > 5) {
      return { data: { error: 'Maximum 5 conditions for comparison' }, status: 400 };
    }

    const conditions = await Promise.all(
      conditionIds.map(async (id) => {
        const medicalContent = await prisma.medicalContent.findUnique({
          where: { id },
          select: {
            id: true,
            conditionId: true,
            condition: true,
            system: true,
            subcategory: true,
            content: true,
            buzzwords: true,
            symptoms: true,
            pathophysiology: true,
            etiology: true,
            riskFactors: true,
            physicalExam: true,
            diagnostics: true,
            differentialDiagnosis: true,
            treatment: true,
            complications: true,
            prognosis: true,
            overview: true,
            gold_standard_dx: true,
            best_initial_test: true,
            first_line_rx: true,
            age_demographic: true,
            gender_bias: true,
            classic_patient: true,
            pance_yield: true,
            clinical_pearls: true,
            mnemonic: true,
            prevention: true,
          },
        });

        if (!medicalContent) return null;

        const [labs, imaging, findings, drugs, scoringSystems] = await Promise.all([
          prisma.labConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              LabTest: {
                select: { name: true, category: true, isHighYield: true, panceYield: true },
              },
            },
            take: 10,
          }),
          prisma.imagingConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              ImagingStudy: {
                select: { name: true, modality: true, classicSigns: true, isHighYield: true },
              },
            },
            take: 10,
          }),
          prisma.findingConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              PhysicalExamFinding: {
                select: {
                  name: true,
                  system: true,
                  clinicalSignificance: true,
                  sensitivity: true,
                  specificity: true,
                },
              },
            },
            take: 10,
          }),
          prisma.drugConditionLink.findMany({
            where: { medicalContentId: id },
            include: {
              Drug: {
                select: {
                  genericName: true,
                  brandName: true,
                  mechanismOfAction: true,
                  isFirstLine: true,
                },
              },
            },
            take: 10,
          }),
          prisma.scoringSystemConditionLink.findMany({
            where: { medicalContentId: id },
            include: { ScoringSystem: { select: { name: true, category: true, whenToUse: true } } },
            take: 5,
          }),
        ]);

        return {
          ...medicalContent,
          linkedLabs: labs.map(
            (l: {
              LabTest: { name: string; isHighYield: boolean };
              expectedResult: string | null;
              significance: string | null;
            }) => ({
              name: l.LabTest.name,
              expectedResult: l.expectedResult,
              significance: l.significance,
              isHighYield: l.LabTest.isHighYield,
            })
          ),
          linkedImaging: imaging.map(
            (i: {
              ImagingStudy: { name: string; modality: string; classicSigns: string[] | null };
              expectedFindings: string[] | null;
              classicFindings: string | null;
            }) => ({
              name: i.ImagingStudy.name,
              modality: i.ImagingStudy.modality,
              expectedFindings: i.expectedFindings,
              classicFindings: i.classicFindings,
            })
          ),
          linkedFindings: findings.map(
            (f: {
              PhysicalExamFinding: {
                name: string;
                system: string;
                clinicalSignificance: string | null;
              };
              sensitivity: number | null;
              specificity: number | null;
            }) => ({
              name: f.PhysicalExamFinding.name,
              system: f.PhysicalExamFinding.system,
              clinicalSignificance: f.PhysicalExamFinding.clinicalSignificance,
              sensitivity: f.sensitivity,
              specificity: f.specificity,
            })
          ),
          linkedDrugs: drugs.map(
            (d: {
              Drug: {
                genericName: string;
                brandName: string | null;
                mechanismOfAction: string | null;
              };
              isFirstLine: boolean;
            }) => ({
              genericName: d.Drug.genericName,
              brandName: d.Drug.brandName,
              isFirstLine: d.isFirstLine,
              mechanismOfAction: d.Drug.mechanismOfAction,
            })
          ),
          linkedScoringSystem: scoringSystems.map(
            (s: {
              ScoringSystem: { name: string; category: string; whenToUse: string | null };
            }) => ({
              name: s.ScoringSystem.name,
              category: s.ScoringSystem.category,
              whenToUse: s.ScoringSystem.whenToUse,
            })
          ),
        } as DeepConditionData;
      })
    );

    const validConditions = conditions.filter((c): c is DeepConditionData => c !== null);

    if (validConditions.length < 2) {
      return { data: { error: 'Not enough valid conditions found for comparison' }, status: 404 };
    }

    const discriminatingFeatures: string[] = [];
    const fieldsToCheck = [
      'classic_patient',
      'gold_standard_dx',
      'best_initial_test',
      'first_line_rx',
      'age_demographic',
      'gender_bias',
    ];

    fieldsToCheck.forEach((field) => {
      const values = validConditions.map((c) => c[field as keyof DeepConditionData]);
      const uniqueValues = new Set(values.filter((v) => v != null));
      if (uniqueValues.size > 1) discriminatingFeatures.push(field);
    });

    const uniqueEntities = validConditions.map((condition) => {
      const otherConditions = validConditions.filter((c) => c.id !== condition.id);
      const otherLabNames = new Set(
        otherConditions.flatMap((c) => c.linkedLabs?.map((l) => l.name) || [])
      );
      const otherImagingNames = new Set(
        otherConditions.flatMap((c) => c.linkedImaging?.map((i) => i.name) || [])
      );
      return {
        conditionId: condition.id,
        uniqueLabs: condition.linkedLabs?.filter((l) => !otherLabNames.has(l.name)) || [],
        uniqueImaging: condition.linkedImaging?.filter((i) => !otherImagingNames.has(i.name)) || [],
      };
    });

    logger.info('Compared conditions', { count: validConditions.length, ids: conditionIds });

    return {
      data: {
        conditions: validConditions,
        discriminatingFeatures,
        uniqueEntities,
        comparisonFields: [
          { key: 'classic_patient', label: 'Classic Patient', category: 'presentation' },
          { key: 'symptoms', label: 'Symptoms', category: 'presentation' },
          { key: 'buzzwords', label: 'Buzzwords', category: 'presentation' },
          { key: 'physicalExam', label: 'Physical Exam', category: 'presentation' },
          { key: 'age_demographic', label: 'Age', category: 'demographics' },
          { key: 'gender_bias', label: 'Gender Bias', category: 'demographics' },
          { key: 'riskFactors', label: 'Risk Factors', category: 'demographics' },
          { key: 'pathophysiology', label: 'Pathophysiology', category: 'pathophysiology' },
          { key: 'etiology', label: 'Etiology', category: 'pathophysiology' },
          { key: 'gold_standard_dx', label: 'Gold Standard Dx', category: 'diagnosis' },
          { key: 'best_initial_test', label: 'Best Initial Test', category: 'diagnosis' },
          { key: 'diagnostics', label: 'Diagnostics', category: 'diagnosis' },
          { key: 'linkedLabs', label: 'Labs', category: 'diagnosis', isLinkedEntity: true },
          { key: 'linkedImaging', label: 'Imaging', category: 'diagnosis', isLinkedEntity: true },
          {
            key: 'linkedFindings',
            label: 'Exam Findings',
            category: 'diagnosis',
            isLinkedEntity: true,
          },
          { key: 'first_line_rx', label: 'First-Line Rx', category: 'treatment' },
          { key: 'treatment', label: 'Treatment', category: 'treatment' },
          { key: 'rx_mechanism', label: 'Rx Mechanism', category: 'treatment' },
          { key: 'linkedDrugs', label: 'Medications', category: 'treatment', isLinkedEntity: true },
          { key: 'complications', label: 'Complications', category: 'prognosis' },
          { key: 'prognosis', label: 'Prognosis', category: 'prognosis' },
          { key: 'prevention', label: 'Prevention', category: 'prognosis' },
        ],
      },
    };
  } catch (error) {
    logger.error('Error comparing conditions', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to compare conditions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
