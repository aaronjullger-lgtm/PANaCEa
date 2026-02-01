/**
 * @deprecated This file is being consolidated into src/types/index.ts
 * New code should import from 'src/types' instead of './types'
 *
 * Note: This file is still widely used throughout the codebase.
 * Migration is planned but not yet implemented.
 */

export interface Question {
  id?: string; // Unique identifier for SRS tracking
  /** Optional vignette text for long-form stems */
  vignette?: string;
  question: string;
  options: string[];
  /** Alias for options (for backwards compatibility) */
  answers?: string[];
  correctAnswerIndex: number;
  /** Alias for correctAnswerIndex (for backwards compatibility) */
  correctIndex?: number;
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
  /** Question difficulty level */
  difficulty?: 'easy' | 'medium' | 'hard';
  pearls: string[];
  repetitionLevel?: number;
  nextReviewDate?: string; // YYYY-MM-DD
  userNote?: string;
  /** Bookmarked for quick reference */
  isBookmarked?: boolean;
  /** Timestamp when bookmarked */
  bookmarkedAt?: number;
  /** Optional tags for organization */
  tags?: string[];
  lastReviewedAt?: string; // ISO timestamp
  /** Source of the question (pool, database, ai_fallback) */
  source?: string;
  /** True when question is from staging lake (beta/peer review) */
  fromStaging?: boolean;
  /** Optional image/ECG/imaging URL for multi-modal questions */
  imageUrl?: string;
}

/** Error taxonomy for meta-cognition - helps users understand why they miss questions */
export type ErrorTag = 'knowledge_gap' | 'misread_question' | 'guessing';

export interface PerformanceRecord {
  timestamp: number;

  // What was shown
  system: SystemCode | null; // e.g. "CV", "PULM"
  subcategory: string | null; // e.g. "Arrhythmias", "Asthma"
  conditionId: string; // from CONDITION_REGISTRY if present
  condition: string; // human name from question.condition
  topic: string; // your existing topic code/label

  // Result
  isCorrect: boolean;

  // Meta (so we can filter to PANCE-level ALL sessions)
  focus: SessionSettings['focus']; // 'all' | 'growth' | ...

  // Deep Insight metrics (optional for backward compatibility)
  timeSpentMs?: number; // Time spent on question in milliseconds
  answerChangedCount?: number; // Number of times answer was changed before submission
  finalAnswerWasChanged?: boolean; // Whether the final answer differed from first selection
  questionType?: 'diagnosis' | 'management' | 'pharm' | 'other'; // Question classification

  // Error taxonomy for meta-cognition
  errorTag?: ErrorTag; // User-tagged reason for incorrect answer
  questionWordCount?: number; // Word count for vignette stamina analysis
}

export interface TopicStats {
  topic: string;
  score: number;
  correct: number;
  total: number;
}

export interface SessionSettings {
  mode?: 'standard' | 'diagnostic' | 'photo' | 'anatomy' | 'quick-review' | 'custom';
  focus:
    | 'all'
    | 'growth'
    | 'review'
    | 'topic'
    | 'reviewFlagged'
    | 'unseen'
    | 'incorrect'
    | 'bookmarked';
  topic?: string;
  count?: number;
  systems?: string[];

  /** Optional: when present, Gemini should target this specific condition */
  subcategoryName?: string;

  /** Optional: when present, Gemini should target this specific condition ID or name */
  conditionName?: string;
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
}

// User profile and onboarding types
export type YearInProgram =
  | 'Didactic Year 1'
  | 'Didactic Year 2'
  | 'Clinical Year'
  | 'Graduated'
  | 'Post-Graduate'
  | 'Preparing for PANCE';

export type ClinicalRotation =
  | 'Emergency Medicine'
  | 'Family Medicine'
  | 'Internal Medicine'
  | 'Surgery'
  | 'Pediatrics'
  | 'Psychiatry'
  | 'Obstetrics & Gynecology'
  | 'Cardiology'
  | 'Orthopedics'
  | 'Dermatology'
  | 'Neurology'
  | 'Other';

export interface UserProfile {
  school?: string;
  graduationDate?: string; // ISO date string
  currentRotation?: ClinicalRotation;
  yearInProgram?: YearInProgram;
  isCertifiedPA?: boolean;
  hasCompletedOnboarding: boolean;
  specialty?: string; // For practicing PAs - their current specialty area
}

// Constants for dropdown options
export const YEAR_IN_PROGRAM_OPTIONS: readonly YearInProgram[] = [
  'Didactic Year 1',
  'Didactic Year 2',
  'Clinical Year',
  'Graduated',
  'Post-Graduate',
  'Preparing for PANCE',
] as const;

// Specialty CAQ Tracks (DLC Packs)
export type SpecialtyTrack = 'orthopedics' | 'dermatology' | 'psychiatry' | 'emergency_medicine';

export interface SpecialtyCAQPack {
  id: SpecialtyTrack;
  name: string;
  description: string;
  isPurchased?: boolean;
  releaseDate?: string;
}

// OSCE/Patient Encounter Configuration
export interface OSCEConfiguration {
  enableVoiceMode?: boolean; // Voice-to-Voice option
  aiDifficultyLevel?: 'cooperative' | 'difficult' | 'very_difficult';
  resourceLimited?: boolean; // Disables CT/MRI options
  culturalCompetency?: boolean; // Enable cultural vignettes
}

// Daily Ritual Features
export interface DailyRitualData {
  medicalWordle?: MedicalWordleGame;
  thisDayInMedicine?: HistoricalMedicalEvent;
  streakFreezes?: number; // Count of available streak freezes
}

export interface MedicalWordleGame {
  id: string;
  date: string; // ISO date
  targetWord: string;
  category?: string;
  attempts?: string[];
  solved?: boolean;
  hints?: {
    class?: string; // e.g., "Antibiotic", "3rd Generation"
    system?: string;
  };
}

export interface HistoricalMedicalEvent {
  id: string;
  date: string; // MM-DD format
  year: number;
  title: string;
  description: string;
  relatedQuestions?: string[]; // Question IDs
}

// Unit Preferences
export type UnitSystem = 'us' | 'si';
export type DrugNamingConvention = 'us' | 'uk' | 'global';

export interface UserPreferences {
  unitSystem?: UnitSystem;
  drugNaming?: DrugNamingConvention;
  enableSmartWatchSync?: boolean;
}

// Smart Watch Data
export interface SmartWatchComplication {
  daysUntilExam?: number;
  dailyProgress?: {
    current: number;
    goal: number;
  };
  currentStreak?: number;
}
