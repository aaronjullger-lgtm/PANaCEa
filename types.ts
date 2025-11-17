
export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  topic: string;
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
// High-level systems (matches your existing tiles + PRO + hidden OTHER)
export type SystemCode =
  | 'CV'
  | 'DERM'
  | 'ENDO'
  | 'GI'
  | 'GU'
  | 'HEME'
  | 'HEENT'
  | 'ID'
  | 'MSK'
  | 'NEURO'
  | 'PRO'
  | 'PSYCH'
  | 'PULM'
  | 'RENAL'
  | 'REPRO'
  | 'OTHER'; // internal only, not shown in the heatmap

export interface ConditionDefinition {
  /** Stable internal id, e.g. "PULM__asthma__status_asthmaticus" */
  id: string;
  /** Blueprint system code – this is what your heatmap already uses */
  system: SystemCode;
  /** Mid-level bucketing (e.g. Coronary Artery Disease, Emergency, Pediatrics, Oncology…) */
  subcategory: string;
  /** Leaf-level condition name, e.g. "STEMI", "Pulmonary Embolism" */
  condition: string;
  /** Where this came from in your notes (helps with debugging / reviewing) */
  sourceUnit: string;
}
