/**
 * Type definitions for the three new Mini-Mode drills:
 * 1. Fluid & Electrolyte Mode (Hydro-Mode)
 * 2. Antibiotic Mode (Bug-Drug Mastery)
 * 3. Patient Encounter Simulation (Virtual OSCE)
 */

// ===== FLUID & ELECTROLYTE MODE =====

export interface UrineChemistryReference {
  parameter: string;
  normalRange: string;
  unit: string;
  interpretation?: string;
}

export interface FluidElectrolyteCase {
  id: string;
  title: string;
  vignette: string;
  labs: {
    bmp?: {
      sodium: number;
      potassium: number;
      chloride: number;
      bicarbonate: number;
      bun: number;
      creatinine: number;
      glucose: number;
    };
    urineNa?: number;
    urineCr?: number;
    urineOsmolality?: number;
    serumOsmolality?: number;
    additionalLabs?: Record<string, number | string>;
  };
  question: string;
  correctAnswer: number;
  unit: string;
  marginOfError: number; // Acceptable deviation (e.g., ±5 for FENa)
  explanation: string;
  calculationHint?: string;
  category: 'fena' | 'maintenance_fluids' | 'osmolar_gap' | 'anion_gap' | 'free_water_deficit' | 'other';
}

export interface UrineChemistryData {
  reference: UrineChemistryReference[];
}

// ===== ANTIBIOTIC MODE =====

export type AntibioticDrillType = 'coverage' | 'mechanism' | 'side_effects' | 'empiric_choice';

export interface OrganismInfection {
  id: string;
  name: string;
  category: 'gram_positive' | 'gram_negative' | 'fungal' | 'atypical' | 'viral' | 'parasitic';
  description?: string;
}

export interface AntibioticDrug {
  id: string;
  name: string;
  class: string;
  description?: string;
}

export interface AntibioticDrillQuestion {
  id: string;
  type: AntibioticDrillType;
  
  // For 'coverage' type
  organism?: OrganismInfection;
  correctDrugs?: string[]; // IDs of correct drug matches
  
  // For 'mechanism' type
  drug?: AntibioticDrug;
  mechanismQuestion?: string;
  mechanismChoices?: string[];
  correctMechanismIndex?: number;
  
  // For 'side_effects' type
  sideEffectQuestion?: string;
  sideEffectChoices?: string[];
  correctSideEffectIndex?: number;
  
  // For 'empiric_choice' type
  clinicalScenario?: string;
  empiricChoices?: string[];
  correctEmpiricIndex?: number;
  
  explanation: string;
  pearls?: string[];
}

export interface AntibioticMatchPair {
  organismId: string;
  drugId: string;
}

// ===== PATIENT ENCOUNTER SIMULATION =====

export type QuestionCategory = 'history' | 'physical' | 'labs' | 'other';
export type QuestionRelevance = 'essential' | 'helpful' | 'unnecessary' | 'redundant';

// Persona used by the Patient Encounter Simulation engine
export type PatientPersonality =
  | 'Anxious'
  | 'Stoic'
  | 'Confused'
  | 'Hostile'
  | 'Pleasant';

export interface PatientPersona {
  id: string;
  demographics: {
    name: string;
    age: number;
    gender: string;
  };
  chiefComplaint: string;
  /**
   * Core HPI narrative used as context for the AI patient.
   * This should describe the story in 2-5 sentences.
   */
  history: string;
  vitals: {
    hr: number;
    bp: string;
    temp: number;
    rr: number;
    o2: number;
  };
  personality: PatientPersonality;
  /**
   * Ground-truth diagnosis for grading and internal consistency.
   * MUST never be shown directly to the learner.
   */
  secretDiagnosis: string;
  /**
   * High-yield findings the learner should uncover (e.g., "Pleuritic chest pain",
   * "Recent long-haul flight", "Sudden onset dyspnea").
   */
  criticalCues: string[];
}

export interface PatientEncounterCase {
  id: string;
  patientName: string;
  chiefComplaint: string;
  age: number;
  sex: 'M' | 'F' | 'Other';
  
  // Pre-revealed information
  vitalSigns: {
    bp: string;
    hr: number;
    rr: number;
    temp: number;
    o2sat: number;
  };
  
  // Hidden information that's revealed based on questions
  historyData: Record<string, string>;
  physicalExamData: Record<string, string>;
  labData: Record<string, string>;
  
  // Question evaluation criteria
  essentialQuestions: string[]; // Keywords for must-ask questions
  helpfulQuestions: string[]; // Keywords for useful questions
  unnecessaryQuestions: string[]; // Keywords for wasteful questions
  
  // Scoring
  correctDiagnosis: string;
  differentialDiagnoses: string[];
  
  // Feedback
  idealWorkup: string[];
  teachingPoints: string[];
}

export interface PatientQuestion {
  questionText: string;
  category: QuestionCategory;
  relevance: QuestionRelevance;
  response: string;
  timestamp: number;
}

export interface EncounterSession {
  id?: string; // Database session ID
  caseId: string;
  questions: PatientQuestion[];
  startTime: number;
  endTime?: number;
  score?: {
    efficiency: number;
    thoroughness: number;
    overall: number;
  };
}

// ===== VENTILATOR HERO SIMULATOR =====

export interface VentilatorSettings {
  tidalVolume: number; // mL
  respiratoryRate: number; // breaths/min
  peep: number; // cmH2O
  fio2: number; // percentage (21-100)
}

export interface VentilatorCase {
  id: string;
  title: string;
  patientInfo: string;
  initialLabs: {
    ph: number;
    pco2: number;
    po2: number;
    hco3: number;
    lactate?: number;
  };
  currentSettings: VentilatorSettings;
  targetGoals: {
    ph?: { min: number; max: number };
    po2?: { min: number; max: number };
    pco2?: { min: number; max: number };
  };
  condition: 'ards' | 'copd' | 'asthma' | 'pneumonia' | 'other';
  explanation: string;
  teachingPoints: string[];
}

export interface VentilatorAttempt {
  settings: VentilatorSettings;
  outcome: {
    ph: number;
    pco2: number;
    po2: number;
    success: boolean;
    feedback: string;
  };
  timestamp: number;
}

// ===== POLYPHARMACY PUZZLE =====

export interface Medication {
  id: string;
  name: string;
  indication: string;
  class: string;
  sideEffects?: string[];
  interactions?: string[];
}

export interface PolypharmacyCase {
  id: string;
  patientInfo: string;
  age: number;
  medications: Medication[];
  clinicalConcern: string; // e.g., "Fall risk", "QT prolongation"
  correctMedicationsToStop: string[]; // Medication IDs
  explanation: string;
  deprescribingRationale: Record<string, string>; // medId -> reason
  teachingPoints: string[];
}

export interface PolypharmacyAttempt {
  caseId: string;
  selectedMedications: string[];
  correct: boolean;
  partialCredit?: number; // 0-100
  feedback: string;
  timestamp: number;
}

// ===== CONDITION DRILL =====

/**
 * Question types for the Condition Drill mode.
 * Used to categorize questions by clinical focus.
 */
export type ConditionQuestionType = 
  | 'presentation'
  | 'diagnosis'
  | 'treatment'
  | 'etiology'
  | 'complication';

/**
 * Structure for condition drill questions fetched from the database.
 */
export interface ConditionQuestion {
  id: string;
  type: ConditionQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  conditionName: string;
  system: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

