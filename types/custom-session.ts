/**
 * Custom Study Session Types
 *
 * Types for the Quizlet-style custom study session feature.
 * Key differences from regular FSRS-tracked sessions:
 * - No spaced repetition tracking
 * - Ephemeral (session state not persisted to database)
 * - Retry queue for missed questions
 * - Multi-select content filtering
 */

import type { SystemCode, Question } from './index';

/**
 * Focus areas for filtering questions by content type
 */
export type FocusArea =
  | 'anatomy' // Anatomy & physiology questions
  | 'pathophysiology' // Disease mechanisms, etiology
  | 'diagnosis' // Clinical presentation, workup, differential
  | 'pharmacology' // Drug therapy, mechanisms, side effects
  | 'management' // Treatment plans, follow-up
  | 'procedures'; // Procedures, special tests

/**
 * Configuration for a custom study session
 */
export interface CustomSessionConfig {
  /** Selected organ systems (multi-select) */
  systems: SystemCode[];

  /** Selected subcategories (filtered by selected systems) */
  subcategories: string[];

  /** Selected specific conditions (optional, for ultra-focused sessions) */
  conditions: string[];

  /** Content focus areas to include */
  focusAreas: FocusArea[];

  /** Number of questions per increment before retry phase */
  questionsPerIncrement: number;

  /** Question difficulty */
  difficulty: 'easier' | 'same' | 'harder';

  /** Whether to retry missed questions at end of increment */
  retryMissedQuestions: boolean;

  /** Include user-uploaded material questions (BYON) */
  includeUserMaterials?: boolean;

  /** Specific user material IDs to include */
  userMaterialIds?: string[];
}

/**
 * Runtime state for a custom study session
 */
export interface CustomSessionState {
  /** Session configuration */
  config: CustomSessionConfig;

  /** Current increment number (starts at 1) */
  currentIncrement: number;

  /** Total questions answered in session */
  questionsAnswered: number;

  /** Total correct answers */
  correctCount: number;

  /** Questions missed during current increment (to retry) */
  retryQueue: Question[];

  /** Questions for the current increment */
  currentQuestions: Question[];

  /** Index of current question in currentQuestions */
  currentQuestionIndex: number;

  /** Whether we're in the retry phase */
  isRetryPhase: boolean;

  /** Timestamp when session started */
  startedAt: string;

  /** Track which questions have been answered with their results */
  answeredQuestions: AnsweredQuestion[];
}

/**
 * Represents an answered question with result
 */
export interface AnsweredQuestion {
  questionId: string;
  question: Question;
  isCorrect: boolean;
  selectedAnswer: string;
  timeSpentMs: number;
  isRetry: boolean;
}

/**
 * Summary statistics for a completed session
 */
export interface CustomSessionSummary {
  /** Total questions answered (including retries) */
  totalAnswered: number;

  /** Questions correct on first attempt */
  correctFirstAttempt: number;

  /** Questions correct on retry */
  correctOnRetry: number;

  /** Total time spent in session */
  totalTimeMs: number;

  /** Average time per question */
  avgTimePerQuestion: number;

  /** Accuracy percentage (first attempt) */
  firstAttemptAccuracy: number;

  /** Accuracy percentage (overall including retries) */
  overallAccuracy: number;

  /** Performance by system */
  systemBreakdown: SystemBreakdown[];

  /** Performance by focus area */
  focusAreaBreakdown: FocusAreaBreakdown[];

  /** Weak areas identified (topics with <70% accuracy) */
  weakAreas: string[];

  /** Strong areas identified (topics with >90% accuracy) */
  strongAreas: string[];
}

/**
 * Performance breakdown by system
 */
export interface SystemBreakdown {
  system: SystemCode;
  systemName: string;
  total: number;
  correct: number;
  accuracy: number;
}

/**
 * Performance breakdown by focus area
 */
export interface FocusAreaBreakdown {
  focusArea: FocusArea;
  total: number;
  correct: number;
  accuracy: number;
}

/**
 * Available content for the session builder UI
 */
export interface AvailableContent {
  /** Systems with their subcategories and conditions */
  systems: SystemWithContent[];

