/**
 * GET /api/ddx/workup
 *
 * Get intelligent diagnostic workup algorithm for a presenting complaint
 * Returns a decision tree with branching logic based on test results
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const WorkupSchema = z.object({
  query: z.object({
    complaint: z.string().optional(),
    conditionId: z.string().optional(),
  }),
});

interface WorkupStep {
  order: number;
  action: 'test' | 'exam' | 'history' | 'decision';
  name: string;
  description?: string;
  branches?: {
    result: string;
    nextSteps?: WorkupStep[];
    diagnosis?: string;
    urgency?: 'emergent' | 'urgent' | 'routine';
  }[];
  cost?: 'low' | 'medium' | 'high';
}

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(WorkupSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/ddx/workup');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const complaint = validated.query?.complaint;
    const conditionId = validated.query?.conditionId;

    if (!complaint && !conditionId) {
      return { data: { error: 'complaint or conditionId required' }, status: 400 };
    }

    // Find DifferentialDiagnosis entry
    let ddx = null;
    if (complaint) {
      ddx = await prisma.differentialDiagnosis.findFirst({
        where: { presentingComplaint: { contains: complaint, mode: 'insensitive' } },
      });
    } else if (conditionId) {
      ddx = await prisma.differentialDiagnosis.findFirst({
        where: { primaryConditionId: conditionId },
      });
    }

    if (!ddx) {
      // Fallback: Generate workup from condition data
      const condition = conditionId
        ? await prisma.medicalContent.findUnique({ where: { id: conditionId } })
        : await prisma.medicalContent.findFirst({
            where: { condition: { contains: complaint || '', mode: 'insensitive' } },
          });

      if (!condition) {
        return { data: { error: 'No workup found for this complaint' }, status: 404 };
      }

      logger.info('Generated basic workup from condition', { conditionId: condition.id });
      return {
        data: {
          complaint: complaint || condition.condition,
          workupAlgorithm: generateBasicWorkup(condition),
          mustNotMiss: [],
          redFlags: [],
          source: 'generated_from_condition',
        },
      };
    }

    // Get linked conditions for the differential
    const linkedConditions = await prisma.differentialConditionLink.findMany({
      where: { differentialId: ddx.id },
      include: {
        Condition: { select: { id: true, name: true, displayName: true, system: true } },
        MedicalContent: {
          select: {
            gold_standard_dx: true,
            best_initial_test: true,
            first_line_rx: true,
            buzzwords: true,
          },
        },
      },
      orderBy: { rankOrder: 'asc' },
    });

    const relevantImaging = await prisma.imagingStudy.findMany({
      where: { OR: [{ firstLineFor: { hasSome: ddx.differentialList } }, { isHighYield: true }] },
      select: { name: true, modality: true, classicSigns: true, isHighYield: true },
      take: 5,
    });

    const relevantLabs = await prisma.labTest.findMany({
      where: {
        OR: [
          { isHighYield: true },
          { category: { in: ['CBC', 'BMP', 'Cardiac Markers', 'Inflammatory'] } },
        ],
      },
      select: { name: true, category: true, isHighYield: true, clinicalPearls: true },
      take: 10,
    });

    const workupAlgorithm = buildWorkupAlgorithm(
      ddx,
      linkedConditions,
      relevantLabs,
      relevantImaging
    );

    const scoringSystems = await prisma.scoringSystem.findMany({
      where: { OR: [{ condition: { in: ddx.differentialList } }, { isHighYield: true }] },
      select: {
        name: true,
        category: true,
        condition: true,
        whenToUse: true,
        interpretation: true,
      },
      take: 5,
    });

    logger.info('Fetched workup algorithm', { complaint: ddx.presentingComplaint });

    return {
      data: {
        complaint: ddx.presentingComplaint,
        category: ddx.category,
        isEmergency: ddx.isEmergency,
        differentials: {
          all: ddx.differentialList,
          mustNotMiss: ddx.mustNotMiss,
          mostCommon: ddx.mostCommon,
          mostDangerous: ddx.mostDangerous,
          oftenMissed: ddx.oftenMissed,
        },
        workupAlgorithm,
        initialWorkup: ddx.initialWorkup,
        redFlags: ddx.redFlags,
        keyQuestions: ddx.keyQuestions,
        keyExamFindings: ddx.keyExamFindings,
        reassuringFeatures: ddx.reassuringFeatures,
        distinguishingFeatures: ddx.distinguishingFeatures,
        linkedConditions: linkedConditions.map(
          (lc: {
            Condition: {
              id: string;
              name: string;
              displayName: string | null;
              system: string;
            } | null;
            MedicalContent: {
              gold_standard_dx: string | null;
              best_initial_test: string | null;
              first_line_rx: string | null;
              buzzwords: string[];
            } | null;
            likelihood: string | null;
            distinguishingFeatures: string[];
          }) => ({
            condition: lc.Condition,
            likelihood: lc.likelihood,
            distinguishingFeatures: lc.distinguishingFeatures,
            goldStandardDx: lc.MedicalContent?.gold_standard_dx,
            bestInitialTest: lc.MedicalContent?.best_initial_test,
            buzzwords: lc.MedicalContent?.buzzwords,
          })
        ),
        scoringSystems,
        panceYield: ddx.panceYield,
        isHighYield: ddx.isHighYield,
        clinicalPearls: ddx.clinicalPearls,
        commonMistakes: ddx.commonMistakes,
        source: 'database_ddx',
      },
    };
  } catch (error) {
    logger.error('Error fetching workup', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch workup algorithm');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function buildWorkupAlgorithm(
  ddx: any,
  linkedConditions: any[],
  labs: any[],
  imaging: any[]
): WorkupStep[] {
  const steps: WorkupStep[] = [];
  let order = 1;

  if (ddx.keyQuestions?.length > 0) {
    steps.push({
      order: order++,
      action: 'history',
      name: 'Focused History',
      description: 'Key questions to differentiate diagnoses',
      branches: ddx.keyQuestions.map((q: string) => ({ result: q })),
    });
  }
  if (ddx.keyExamFindings?.length > 0) {
    steps.push({
      order: order++,
      action: 'exam',
      name: 'Physical Examination',
      description: 'Key findings to identify',
      branches: ddx.keyExamFindings.map((f: string) => ({ result: f })),
    });
  }
  if (ddx.initialWorkup?.length > 0 || labs.length > 0) {
    const labList =
      ddx.initialWorkup?.length > 0 ? ddx.initialWorkup : labs.slice(0, 5).map((l: any) => l.name);
    steps.push({
      order: order++,
      action: 'test',
      name: 'Initial Laboratory Studies',
      description: 'First-line labs to order',
      branches: labList.map((lab: string) => ({
        result: lab,
        urgency: ddx.isEmergency ? 'emergent' : ('routine' as const),
      })),
      cost: 'medium',
    });
  }
  if (imaging.length > 0) {
    const firstLineImaging = imaging.filter((i: any) =>
      ddx.differentialList.some((d: string) => i.firstLineFor?.includes(d))
    );
    if (firstLineImaging.length > 0 || ddx.isEmergency) {
      steps.push({
        order: order++,
        action: 'test',
        name: 'Imaging Studies',
        description: 'Key imaging to consider',
        branches: (firstLineImaging.length > 0 ? firstLineImaging : imaging.slice(0, 3)).map(
          (img: any) => ({ result: `${img.name} (${img.modality})` })
        ),
        cost: 'high',
      });
    }
  }
  if (ddx.mustNotMiss?.length > 0) {
    steps.push({
      order: order++,
      action: 'decision',
      name: 'Rule Out Must-Not-Miss',
      description: 'Critical diagnoses that must be excluded',
      branches: ddx.mustNotMiss.map((mnm: string) => ({
        result: `${mnm} ruled out`,
        urgency: 'emergent' as const,
      })),
    });
  }
  return steps;
}

function generateBasicWorkup(condition: any): WorkupStep[] {
  const steps: WorkupStep[] = [];
  let order = 1;
  if (condition.best_initial_test)
    steps.push({
      order: order++,
      action: 'test',
      name: 'Initial Test',
      description: condition.best_initial_test,
    });
  if (condition.gold_standard_dx)
    steps.push({
      order: order++,
      action: 'test',
      name: 'Gold Standard Diagnosis',
      description: condition.gold_standard_dx,
    });
  if (condition.diagnostics)
    steps.push({
      order: order++,
      action: 'test',
      name: 'Additional Diagnostics',
      description: condition.diagnostics,
    });
  return steps;
}
