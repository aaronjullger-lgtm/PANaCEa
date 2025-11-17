
export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  topic: string;
  system?: SystemCode;        // usually same as topic (CV, PULM, etc.)
  subcategory?: string;       // e.g. "Emergency", "Arrhythmias"
  conditionId?: string;       // id from CONDITION_REGISTRY
  condition: string;
  pearls: string[];
  repetitionLevel?: number;
  nextReviewDate?: string; // YYYY-MM-DD
  userNote?: string;
}

export interface PerformanceRecord {
  timestamp: number;
  topic: string;
  isCorrect: boolean;
  question: string;
}

export interface TopicStats {
  topic: string;
  score: number;
  correct: number;
  total: number;
}

export interface SessionSettings {
  focus: 'all' | 'growth' | 'review' | 'topic' | 'reviewFlagged';
  difficulty: 'easier' | 'same' | 'harder';
  topic?: string;
}
// ---- System codes (PANCE categories) ----
export type SystemCode =
  | "CV"
  | "DERM"
  | "ENDO"
  | "GI"
  | "GU"
  | "HEME"
  | "HEENT"
  | "ID"
  | "MSK"
  | "NEURO"
  | "PRO"
  | "PSYCH"
  | "PULM"
  | "RENAL"
  | "REPRO"
  | "OTHER";

// ---- ConditionDefinition ----
// Clean, minimal, no sourceUnit
export interface ConditionDefinition {
  /** Stable internal id, e.g. "PULM__asthma__status_asthmaticus" */
  id: string;

  /** Blueprint system code */
  system: SystemCode;

  /** Mid-level bucket (e.g. Arrhythmias, Pneumonia, Coronary Disease) */
  subcategory: string;

  /** Leaf-level name, e.g. "STEMI", "Asthma Exacerbation" */
  condition: string;

  /** Optional pearls (later you can auto-fill these per condition) */
  corePearls?: string[];
}
