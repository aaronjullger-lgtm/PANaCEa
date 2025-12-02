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
  caseId: string;
  questions: PatientQuestion[];
  startTime: number;
  endTime?: number;
  diagnosis?: string;
  score?: {
    efficiency: number; // 0-100, based on unnecessary questions
    thoroughness: number; // 0-100, based on essential questions asked
    overall: number;
  };
}
