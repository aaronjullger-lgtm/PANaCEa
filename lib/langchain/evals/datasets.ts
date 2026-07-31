/**
 * LangSmith Evaluation Datasets for PANaCEa Encounter Agents
 *
 * Provides structured evaluation data for measuring agent quality across:
 * - Clinical accuracy (medical content correctness)
 * - Grading consistency (score reproducibility)
 * - Feedback quality (usefulness of feedback)
 *
 * @module lib.langchain.evals.datasets
 */

import { HumanMessage } from '@langchain/core/messages';

// ─── Dataset Types ──────────────────────────────────────────────────────

export interface EvalExample {
  /** Unique identifier for this example */
  id: string;
  /** Human-readable description */
  description: string;
  /** Input messages for the agent */
  input: HumanMessage[];
  /** Expected output characteristics (for scoring) */
  expected: {
    /** Keywords that should appear in the output */
    keywords?: string[];
    /** Minimum output length (characters) */
    minLength?: number;
    /** Maximum output length (characters) */
    maxLength?: number;
    /** Expected output format */
    format?: 'json' | 'text' | 'markdown';
    /** Medical accuracy constraints */
    medicalConstraints?: string[];
  };
  /** Agent type this example tests */
  agentType: string;
  /** Difficulty level */
  difficulty: 'basic' | 'intermediate' | 'advanced';
  /** NCCPA blueprint organ system */
  organSystem?: string;
  /** Tags for filtering */
  tags: string[];
}

export interface EvalDataset {
  name: string;
  description: string;
  examples: EvalExample[];
}

// ─── Standardized Patient Examples ──────────────────────────────────────

export const standardizedPatientExamples: EvalDataset = {
  name: 'standardized-patient',
  description: 'Evaluation examples for the Standardized Patient agent',
  examples: [
    {
      id: 'sp-basic-chest-pain',
      description: 'Basic chest pain presentation — ACS workup',
      input: [
        new HumanMessage(
          'A 58-year-old male presents to the ED with substernal chest pain for 2 hours. Pain is pressure-like, radiates to left arm, associated with diaphoresis and nausea. History significant for hypertension, diabetes, and 30 pack-year smoking history. Vitals: BP 158/92, HR 98, RR 18, SpO2 96% on RA. On exam: diaphoretic, anxious, heart sounds normal, lungs clear bilaterally.'
        ),
      ],
      expected: {
        keywords: ['ACS', 'troponin', 'ECG', 'aspirin', 'nitroglycerin'],
        minLength: 200,
        format: 'text',
        medicalConstraints: [
          'Must mention ACS as primary concern',
          'Should include ECG and troponin in workup',
          'Should mention aspirin and nitroglycerin as initial management',
        ],
      },
      agentType: 'standardized-patient',
      difficulty: 'basic',
      organSystem: 'Cardiovascular',
      tags: ['chest-pain', 'ACS', 'ED', 'initial-workup'],
    },
    {
      id: 'sp-intermediate-dyspnea',
      description: 'Dyspnea with multiple differential diagnoses',
      input: [
        new HumanMessage(
          'A 67-year-old female presents with progressive dyspnea over 3 days. She has a history of COPD (FEV1 45% predicted), CHF (EF 35%), and type 2 diabetes. Current medications include albuterol, lisinopril, metformin, and furosemide. She reports she ran out of furosemide 5 days ago. Vitals: BP 142/88, HR 112, RR 24, SpO2 88% on RA. Exam: JVD, bilateral crackles extending to mid-lung fields, 2+ bilateral lower extremity edema.'
        ),
      ],
      expected: {
        keywords: ['CHF', 'COPD', 'pneumonia', 'BNP', 'chest X-ray', 'diuretics'],
        minLength: 300,
        format: 'text',
        medicalConstraints: [
          'Must consider CHF exacerbation as primary diagnosis',
          'Should mention COPD exacerbation as alternative',
          'Should include BNP, chest X-ray, and basic metabolic panel in workup',
          'Should mention restarting furosemide',
        ],
      },
      agentType: 'standardized-patient',
      difficulty: 'intermediate',
      organSystem: 'Pulmonary',
      tags: ['dyspnea', 'CHF', 'COPD', 'multi-differential'],
    },
    {
      id: 'sp-advanced-acute-abdomen',
      description: 'Complex acute abdomen with surgical emergency',
      input: [
        new HumanMessage(
          'A 42-year-old male presents with acute onset severe epigastric pain radiating to the back for 6 hours. Pain is 9/10, constant, and worse after eating. History significant for chronic alcohol use (2-3 drinks daily for 15 years), gallstones (known), and previous ERCP for bile duct stones. He reports nausea and vomiting (3 episodes). Vitals: BP 108/72, HR 118, RR 22, Temp 38.4°C, SpO2 95% on RA. Exam: epigastric tenderness with guarding, hypoactive bowel sounds, mild jaundice. Labs: WBC 14.2, lipase 2,800, bilirubin 3.8, ALP 280, ALT 180.'
        ),
      ],
      expected: {
        keywords: ['pancreatitis', 'gallstone', 'ERCP', 'CT abdomen', 'IV fluids', 'pain management'],
        minLength: 400,
        format: 'text',
        medicalConstraints: [
          'Must identify acute pancreatitis as primary diagnosis',
          'Should mention gallstone pancreatitis as etiology',
          'Should include CT abdomen in imaging',
          'Should mention IV fluids, pain management, and NPO status',
          'Should consider need for ERCP or cholecystectomy',
        ],
      },
      agentType: 'standardized-patient',
      difficulty: 'advanced',
      organSystem: 'Gastrointestinal',
      tags: ['acute-abdomen', 'pancreatitis', 'surgical-emergency', 'alcohol'],
    },
  ],
};

