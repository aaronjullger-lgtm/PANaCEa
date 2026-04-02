/**
 * PA Curriculum Knowledge Base
 *
 * Structured data representing the PA education journey: didactic courses,
 * clinical rotations, milestone exams, and licensure steps.
 *
 * Used by:
 * - Session service for rotation-aware question selection
 * - Dashboard for rotation focus cards
 * - FSRS scheduler for phase-aware scheduling
 * - Study nudges for contextual suggestions
 */

export type PAPhase = 'didactic' | 'clinical' | 'pance_prep';

export interface DidacticCourse {
  name: string;
  systems: string[];
  semester: number;
  description?: string;
}

export interface ClinicalRotation {
  name: string;
  weeks: number;
  systems: string[];
  required: boolean;
  /** Common high-yield conditions for this rotation */
  highYieldConditions?: string[];
  /** Typical EOR exam topics */
  eorFocus?: string[];
}

export interface Milestone {
  name: string;
  abbreviation: string;
  description: string;
  timing: string;
  /** Approximate score needed to pass */
  passingInfo?: string;
}

export const PA_CURRICULUM = {
  /**
   * Typical PA didactic year course structure.
   * Systems mapped to NCCPA abbreviations.
   */
  didacticCourses: [
    { name: 'Clinical Anatomy', systems: ['MSK', 'NEURO', 'CV'], semester: 1,
      description: 'Gross anatomy, neuroanatomy, musculoskeletal system' },
    { name: 'Physiology', systems: ['CV', 'PULM', 'RENAL', 'ENDO', 'GI', 'NEURO'], semester: 1,
      description: 'Organ system physiology and homeostasis' },
    { name: 'Pharmacology', systems: ['CV', 'PULM', 'ID', 'ENDO', 'PSYCH', 'NEURO', 'GI'], semester: 1,
      description: 'Drug mechanisms, interactions, side effects, and prescribing' },
    { name: 'Pathophysiology', systems: ['CV', 'PULM', 'GI', 'RENAL', 'ENDO', 'HEME', 'ID'], semester: 1,
      description: 'Disease mechanisms and pathological processes' },
    { name: 'Clinical Medicine I', systems: ['CV', 'PULM', 'GI'], semester: 2,
      description: 'Cardiology, pulmonology, gastroenterology clinical presentations' },
    { name: 'Clinical Medicine II', systems: ['NEURO', 'MSK', 'DERM', 'PSYCH'], semester: 2,
      description: 'Neurology, orthopedics, dermatology, psychiatry' },
    { name: 'Clinical Medicine III', systems: ['ENDO', 'HEME', 'RENAL', 'GU', 'REPRO'], semester: 3,
      description: 'Endocrine, hematology, renal, urology, reproductive' },
    { name: 'Emergency Medicine Didactic', systems: ['CV', 'PULM', 'NEURO', 'EMERGENCY'], semester: 3,
      description: 'Acute presentations, trauma, resuscitation' },
    { name: 'Pediatric Medicine', systems: ['ID', 'PULM', 'GI', 'DERM'], semester: 3,
      description: 'Pediatric-specific presentations and management' },
    { name: 'Behavioral Medicine', systems: ['PSYCH'], semester: 2,
      description: 'Psychiatric disorders, behavioral health, counseling' },
    { name: 'Clinical Skills & Procedures', systems: ['MSK', 'CV', 'PULM'], semester: 1,
      description: 'Physical exam, suturing, splinting, joint injection, I&D' },
    { name: 'Evidence-Based Medicine', systems: [], semester: 2,
      description: 'Research methodology, biostatistics, clinical decision-making' },
  ] as DidacticCourse[],

  /**
   * Standard PA clinical rotations per ARC-PA requirements.
   * All required rotations must be completed before graduation.
   */
  clinicalRotations: [
    {
      name: 'Internal Medicine',
      weeks: 6,
      systems: ['CV', 'PULM', 'GI', 'ENDO', 'RENAL', 'HEME', 'ID'],
      required: true,
      highYieldConditions: ['CHF', 'COPD', 'DKA', 'ACS', 'Pneumonia', 'Cirrhosis', 'CKD', 'DVT/PE', 'Anemia'],
      eorFocus: ['Inpatient management', 'Chronic disease management', 'Lab interpretation', 'Medication adjustment'],
    },
    {
      name: 'Family Medicine',
      weeks: 6,
      systems: ['CV', 'PULM', 'GI', 'MSK', 'ENDO', 'DERM', 'PSYCH', 'HEENT', 'GU', 'REPRO'],
      required: true,
      highYieldConditions: ['Hypertension', 'Diabetes mellitus', 'Hyperlipidemia', 'Depression', 'Otitis media', 'UTI', 'Low back pain', 'Osteoarthritis'],
      eorFocus: ['Preventive care', 'Chronic disease screening', 'Patient education', 'Outpatient prescribing'],
    },
    {
      name: 'Emergency Medicine',
      weeks: 4,
      systems: ['CV', 'PULM', 'NEURO', 'MSK', 'EMERGENCY', 'GI'],
      required: true,
      highYieldConditions: ['STEMI', 'Stroke', 'Trauma', 'PE', 'Appendicitis', 'Anaphylaxis', 'Pneumothorax', 'Sepsis'],
      eorFocus: ['Acute stabilization', 'Triage', 'Trauma assessment', 'Critical care decisions'],
    },
    {
      name: 'General Surgery',
      weeks: 6,
      systems: ['GI', 'MSK', 'CV'],
      required: true,
      highYieldConditions: ['Appendicitis', 'Cholecystitis', 'Bowel obstruction', 'Hernia', 'Breast mass', 'Trauma'],
      eorFocus: ['Pre-op evaluation', 'Post-op complications', 'Wound management', 'Surgical indications'],
    },
    {
      name: 'Pediatrics',
      weeks: 4,
      systems: ['ID', 'PULM', 'GI', 'DERM', 'HEENT'],
      required: true,
      highYieldConditions: ['Asthma exacerbation', 'Otitis media', 'Croup', 'Bronchiolitis', 'Febrile seizure', 'Gastroenteritis'],
      eorFocus: ['Growth and development', 'Vaccination schedule', 'Pediatric dosing', 'Age-specific vitals'],
    },
    {
      name: 'Behavioral Health / Psychiatry',
      weeks: 4,
      systems: ['PSYCH'],
      required: true,
      highYieldConditions: ['MDD', 'Generalized anxiety', 'Bipolar disorder', 'Schizophrenia', 'PTSD', 'Substance use disorder', 'ADHD'],
      eorFocus: ['DSM-5 criteria', 'Psychopharmacology', 'Suicide risk assessment', 'Therapeutic communication'],
    },
    {
      name: "Women's Health / OB-GYN",
      weeks: 4,
      systems: ['REPRO'],
      required: true,
      highYieldConditions: ['Ectopic pregnancy', 'Preeclampsia', 'PCOS', 'Endometriosis', 'Cervical cancer screening', 'Contraception'],
      eorFocus: ['Prenatal care', 'Labor and delivery', 'Gynecologic screening', 'Contraceptive counseling'],
    },
    // Common electives
    {
      name: 'Orthopedics',
      weeks: 4,
      systems: ['MSK'],
      required: false,
      highYieldConditions: ['ACL tear', 'Rotator cuff tear', 'Hip fracture', 'Carpal tunnel', 'Compartment syndrome'],
    },
    {
      name: 'Dermatology',
      weeks: 4,
      systems: ['DERM'],
      required: false,
      highYieldConditions: ['Melanoma', 'Basal cell carcinoma', 'Psoriasis', 'Eczema', 'Contact dermatitis', 'Cellulitis'],
    },
    {
      name: 'Cardiology',
      weeks: 4,
      systems: ['CV'],
      required: false,
      highYieldConditions: ['Heart failure', 'Atrial fibrillation', 'Valvular disease', 'Aortic dissection', 'Endocarditis'],
    },
  ] as ClinicalRotation[],

  /**
   * Key milestone exams in PA education
   */
  milestones: {
    packrat: {
      name: 'PAEA PACKRAT',
      abbreviation: 'PACKRAT',
      description: 'Physician Assistant Education Association practice exam (300 questions)',
      timing: 'End of didactic year or mid-clinical year',
      passingInfo: 'No official pass/fail; scores predict PANCE readiness (>140 correlates with PANCE pass)',
    },
    eoc: {
      name: 'End of Curriculum Exam',
      abbreviation: 'EOC',
      description: 'Program-level summative exam covering all clinical content',
      timing: 'Final 4 months of program, before graduation',
      passingInfo: 'Program-specific passing threshold',
    },
    osce: {
      name: 'Objective Structured Clinical Examination',
      abbreviation: 'OSCE',
      description: 'Standardized patient encounters assessing clinical skills, H&P, clinical reasoning',
      timing: 'Throughout clinical year and before graduation, per ARC-PA standards',
      passingInfo: 'Station-based scoring; must demonstrate competency across clinical domains',
    },
    eor: {
      name: 'End of Rotation Exam',
      abbreviation: 'EOR',
      description: 'PAEA standardized exam at the end of each clinical rotation',
      timing: 'End of each required rotation',
      passingInfo: 'Program-specific passing threshold; scaled scores',
    },
    pance: {
      name: 'Physician Assistant National Certifying Exam',
      abbreviation: 'PANCE',
      description: '300-question, 5-block national certification exam',
      timing: 'After graduation, before practice',
      passingInfo: '300+ out of 800 scaled score to pass (NCCPA)',
    },
  } as Record<string, Milestone>,

  /**
   * PA licensure and certification pathway
   */
  licensure: {
    steps: [
      'Graduate from an ARC-PA accredited PA program',
      'Pass the PANCE (300+ out of 800 scaled score)',
      'Apply for state license through your state medical board',
      'Obtain DEA number for prescriptive authority (state-dependent)',
      'Maintain certification: PANRE every 10 years + 100 CME hours per 2-year cycle',
      'Complete at least 1 PI-CME (performance improvement) activity per cycle',
    ],
    supervisoryModels: [
      'Collaborative practice (most states trending toward this)',
      'Supervisory agreement with physician (traditional model)',
      'Optimal team practice (AAPA advocacy model — no mandated supervision)',
    ],
  },

  /**
   * Common struggles PA students face (for empathetic nudges and wellness features)
   */
  commonStruggles: {
    didactic: [
      'Information overload — volume of material across all organ systems simultaneously',
      'Pharmacology retention — memorizing drug classes, mechanisms, interactions',
      'Anatomy lab time pressure — limited lab hours for complex dissection',
      'Transition from undergraduate to graduate-level clinical thinking',
      'Imposter syndrome — comparing to medical students or classmates',
    ],
    clinical: [
      'Rotation adjustment — new specialty every 4-6 weeks',
      'EOR exam prep while managing patient care responsibilities',
      'Preceptor variability — different teaching styles and expectations',
      'Clinical documentation speed (SOAP notes, H&Ps)',
      'Work-life balance during long clinical hours',
      'Knowledge application gap — didactic knowledge vs. real patient care',
    ],
    pancePrep: [
      'Content breadth — 300 questions across 15 organ systems',
      'Identifying and closing knowledge gaps efficiently',
      'Test anxiety and performance pressure',
      'Maintaining clinical skills while studying for boards',
      'Burnout from extended study periods',
    ],
  },
} as const;

/**
 * Get rotation by name (case-insensitive, partial match)
 */
export function findRotation(name: string): ClinicalRotation | undefined {
  const lower = name.toLowerCase();
  return PA_CURRICULUM.clinicalRotations.find(
    r => r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase())
  );
}

/**
 * Get systems relevant to a rotation
 */
export function getRotationSystems(rotationName: string): string[] {
  const rotation = findRotation(rotationName);
  return rotation ? [...rotation.systems] : [];
}

/**
 * Get high-yield conditions for a rotation
 */
export function getRotationHighYield(rotationName: string): string[] {
  const rotation = findRotation(rotationName);
  return rotation?.highYieldConditions ?? [];
}

/**
 * Determine learner phase from year in program
 */
export function inferPhase(yearInProgram: number, hasExamDate?: boolean): PAPhase {
  if (hasExamDate) return 'pance_prep';
  if (yearInProgram >= 2) return 'clinical';
  return 'didactic';
}

/**
 * Get milestone exam info
 */
export function getMilestoneInfo(abbreviation: string): Milestone | undefined {
  const key = abbreviation.toLowerCase();
  return PA_CURRICULUM.milestones[key];
}