  /** User's uploaded materials (if any) */
  userMaterials: UserMaterialSummary[];
}

/**
 * System with its available subcategories and conditions
 */
export interface SystemWithContent {
  code: SystemCode;
  name: string;
  subcategories: SubcategoryWithContent[];
  totalConditions: number;
}

/**
 * Subcategory with its available conditions
 */
export interface SubcategoryWithContent {
  name: string;
  conditions: ConditionSummary[];
}

/**
 * Brief condition info for selection UI
 */
export interface ConditionSummary {
  id: string;
  name: string;
  hasQuestions: boolean;
}

/**
 * User uploaded material summary for selection
 */
export interface UserMaterialSummary {
  id: string;
  title: string;
  questionCount: number;
  expiresAt: string;
}

/**
 * Request body for generating custom session questions
 */
export interface GenerateCustomSessionRequest {
  config: CustomSessionConfig;
  /** Number of questions to generate */
  count: number;
}

/**
 * Response from custom session question generation
 */
export interface GenerateCustomSessionResponse {
  questions: Question[];
  /** Total available questions matching filters (may be more than requested) */
  totalAvailable: number;
  /** Warning if requested count exceeds available */
  warning?: string;
}

// ============================================================================
// BYON (Bring Your Own Notes) Types
// ============================================================================

/**
 * Supported file types for upload
 */
export type SupportedFileType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'png' | 'jpg' | 'jpeg';

/**
 * User uploaded material
 */
export interface UserUploadedMaterial {
  id: string;
  userId: string;
  title: string;
  fileType: SupportedFileType;
  fileSize: number;
  storageKey: string;
  extractedText?: string;
  createdAt: string;
  expiresAt: string;
  questionCount: number;
}

/**
 * Question generated from user material
 */
export interface UserGeneratedQuestion {
  id: string;
  materialId: string;
  question: string;
  options: string[];
  correctIndex: number;
  rationale?: string;
  focusArea?: FocusArea;
  createdAt: string;
}

/**
 * Request to generate questions from uploaded material
 */
export interface GenerateFromMaterialRequest {
  materialId: string;
  /** Number of questions to generate */
  count: number;
  /** Focus areas to target */
  focusAreas?: FocusArea[];
  /** Difficulty level */
  difficulty?: 'easier' | 'same' | 'harder';
}

/**
 * Upload material request
 */
export interface UploadMaterialRequest {
  title: string;
  file: File;
}

/**
 * Upload material response
 */
export interface UploadMaterialResponse {
  material: UserUploadedMaterial;
  extractedTextPreview: string;
  estimatedQuestions: number;
}

// ============================================================================
// Focus Area Metadata
// ============================================================================

/**
 * Display metadata for focus areas
 */
export const FOCUS_AREA_META: Record<
  FocusArea,
  { label: string; description: string; icon: string }
> = {
  anatomy: {
    label: 'Anatomy & Physiology',
    description: 'Structure and normal function',
    icon: '🦴',
  },
  pathophysiology: {
    label: 'Pathophysiology',
    description: 'Disease mechanisms and etiology',
    icon: '🔬',
  },
  diagnosis: {
    label: 'Diagnosis',
    description: 'Clinical presentation and workup',
    icon: '🩺',
  },
  pharmacology: {
    label: 'Pharmacology',
    description: 'Drug therapy and mechanisms',
    icon: '💊',
  },
  management: {
    label: 'Management',
    description: 'Treatment plans and follow-up',
    icon: '📋',
  },
  procedures: {
    label: 'Procedures & Tests',
    description: 'Special tests and procedures',
    icon: '🔧',
  },
};

/**
 * Default session configuration
 */
export const DEFAULT_CUSTOM_SESSION_CONFIG: CustomSessionConfig = {
  systems: [],
  subcategories: [],
  conditions: [],
  focusAreas: ['diagnosis', 'pharmacology', 'management'],
  questionsPerIncrement: 10,
  difficulty: 'same',
  retryMissedQuestions: true,
  includeUserMaterials: false,
  userMaterialIds: [],
};

/**
 * Storage key for custom session state in localStorage
 */
export const CUSTOM_SESSION_STORAGE_KEY = 'panceai_custom_session_state';
