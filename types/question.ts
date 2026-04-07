export type QuestionType = 'mcq' | 'vignette' | 'recall';

export interface ConditionSection {
  overview?: string;
  etiology?: string;
  epidemiology?: string;
  clinicalPresentation?: string;
  physicalExam?: string;
  diagnostics?: string;
  treatment?: string;
  management?: string;
  complications?: string;
  prognosis?: string;
  [key: string]: string | undefined;
}

/** High-yield PANCE-specific anchors from curated MedicalContent fields. */
export interface PanceAnchors {
  classicPatient?: string;
  classicTriad?: string[];
  firstLineRx?: string;
  goldStandardDx?: string;
  bestInitialTest?: string;
}

export interface ConditionData {
  condition: string;
  sections: ConditionSection;
  /** PANCE-specific anchors — inject into prompt to improve distractor quality */
  panceAnchors?: PanceAnchors;
}

export interface QuestionExplanation {
  rationale: string;
  incorrect?: {
    [key: string]: string; // A, B, C, D
  };
}

export interface GeneratedQuestion {
  id: string;
  conditionId: string; // slug or name
  type: QuestionType;
  question: string;
  options?: string[]; // Only for MCQ/Vignette
  correctAnswer: string; // For recall, this is the model answer
  explanation: QuestionExplanation;
  difficulty: number; // 0.0 to 1.0
  sourceSections: string[]; // keys from ConditionSection
}