// ─── DDX Generator Examples ─────────────────────────────────────────────

export const ddxGeneratorExamples: EvalDataset = {
  name: 'ddx-generator',
  description: 'Evaluation examples for the Differential Diagnosis Generator',
  examples: [
    {
      id: 'ddx-headache',
      description: 'Headache differential diagnosis — red flag assessment',
      input: [
        new HumanMessage(
          'A 35-year-old female presents with severe headache for 2 days. Headache is throbbing, located in the right temporal region, associated with photophobia and phonophobia. She has had 3 similar episodes in the past year, each lasting 1-2 days. No fever, neck stiffness, or visual changes. Neurological exam is normal.'
        ),
      ],
      expected: {
        keywords: ['migraine', 'tension', 'cluster', 'red flags', 'neurological exam'],
        minLength: 250,
        format: 'text',
        medicalConstraints: [
          'Should list migraine as most likely diagnosis',
          'Should mention tension headache and cluster headache as differentials',
          'Should assess for red flags (fever, neck stiffness, focal deficits)',
          'Should mention neurological exam findings',
        ],
      },
      agentType: 'ddx-generator',
      difficulty: 'basic',
      organSystem: 'Neurological',
      tags: ['headache', 'migraine', 'red-flags', 'common-presentation'],
    },
    {
      id: 'ddx-fatigue',
      description: 'Fatigue differential — broad workup',
      input: [
        new HumanMessage(
          'A 28-year-old female presents with fatigue for 3 months. She reports difficulty sleeping, decreased energy, and poor concentration. She has gained 10 pounds over the past 3 months. History significant for anxiety and depression. Medications include sertraline 100mg daily. Vitals: BP 118/72, HR 62, BMI 28. Exam: dry skin, delayed relaxation of deep tendon reflexes.'
        ),
      ],
      expected: {
        keywords: ['hypothyroidism', 'depression', 'sleep apnea', 'TSH', 'CBC'],
        minLength: 300,
        format: 'text',
        medicalConstraints: [
          'Should list hypothyroidism as primary concern',
          'Should mention depression and sleep apnea as differentials',
          'Should include TSH, CBC, and metabolic panel in workup',
          'Should consider medication side effects',
        ],
      },
      agentType: 'ddx-generator',
      difficulty: 'intermediate',
      organSystem: 'Endocrine',
      tags: ['fatigue', 'hypothyroidism', 'depression', 'broad-differential'],
    },
  ],
};

// ─── SOAP Note Grader Examples ──────────────────────────────────────────

