/**
 * Polypharmacy Drill API Endpoint
 *
 * Database-first approach for polypharmacy puzzle cases.
 * Generates cases dynamically from drug registry and clinical scenarios.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import type { PolypharmacyCase, Medication } from '@/types/drill-modes';

/**
 * Common high-risk medication scenarios for deprescribing
 */
const DEPRESCRIBING_SCENARIOS = [
  {
    concern: 'Fall risk in elderly patient',
    riskFactors: ['age > 75', 'history of falls', 'gait instability'],
    problematicClasses: [
      'benzodiazepines',
      'sedative-hypnotics',
      'antipsychotics',
      'tricyclic antidepressants',
    ],
    explanation:
      'Medications affecting CNS increase fall risk in elderly patients due to sedation, orthostatic hypotension, and impaired balance.',
  },
  {
    concern: 'QT prolongation risk',
    riskFactors: ['female', 'electrolyte abnormalities', 'cardiac history'],
    problematicClasses: ['antiarrhythmics', 'macrolides', 'fluoroquinolones', 'antipsychotics'],
    explanation:
      'Multiple QT-prolonging medications increase risk of torsades de pointes, especially with other risk factors.',
  },
  {
    concern: 'Anticholinergic burden',
    riskFactors: ['age > 65', 'cognitive impairment', 'urinary retention'],
    problematicClasses: [
      'antihistamines',
      'tricyclic antidepressants',
      'antispasmodics',
      'muscle relaxants',
    ],
    explanation:
      'Cumulative anticholinergic effects can cause confusion, constipation, urinary retention, and increased fall risk.',
  },
  {
    concern: 'Bleeding risk with polypharmacy',
    riskFactors: ['age > 75', 'NSAID use', 'anticoagulation', 'GI history'],
    problematicClasses: ['NSAIDs', 'antiplatelet agents', 'SSRIs', 'corticosteroids'],
    explanation:
      'Multiple medications affecting coagulation increase bleeding risk, especially in elderly with comorbidities.',
  },
  {
    concern: 'Drug-drug interaction risk',
    riskFactors: [
      'polypharmacy (>5 medications)',
      'narrow therapeutic index drugs',
      'hepatic/renal impairment',
    ],
    problematicClasses: ['CYP3A4 inhibitors', 'CYP3A4 inducers', 'P-glycoprotein substrates'],
    explanation:
      'Complex drug interactions can lead to reduced efficacy or increased toxicity of critical medications.',
  },
];

/**
 * Generate a polypharmacy case based on clinical scenario
 */
function generatePolypharmacyCase(
  scenario: (typeof DEPRESCRIBING_SCENARIOS)[0],
  availableDrugs: Array<{
    genericName: string;
    drugClass: string[];
    sideEffects: string[];
    interactions: string[];
  }>,
  difficulty: 'easy' | 'medium' | 'hard'
): PolypharmacyCase {
  const caseId = `polypharm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Select age based on scenario
  const age = scenario.riskFactors.some((f) => f.includes('age > 75'))
    ? 78 + Math.floor(Math.random() * 10)
    : scenario.riskFactors.some((f) => f.includes('age > 65'))
      ? 67 + Math.floor(Math.random() * 10)
      : 55 + Math.floor(Math.random() * 20);

  // Select problematic medications
  const problematicMeds = availableDrugs.filter((drug) =>
    drug.drugClass.some((dc) =>
      scenario.problematicClasses.some((pc) => dc.toLowerCase().includes(pc.toLowerCase()))
    )
  );

  // Select safe medications
  const safeMeds = availableDrugs.filter(
    (drug) =>
      !drug.drugClass.some((dc) =>
        scenario.problematicClasses.some((pc) => dc.toLowerCase().includes(pc.toLowerCase()))
      )
  );

  // Build medication list based on difficulty
  const numProblematic = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  const numSafe = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 6;

  const selectedProblematic = problematicMeds
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(numProblematic, problematicMeds.length));

  const selectedSafe = safeMeds
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(numSafe, safeMeds.length));

  const medications: Medication[] = [
    ...selectedProblematic.map((drug) => ({
      id: `med_${drug.genericName.replace(/\s/g, '_')}`,
      name: drug.genericName,
      indication: getCommonIndication(drug.drugClass),
      class: drug.drugClass[0] ?? 'unknown',
      sideEffects: drug.sideEffects,
      interactions: drug.interactions,
    })),
    ...selectedSafe.map((drug) => ({
      id: `med_${drug.genericName.replace(/\s/g, '_')}`,
      name: drug.genericName,
      indication: getCommonIndication(drug.drugClass),
      class: drug.drugClass[0] ?? 'unknown',
      sideEffects: drug.sideEffects,
      interactions: drug.interactions,
    })),
  ].sort(() => Math.random() - 0.5); // Shuffle

  const correctMedicationsToStop = selectedProblematic.map(
    (drug) => `med_${drug.genericName.replace(/\s/g, '_')}`
  );

  const deprescribingRationale: Record<string, string> = {};
  selectedProblematic.forEach((drug) => {
    const medId = `med_${drug.genericName.replace(/\s/g, '_')}`;
    deprescribingRationale[medId] =
      `${drug.genericName} (${drug.drugClass[0] ?? 'unknown'}) should be stopped: ${scenario.explanation}`;
  });

  return {
    id: caseId,
    patientInfo: generatePatientInfo(age, scenario),
    age,
    medications,
    clinicalConcern: scenario.concern,
    correctMedicationsToStop,
    explanation: scenario.explanation,
    deprescribingRationale,
    teachingPoints: [
      `Always assess ${scenario.concern} in elderly patients with polypharmacy`,
      `Consider STOPP/START criteria for medication review`,
      `Risk factors include: ${scenario.riskFactors.join(', ')}`,
      `Problematic classes: ${scenario.problematicClasses.join(', ')}`,
    ],
  };
}

function generatePatientInfo(age: number, scenario: (typeof DEPRESCRIBING_SCENARIOS)[0]): string {
  const riskFactors = scenario.riskFactors ?? [];
  const concern = scenario.concern ?? 'medication review';
  const templates = [
    `${age}-year-old patient presents to clinic for medication review. ${riskFactors.map((r) => r.replace('age >', 'Patient has')).join(', ')}.`,
    `Patient is a ${age}-year-old with concerns about ${concern.toLowerCase()}. Risk factors include ${riskFactors.slice(1).join(' and ')}.`,
    `${age}yo patient admitted after recent adverse event. History significant for ${riskFactors.slice(1).join(', ')}.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)] ?? '';
}

