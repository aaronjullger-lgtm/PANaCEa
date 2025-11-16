
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