export const soapNoteGraderExamples: EvalDataset = {
  name: 'soap-note-grader',
  description: 'Evaluation examples for the SOAP Note Grader agent',
  examples: [
    {
      id: 'soap-diabetes',
      description: 'SOAP note for diabetes management visit',
      input: [
        new HumanMessage(
          `SOAP Note:

S: 55-year-old male with type 2 diabetes presents for routine follow-up. Reports checking blood glucose daily, fasting readings 140-180 mg/dL. Denies polyuria, polydipsia, vision changes, or numbness/tingling in feet. Current medications: metformin 1000mg BID, lisinopril 20mg daily. Reports adherent to medications and diet.

O: Vitals: BP 132/78, HR 72, BMI 29.2. Physical exam: feet warm, pulses 2+ bilaterally, monofilament testing normal. Labs (3 months ago): HbA1c 8.2%, fasting glucose 168, creatinine 0.9, eGFR >60.

A: Type 2 diabetes mellitus, suboptimally controlled (HbA1c 8.2%). Hypertension, controlled. No evidence of diabetic complications.

P: Continue metformin 1000mg BID. Add empagliflozin 10mg daily for cardiovascular and renal protection. Repeat HbA1c in 3 months. Annual eye exam due. Continue foot care education. Follow up in 3 months.`
        ),
      ],
      expected: {
        keywords: ['HbA1c', 'metformin', 'SGLT2', 'empagliflozin', 'complications'],
        minLength: 400,
        format: 'text',
        medicalConstraints: [
          'Should recognize HbA1c 8.2% as suboptimal control',
          'Should validate SGLT2 inhibitor addition for CV/renal protection',
          'Should mention retinopathy screening',
          'Should mention neuropathy screening',
          'Should assess for medication adherence barriers',
        ],
      },
      agentType: 'soap-note-grader',
      difficulty: 'intermediate',
      organSystem: 'Endocrine',
      tags: ['diabetes', 'SOAP', 'medication-management', 'complications-screening'],
    },
  ],
};

// ─── Feedback Summarizer Examples ───────────────────────────────────────

export const feedbackSummarizerExamples: EvalDataset = {
  name: 'feedback-summarizer',
  description: 'Evaluation examples for the Feedback Summarizer agent',
  examples: [
    {
      id: 'feedback-cardiology',
      description: 'Feedback for cardiology case performance',
      input: [
        new HumanMessage(
          `Student Performance Summary:

Case: 62-year-old male with acute MI
Student Answer: "STEMI, needs PCI within 90 minutes"
Correct Answer: "STEMI, needs primary PCI within 90 minutes (door-to-balloon time)"
Student Score: 85/100

Case: 45-year-old female with heart failure
Student Answer: "CHF, start ACE inhibitor and beta blocker"
Correct Answer: "HFrEF, start ACE inhibitor, beta blocker, and consider aldosterone antagonist"
Student Score: 72/100

Case: 70-year-old male with atrial fibrillation
Student Answer: "AFib with rapid ventricular rate, start rate control"
Correct Answer: "New-onset AFib, assess for stroke risk with CHA2DS2-VASc, consider rhythm vs rate control"
Student Score: 68/100

Overall: 75/100 (75th percentile)
Strengths: Good recognition of acute presentations
Weaknesses: Incomplete management plans, missing risk stratification`
        ),
      ],
      expected: {
        keywords: ['PCI', 'HFrEF', 'CHA2DS2-VASc', 'management', 'risk stratification'],
        minLength: 300,
        format: 'text',
        medicalConstraints: [
          'Should acknowledge correct STEMI recognition',
          'Should highlight incomplete management plans',
          'Should mention risk stratification gaps',
          'Should provide specific improvement recommendations',
        ],
      },
      agentType: 'feedback-summarizer',
      difficulty: 'basic',
      organSystem: 'Cardiovascular',
      tags: ['feedback', 'cardiology', 'performance-analysis', 'improvement'],
    },
  ],
};

// ─── Export All Datasets ────────────────────────────────────────────────

export const allEvalDatasets: EvalDataset[] = [
  standardizedPatientExamples,
  ddxGeneratorExamples,
  soapNoteGraderExamples,
  feedbackSummarizerExamples,
];

/**
 * Get all examples for a specific agent type
 */
export function getExamplesForAgent(agentType: string): EvalExample[] {
  return allEvalDatasets
    .filter((ds) => ds.name === agentType)
    .flatMap((ds) => ds.examples);
}

/**
 * Get all examples matching specific tags
 */
export function getExamplesByTag(...tags: string[]): EvalExample[] {
  return allEvalDatasets
    .flatMap((ds) => ds.examples)
    .filter((ex) => tags.some((t) => ex.tags.includes(t)));
}

/**
 * Get examples by difficulty level
 */
export function getExamplesByDifficulty(
  difficulty: EvalExample['difficulty']
): EvalExample[] {
  return allEvalDatasets
    .flatMap((ds) => ds.examples)
    .filter((ex) => ex.difficulty === difficulty);
}
