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

export interface ConditionData {
  condition: string;
  sections: ConditionSection;
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