function getCommonIndication(drugClasses: string[]): string {
  const indicationMap: Record<string, string> = {
    benzodiazepine: 'Anxiety/Insomnia',
    sedative: 'Insomnia',
    antipsychotic: 'Psychosis/Agitation',
    tricyclic: 'Depression/Neuropathic pain',
    antiarrhythmic: 'Atrial fibrillation',
    macrolide: 'Bacterial infection',
    fluoroquinolone: 'UTI/Respiratory infection',
    antihistamine: 'Allergies',
    antispasmodic: 'Overactive bladder',
    nsaid: 'Pain/Inflammation',
    antiplatelet: 'Cardiovascular prevention',
    ssri: 'Depression/Anxiety',
    corticosteroid: 'Inflammation',
    antihypertensive: 'Hypertension',
    statin: 'Hyperlipidemia',
    ppi: 'GERD',
    metformin: 'Type 2 Diabetes',
  };

  for (const drugClass of drugClasses) {
    const lower = drugClass.toLowerCase();
    for (const [key, indication] of Object.entries(indicationMap)) {
      if (lower.includes(key)) return indication;
    }
  }

  return 'Various conditions';
}

const PolypharmacyDrillSchema = z.object({
  count: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

/**
 * GET /api/questions/polypharmacy-drill
 *
 * Query params:
 * - count: number of cases to return (default 1)
 * - difficulty: 'easy' | 'medium' | 'hard' (optional)
 */

export const onRequestGet = authenticatedEndpoint(
  PolypharmacyDrillSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/polypharmacy-drill');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const count = Math.min(parseInt(validated.count || '1', 10), 5); // Max 5 cases
      const difficulty = (validated.difficulty || 'medium') as 'easy' | 'medium' | 'hard';

      // Query drug registry for case generation
      const drugs = await prisma.drug.findMany({
        where: {
          drugClass: { isEmpty: false },
        },
        select: {
          genericName: true,
          drugClass: true,
          sideEffects: true,
          interactions: true,
        },
        take: 100, // Get a good variety of drugs
      });

      if (drugs.length === 0) {
        logger.error('No drugs available in database', { userId: auth.userId });
        throw new Error('No drugs available in database. Run: npm run sync:all');
      }

      // Generate cases
      const cases: PolypharmacyCase[] = [];
      const scenarios = [...DEPRESCRIBING_SCENARIOS].sort(() => Math.random() - 0.5);

      for (let i = 0; i < count; i++) {
        const scenario = scenarios[i % scenarios.length];
        if (scenario) {
          cases.push(generatePolypharmacyCase(scenario, drugs, difficulty));
        }
      }

      logger.info('Polypharmacy cases generated', {
        userId: auth.userId,
        count,
        difficulty,
      });

      return {
        data: { cases },
      };
    } catch (error) {
      logger.error('Error in polypharmacy-drill endpoint', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
      });
      throw new Error('Failed to generate polypharmacy cases');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
