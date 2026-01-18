/**
 * Scenario Service - Database-First Multi-Step Branching Scenarios
 *
 * Fetches clinical scenarios from MedicalContent table for Virtual Encounter Mode.
 * Supports branching decision trees based on user actions.
 */

import { createEdgePrismaClient } from '../functions/api/_shared/prisma-edge';

export interface ScenarioStep {
  id: string;
  text: string;
  type: 'question' | 'exam' | 'diagnostic' | 'decision';
  options?: { text: string; nextStepId?: string; outcome?: string }[];
  physicalFinding?: string;
  diagnosticResult?: string;
}

export interface ClinicalScenario {
  id: string;
  conditionId: string;
  conditionName: string;
  patientAge: number;
  patientSex: string;
  chiefComplaint: string;
  correctDiagnosis: string;
  system: string;
  vitalSigns: {
    hr: number;
    sbp: number;
    dbp: number;
    rr: number;
    o2: number;
    temp: number;
  };
  initialStep: ScenarioStep;
  allSteps: Map<string, ScenarioStep>;
  teachingPoints: string[];
  idealWorkup: string[];
}

/**
 * Fetch a random clinical scenario from MedicalContent
 * Builds multi-step branching tree from structured content
 */
export async function fetchClinicalScenario(
  system?: string,
  databaseUrl?: string
): Promise<ClinicalScenario | null> {
  const prisma = createEdgePrismaClient(databaseUrl || process.env.DATABASE_URL!);

  try {
    const where = {
      publishStatus: 'published' as const,
      isHighYield: true,
      ...(system && { system }),
    };

    const count = await prisma.medicalContent.count({ where });
    if (count === 0) return null;

    const randomSkip = Math.floor(Math.random() * count);
    const content = await prisma.medicalContent.findFirst({
      where,
      skip: randomSkip,
      select: {
        id: true,
        condition: true,
        system: true,
        content: true,
        clinical_pearls: true,
        gold_standard_dx: true,
      },
    });

    if (!content) return null;

    // Parse content JSONB for scenario data
    const data = (content.content as any) || {};
    const scenario: ClinicalScenario = {
      id: content.id,
      conditionId: content.id,
      conditionName: content.condition,
      patientAge: data.demographics?.ageRange || Math.floor(Math.random() * 60) + 20,
      patientSex: data.demographics?.commonSex || (Math.random() > 0.5 ? 'M' : 'F'),
      chiefComplaint:
        data.presentation?.chiefComplaint ||
        data.clinical_pearls?.[0] ||
        'Patient presents for evaluation',
      correctDiagnosis: content.gold_standard_dx || content.condition,
      system: content.system,
      vitalSigns: {
        hr: data.vitals?.heartRate || 78,
        sbp: data.vitals?.systolic || 120,
        dbp: data.vitals?.diastolic || 80,
        rr: data.vitals?.respiratoryRate || 16,
        o2: data.vitals?.oxygenSaturation || 98,
        temp: data.vitals?.temperature || 98.6,
      },
      initialStep: {
        id: 'history-1',
        text:
          data.presentation?.openingStatement ||
          'Patient presents with chief complaint. Begin your history.',
        type: 'question',
        options: [
          { text: 'When did symptoms start?', nextStepId: 'history-2' },
          { text: 'Describe the symptoms', nextStepId: 'history-3' },
          { text: 'Any aggravating factors?', nextStepId: 'history-4' },
          { text: 'Past medical history?', nextStepId: 'history-5' },
        ],
      },
      allSteps: new Map(),
      teachingPoints: Array.isArray(data.teachingPoints)
        ? data.teachingPoints
        : content.clinical_pearls || [],
      idealWorkup: Array.isArray(data.workup)
        ? data.workup
        : [
            content.gold_standard_dx || 'Clinical diagnosis',
            'Targeted history and physical',
            'Appropriate diagnostic tests',
          ],
    };

    // Build step map (in real implementation, this would come from DB structure)
    scenario.allSteps.set('history-1', scenario.initialStep);
    scenario.allSteps.set('history-2', {
      id: 'history-2',
      text: data.presentation?.timeline || 'Symptoms began recently',
      type: 'question',
    });
    scenario.allSteps.set('history-3', {
      id: 'history-3',
      text: data.presentation?.description || 'Symptoms are as described in chief complaint',
      type: 'question',
    });

    return scenario;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Fetch multiple scenarios for batch mode (Grand Rounds)
 */
export async function fetchScenarioBatch(
  system: string,
  count: number,
  databaseUrl?: string
): Promise<ClinicalScenario[]> {
  const scenarios: ClinicalScenario[] = [];

  for (let i = 0; i < count; i++) {
    const scenario = await fetchClinicalScenario(system, databaseUrl);
    if (scenario) scenarios.push(scenario);
  }

  return scenarios;
}
