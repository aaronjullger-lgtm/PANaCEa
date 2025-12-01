export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  topic: string;
  /** PANCE system, mirrors topic but typed */
  system?: SystemCode;
  /** Mid-level category, e.g. "Arrhythmias", "Asthma / COPD" */
  subcategory?: string;
  /** Stable id from CONDITION_REGISTRY */
  conditionId: string;
  /** Human-readable condition name (usually from the registry) */
  condition: string;
  pearls: string[];
  repetitionLevel?: number;
  nextReviewDate?: string; // YYYY-MM-DD
  userNote?: string;
}

/** Error taxonomy for meta-cognition - helps users understand why they miss questions */
export type ErrorTag = 'knowledge_gap' | 'misread_question' | 'guessing';

export interface PerformanceRecord {
  timestamp: number;

  // What was shown
  system: SystemCode | null;   // e.g. "CV", "PULM"
  subcategory: string | null;  // e.g. "Arrhythmias", "Asthma"
  conditionId: string;         // from CONDITION_REGISTRY if present
  condition: string;           // human name from question.condition
  topic: string;               // your existing topic code/label

  // Result
  isCorrect: boolean;

  // Meta (so we can filter to PANCE-level ALL sessions)
  focus: SessionSettings["focus"];         // 'all' | 'growth' | ...
  difficulty: SessionSettings["difficulty"]; // 'easier' | 'same' | 'harder'

  // Deep Insight metrics (optional for backward compatibility)
  timeSpentMs?: number;            // Time spent on question in milliseconds
  answerChangedCount?: number;     // Number of times answer was changed before submission
  finalAnswerWasChanged?: boolean; // Whether the final answer differed from first selection
  questionType?: 'diagnosis' | 'management' | 'pharm' | 'other'; // Question classification
  
  // Error taxonomy for meta-cognition
  errorTag?: ErrorTag;             // User-tagged reason for incorrect answer
  questionWordCount?: number;      // Word count for vignette stamina analysis
}

export interface TopicStats {
  topic: string;
  score: number;
  correct: number;
  total: number;
}

export interface SessionSettings {
  focus: "all" | "growth" | "review" | "topic" | "reviewFlagged";
  difficulty: "easier" | "same" | "harder";
  topic?: string;

  /** Optional: when present, Gemini should target this specific condition */
  subcategoryName?: string;
}

// High-level systems (matches your existing tiles + PRO + hidden OTHER)
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
  | "OTHER"; // internal only, not shown in the heatmap

export interface ConditionDefinition {
  /** Stable internal id, e.g. "PULM__asthma__status_asthmaticus" */
  id: string;
  /** Blueprint system code – this is what your heatmap already uses */
  system: SystemCode;
  /** Mid-level bucketing (e.g. Coronary Artery Disease, Emergency, Pediatrics, Oncology…) */
  subcategory: string;
  /** Leaf-level condition name, e.g. "STEMI", "Pulmonary Embolism" */
  condition: string;
}
