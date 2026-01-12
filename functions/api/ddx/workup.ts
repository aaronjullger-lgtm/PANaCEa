/**
 * GET /api/ddx/workup
 * 
 * Get intelligent diagnostic workup algorithm for a presenting complaint
 * Returns a decision tree with branching logic based on test results
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';

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
  sensitivity?: number;
  specificity?: number;
  cost?: 'low' | 'medium' | 'high';
  timeToResult?: string;
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(request.url);
  const complaint = url.searchParams.get('complaint');
  const conditionId = url.searchParams.get('conditionId');

  if (!complaint && !conditionId) {
    return new Response(
      JSON.stringify({ error: 'complaint or conditionId required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Find DifferentialDiagnosis entry
    let ddx = null;
    if (complaint) {
      ddx = await prisma.differentialDiagnosis.findFirst({
        where: {
          presentingComplaint: { contains: complaint, mode: 'insensitive' },
        },
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
        return new Response(
          JSON.stringify({ error: 'No workup found for this complaint' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate basic workup from condition fields
      return new Response(
        JSON.stringify({
          complaint: complaint || condition.condition,
          workupAlgorithm: generateBasicWorkup(condition),
          mustNotMiss: [],
          redFlags: [],
          source: 'generated_from_condition',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get linked conditions for the differential
    const linkedConditions = await prisma.differentialConditionLink.findMany({
      where: { differentialId: ddx.id },
      include: {
        Condition: {
          select: {
            id: true,
            name: true,
            displayName: true,
            system: true,
          },
        },
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

    // Get imaging studies for initial workup
    const relevantImaging = await prisma.imagingStudy.findMany({
      where: {
        OR: [
          { firstLineFor: { hasSome: ddx.differentialList } },
          { isHighYield: true },
        ],
      },
      select: {
        name: true,
        modality: true,
        classicSigns: true,
        isHighYield: true,
      },
      take: 5,
    });

    // Get relevant labs
    const relevantLabs = await prisma.labTest.findMany({
      where: {
        OR: [
          { isHighYield: true },
          { category: { in: ['CBC', 'BMP', 'Cardiac Markers', 'Inflammatory'] } },
        ],
      },
      select: {
        name: true,
        category: true,
        isHighYield: true,
        clinicalPearls: true,
      },
      take: 10,
    });

    // Build intelligent workup algorithm
    const workupAlgorithm: WorkupStep[] = buildWorkupAlgorithm(
      ddx,
      linkedConditions,
      relevantLabs,
      relevantImaging
    );

    // Get scoring systems relevant to this workup
    const scoringSystems = await prisma.scoringSystem.findMany({
      where: {
        OR: [
          { condition: { in: ddx.differentialList } },
          { isHighYield: true },
        ],
      },
      select: {
        name: true,
        category: true,
        condition: true,
        whenToUse: true,
        interpretation: true,
      },
      take: 5,
    });

    return new Response(
      JSON.stringify({
        complaint: ddx.presentingComplaint,
        category: ddx.category,
        isEmergency: ddx.isEmergency,
        
        // Core differential data
        differentials: {
          all: ddx.differentialList,
          mustNotMiss: ddx.mustNotMiss,
          mostCommon: ddx.mostCommon,
          mostDangerous: ddx.mostDangerous,
          oftenMissed: ddx.oftenMissed,
        },
        
        // Workup algorithm
        workupAlgorithm,
        initialWorkup: ddx.initialWorkup,
        
        // Clinical context
        redFlags: ddx.redFlags,
        keyQuestions: ddx.keyQuestions,
        keyExamFindings: ddx.keyExamFindings,
        reassuringFeatures: ddx.reassuringFeatures,
        
        // Distinguishing features
        distinguishingFeatures: ddx.distinguishingFeatures,
        
        // Linked conditions with details
        linkedConditions: linkedConditions.map(lc => ({
          condition: lc.Condition,
          likelihood: lc.likelihood,
          distinguishingFeatures: lc.distinguishingFeatures,
          goldStandardDx: lc.MedicalContent?.gold_standard_dx,
          bestInitialTest: lc.MedicalContent?.best_initial_test,
          buzzwords: lc.MedicalContent?.buzzwords,
        })),
        
        // Clinical tools
        scoringSystems,
        
        // PANCE context
        panceYield: ddx.panceYield,
        isHighYield: ddx.isHighYield,
        clinicalPearls: ddx.clinicalPearls,
        commonMistakes: ddx.commonMistakes,
        
        source: 'database_ddx',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching workup:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch workup algorithm' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Build a structured workup algorithm from database data
 */
