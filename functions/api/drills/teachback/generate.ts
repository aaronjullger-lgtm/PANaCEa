/**
 * Teach-Back Generate Endpoint
 * GET /api/drills/teachback/generate
 *
 * Selects a well-learned topic for the student to "teach back" —
 * topics where the student has high stability (>30 days) and multiple reps (≥5).
 * This leverages the generation effect: explaining material strengthens retention
 * more than passive review.
 *
 * Research:
 * - Fiorella & Mayer (2016): Learning by explaining improves understanding
 * - Chi et al. (1994): Self-explanation effect
 * - Roscoe & Chi (2007): Tutor learning — explaining to others deepens knowledge
 *
 * @see hooks/game/use-teachback-drill.ts
 * @see functions/api/drills/teachback/grade.ts
 */

import { authenticatedEndpoint, withCors} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const querySchema = z.object({
  system: z.string().optional(),
}).optional().default({});

interface TeachBackTopic {
  id: string;
  topic: string;
  system: string;
  prompt: string;
  expectedConcepts: string[];
  difficulty: 'foundational' | 'intermediate' | 'advanced';
}

/**
 * High-yield PA topics organized by PANCE blueprint system.
 * Each topic has a teach-back prompt and key concepts the student should cover.
 */
const TEACHBACK_TOPICS: TeachBackTopic[] = [
  {
    id: 'tb-chf-mgmt',
    topic: 'Heart Failure Management',
    system: 'Cardiovascular',
    prompt: 'Explain the stepwise pharmacologic management of heart failure with reduced ejection fraction (HFrEF) to a first-year PA student.',
    expectedConcepts: ['ACEi/ARB or ARNI', 'Beta-blocker (carvedilol, metoprolol succinate, bisoprolol)', 'Mineralocorticoid receptor antagonist', 'SGLT2 inhibitor', 'Diuretics for volume overload', 'Hydralazine/nitrate for African American patients'],
    difficulty: 'intermediate',
  },
  {
    id: 'tb-copd-exac',
    topic: 'COPD Exacerbation',
    system: 'Pulmonary',
    prompt: 'A colleague asks you to explain how to manage an acute COPD exacerbation. Walk them through the assessment and treatment.',
    expectedConcepts: ['Short-acting bronchodilators (SABA + SAMA)', 'Systemic corticosteroids (5-day course)', 'Antibiotics if purulent sputum/severe', 'Supplemental O2 targeting 88-92%', 'NIV/BiPAP for respiratory acidosis', 'ABG interpretation'],
    difficulty: 'intermediate',
  },
  {
    id: 'tb-dm2-pharm',
    topic: 'Type 2 Diabetes Pharmacotherapy',
    system: 'Endocrine',
    prompt: 'Teach a fellow student the approach to pharmacologic management of Type 2 Diabetes, including first-line therapy and when to escalate.',
    expectedConcepts: ['Metformin first-line', 'A1C targets', 'GLP-1 RA for CV/renal benefit', 'SGLT2i for heart failure/CKD', 'Insulin initiation criteria', 'Sulfonylurea hypoglycemia risk'],
    difficulty: 'foundational',
  },
  {
    id: 'tb-aki-eval',
    topic: 'Acute Kidney Injury Evaluation',
    system: 'Renal',
    prompt: 'Explain the diagnostic workup and classification of acute kidney injury (AKI) to a classmate, including how to differentiate prerenal, intrinsic, and postrenal causes.',
    expectedConcepts: ['KDIGO staging (Cr rise / UOP criteria)', 'Prerenal: BUN/Cr >20:1, FENa <1%, concentrated urine', 'Intrinsic: ATN (muddy brown casts), AIN, glomerulonephritis', 'Postrenal: obstruction, hydronephrosis on US', 'Urinalysis and urine electrolytes', 'Fluid challenge for prerenal'],
    difficulty: 'intermediate',
  },
  {
    id: 'tb-pe-dx',
    topic: 'Pulmonary Embolism Diagnosis',
    system: 'Pulmonary',
    prompt: 'Walk through the diagnostic algorithm for suspected pulmonary embolism, from initial risk stratification to confirmative imaging.',
    expectedConcepts: ['Wells criteria or revised Geneva score', 'D-dimer for low/intermediate probability', 'CT pulmonary angiography (CTPA)', 'V/Q scan alternative', 'Signs: tachycardia, pleuritic pain, hypoxia', 'Massive PE: hypotension, RV strain, thrombolytics'],
    difficulty: 'intermediate',
  },
  {
    id: 'tb-abx-spectrum',
    topic: 'Antibiotic Spectrum of Activity',
    system: 'Infectious Disease',
    prompt: 'Teach the major antibiotic classes and their spectrum of activity to a first-year student. Focus on the most commonly tested agents.',
    expectedConcepts: ['Penicillins (amoxicillin, ampicillin-sulbactam, piperacillin-tazobactam)', 'Cephalosporin generations', 'Fluoroquinolones (respiratory vs urinary)', 'Macrolides (atypical coverage)', 'Vancomycin (MRSA)', 'Metronidazole (anaerobes)'],
    difficulty: 'foundational',
  },
  {
    id: 'tb-thyroid',
    topic: 'Thyroid Disorder Workup',
    system: 'Endocrine',
    prompt: 'Explain the diagnostic approach to thyroid disorders — how to interpret TSH and free T4 results and differentiate common etiologies.',
    expectedConcepts: ['TSH screening first', 'Low TSH + high T4 = hyperthyroid', 'High TSH + low T4 = hypothyroid', 'Graves disease vs toxic nodule vs thyroiditis', 'Hashimoto (anti-TPO)', 'Subclinical patterns'],
    difficulty: 'foundational',
  },
  {
    id: 'tb-stroke-mgmt',
    topic: 'Acute Stroke Management',
    system: 'Neurology',
    prompt: 'A medical student asks you to explain the acute management of ischemic stroke. Walk them through the time-critical steps.',
    expectedConcepts: ['ABCs and stabilization', 'Non-contrast CT to rule out hemorrhage', 'tPA within 4.5 hours (inclusion/exclusion)', 'Mechanical thrombectomy for LVO up to 24h', 'BP management thresholds', 'NIH Stroke Scale'],
    difficulty: 'advanced',
  },
  {
    id: 'tb-anemia-ddx',
    topic: 'Anemia Differential Diagnosis',
    system: 'Hematology',
    prompt: 'Teach a classmate how to use the MCV-based approach to narrow the differential diagnosis of anemia.',
    expectedConcepts: ['Microcytic: iron deficiency, thalassemia, chronic disease, sideroblastic', 'Normocytic: acute blood loss, chronic disease, hemolysis, aplastic', 'Macrocytic: B12/folate deficiency, myelodysplasia, liver disease', 'Reticulocyte count interpretation', 'Iron studies panel', 'Peripheral smear findings'],
    difficulty: 'foundational',
  },
  {
    id: 'tb-chest-pain',
    topic: 'Chest Pain Evaluation',
    system: 'Cardiovascular',
    prompt: 'Explain the systematic approach to evaluating a patient presenting with acute chest pain in the ED.',
    expectedConcepts: ['Life-threatening causes: ACS, PE, aortic dissection, tension pneumo, tamponade', 'ECG interpretation (STEMI criteria)', 'Troponin trending', 'HEART score for risk stratification', 'History features: quality, radiation, associated symptoms', 'When to go to cath lab'],
    difficulty: 'intermediate',
  },
  {
    id: 'tb-cirrhosis',
    topic: 'Cirrhosis Complications',
    system: 'GI/Hepatology',
    prompt: 'Teach a colleague about the major complications of cirrhosis and how to manage each one.',
    expectedConcepts: ['Ascites (diuretics, paracentesis, SBP prophylaxis)', 'Variceal bleeding (band ligation, octreotide, beta-blockers)', 'Hepatic encephalopathy (lactulose, rifaximin)', 'Hepatorenal syndrome', 'Child-Pugh and MELD scoring', 'Hepatocellular carcinoma screening'],
    difficulty: 'advanced',
  },
  {
    id: 'tb-asthma',
    topic: 'Asthma Stepwise Therapy',
    system: 'Pulmonary',
    prompt: 'Walk a first-year student through the stepwise approach to asthma management, including controller and rescue therapies.',
    expectedConcepts: ['Step 1: PRN SABA', 'Step 2: Low-dose ICS', 'Step 3: Low-dose ICS + LABA', 'Step 4: Medium-dose ICS + LABA', 'Step 5: High-dose ICS + LABA + add-on', 'Assessment of control (daytime symptoms, night waking, rescue use)'],
    difficulty: 'foundational',
  },
];

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const userId = context.auth.userId;
    const systemFilter = context.data?.system;

    try {
      // Find topics the student has demonstrated mastery of (stability > 30 days, reps ≥ 5)
      const masteredSystems = await prisma.userProgress.findMany({
        where: {
          userId,
          stability: { gte: 30 },
          reps: { gte: 5 },
        },
        select: {
          question: {
            select: {
              questionData: true,
            },
          },
        },
        take: 100,
      });

      // Extract systems the student has mastered
      const masteredSystemSet = new Set<string>();
      for (const progress of masteredSystems) {
        const qData = progress.question?.questionData as Record<string, unknown> | null;
        if (qData?.system && typeof qData.system === 'string') {
          masteredSystemSet.add(qData.system);
        }
      }

      // Filter topics: prefer mastered systems, fall back to all topics
      let eligible = TEACHBACK_TOPICS;
      if (systemFilter) {
        eligible = eligible.filter((t) => t.system === systemFilter);
      }

      const masteredTopics = eligible.filter((t) => masteredSystemSet.has(t.system));
      const pool = masteredTopics.length >= 3 ? masteredTopics : eligible;

      // Random selection from pool
      const selected = pool[Math.floor(Math.random() * pool.length)];

      return Response.json({
        data: {
          topic: selected,
          masteredSystems: Array.from(masteredSystemSet),
          totalTopicsAvailable: pool.length,
        },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
