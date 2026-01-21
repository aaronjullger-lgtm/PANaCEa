/**
 * Performance Record Types
 *
 * Defines types for tracking user performance across questions and sessions.
 */

// ============================================================================
// PERFORMANCE RECORD TYPES
// ============================================================================

/**
 * Individual question performance record
 * Used for tracking user performance on specific questions
 */
export interface PerformanceRecord {
  timestamp: number;
  system: string | null;
  subcategory: string | null;
  conditionId: string;
  condition: string;
  topic: string;
  isCorrect: boolean;
  focus: string;
  timeSpentMs?: number;
  answerChangedCount?: number;
  finalAnswerWasChanged?: boolean;
  questionType?: 'diagnosis' | 'management' | 'pharm' | 'other';
  errorTag?: 'knowledge_gap' | 'misread_question' | 'guessing';
  questionWordCount?: number;
}

/**
 * Session performance summary
 * Aggregated performance data for a study session
 */
export interface SessionPerformance {
  sessionId: string;
  startTime: string;
  endTime: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  timeSpentMs: number;
  bestStreak: number;
  systemsCovered: string[];
  mode: string;
  focus: string;
}

/**
 * System-level performance statistics
 * Used for score prediction and analytics
 */
export interface SystemPerformanceStats {
  system: string;
  accuracy: number;
  totalQuestions: number;
  questionsAttempted: number;
  trend: 'improving' | 'stable' | 'declining';
  lastPracticed?: Date | null;
  masteryLevel?: number;
  weight?: number;
}

/**
 * Performance trend data
 * Used for tracking progress over time
 */
export interface PerformanceTrend {
  date: string;
  accuracy: number;
  questionsAnswered: number;
  studyTimeMinutes: number;
  systemsPracticed: string[];
}