function buildWorkupAlgorithm(
  ddx: any,
  linkedConditions: any[],
  labs: any[],
  imaging: any[]
): WorkupStep[] {
  const steps: WorkupStep[] = [];
  let order = 1;

  // Step 1: History (Key Questions)
  if (ddx.keyQuestions?.length > 0) {
    steps.push({
      order: order++,
      action: 'history',
      name: 'Focused History',
      description: 'Key questions to differentiate diagnoses',
      branches: ddx.keyQuestions.map((q: string) => ({
        result: q,
        diagnosis: undefined,
      })),
    });
  }

  // Step 2: Physical Exam
  if (ddx.keyExamFindings?.length > 0) {
    steps.push({
      order: order++,
      action: 'exam',
      name: 'Physical Examination',
      description: 'Key findings to identify',
      branches: ddx.keyExamFindings.map((f: string) => ({
        result: f,
        diagnosis: undefined,
      })),
    });
  }

  // Step 3: Initial Labs
  if (ddx.initialWorkup?.length > 0 || labs.length > 0) {
    const labList = ddx.initialWorkup?.length > 0 
      ? ddx.initialWorkup 
      : labs.slice(0, 5).map((l: any) => l.name);
    
    steps.push({
      order: order++,
      action: 'test',
      name: 'Initial Laboratory Studies',
      description: 'First-line labs to order',
      branches: labList.map((lab: string) => {
        // Find which conditions this lab points to
        const pointingTo = linkedConditions.filter(lc => 
          lc.MedicalContent?.best_initial_test?.toLowerCase().includes(lab.toLowerCase())
        );
        return {
          result: lab,
          diagnosis: pointingTo.length === 1 ? pointingTo[0].Condition.name : undefined,
          urgency: ddx.isEmergency ? 'emergent' : 'routine' as 'emergent' | 'routine',
        };
      }),
      cost: 'medium',
    });
  }

  // Step 4: Imaging
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
        branches: (firstLineImaging.length > 0 ? firstLineImaging : imaging.slice(0, 3)).map((img: any) => ({
          result: `${img.name} (${img.modality})`,
          diagnosis: undefined,
        })),
        cost: 'high',
      });
    }
  }

  // Step 5: Decision point based on must-not-miss
  if (ddx.mustNotMiss?.length > 0) {
    steps.push({
      order: order++,
      action: 'decision',
      name: 'Rule Out Must-Not-Miss',
      description: 'Critical diagnoses that must be excluded',
      branches: ddx.mustNotMiss.map((mnm: string) => {
        const condition = linkedConditions.find(lc => 
          lc.Condition.name.toLowerCase() === mnm.toLowerCase()
        );
        return {
          result: `${mnm} ruled out`,
          nextSteps: condition?.MedicalContent?.gold_standard_dx 
            ? [{ 
                order: 1, 
                action: 'test' as const, 
                name: condition.MedicalContent.gold_standard_dx,
                description: `Gold standard to rule out ${mnm}`,
              }]
            : undefined,
          urgency: 'emergent' as const,
        };
      }),
    });
  }

  return steps;
}

/**
 * Generate basic workup from condition data when no DDx entry exists
 */
function generateBasicWorkup(condition: any): WorkupStep[] {
  const steps: WorkupStep[] = [];
  let order = 1;

  if (condition.best_initial_test) {
    steps.push({
      order: order++,
      action: 'test',
      name: 'Initial Test',
      description: condition.best_initial_test,
    });
  }

  if (condition.gold_standard_dx) {
    steps.push({
      order: order++,
      action: 'test',
      name: 'Gold Standard Diagnosis',
      description: condition.gold_standard_dx,
    });
  }

  if (condition.diagnostics) {
    steps.push({
      order: order++,
      action: 'test',
      name: 'Additional Diagnostics',
      description: condition.diagnostics,
    });
  }

  return steps;
}
