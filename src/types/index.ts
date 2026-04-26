/**
 * Consolidated Type Definitions for PANaCEa
 *
 * This file consolidates all type definitions from:
 * - /types.ts (root)
 * - /src/types/content.ts
 *
 * Import from this file for all type needs throughout the application.
 */

// ============================================================================
// Core Question and Performance Types
// ============================================================================

/** Standardized rationale format (5-section template) for PANCE-style explanations. */
export interface StructuredRationale {
  bottomLine?: string;
  whyCorrect: string;
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  whyIncorrectE?: string;
  clinicalPearl?: string;
  highYieldImageOrTable?: string;
  commonPitfalls?: string[];
  /** Grounding sources extracted by AI generation (PubMed, textbooks, guidelines) */
  groundingSources?: GroundingSource[];
  /** PubMed citations extracted during question generation */
  pubmedCitations?: GroundingSource[];
}

/** A source reference attached to AI-generated content for provenance tracking. */
export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Question {
  /** Unique identifier for tracking */
  id?: string;
  /** Legacy API identifier used by older sync endpoints. */
  questionId?: string;
  /** Optional vignette text for long-form stems */
  vignette?: string;
  /** Legacy alias for question text used by older generated content */
  stem?: string;
  question: string;
  options: string[];
  /** Alias for options (for backwards compatibility) */
  answers?: string[];
  correctAnswerIndex: number;
  /** Alias for correctAnswerIndex (for backwards compatibility) */
  correctIndex?: number;
  /** Rationale: structured (5-section) or legacy string (JSON string when stored) */
  rationale: string | StructuredRationale;
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
  pearls?: string[];
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
  /** Timestamp when question data was last modified (for conflict resolution) */
  updatedAt?: string | Date; // ISO timestamp or Date object
  /** Task category for Due Cards sibling lookup (e.g. diagnosis, workup, treatment) */
  taskType?: string;
  /** Set when question is a sibling for a Due item; used to remove concept from due queue on correct */
  dueConceptKey?: { conditionId: string; taskType: string | null };
  /** Source of the question (pool, main table, generated) */
  source?: string;
  /** Content source attribution (e.g. 'openstax') */
  contentSource?: string;
  /** Content source title (e.g. book name) */
  contentSourceTitle?: string;
  /** True when question is from staging lake (beta/peer review) */
  fromStaging?: boolean;
  /** Optional image/ECG/imaging URL for multi-modal questions */
  imageUrl?: string;
  /** Grounding sources attached by AI generation (provenance tracking) */
  groundingSources?: GroundingSource[];
  /** PubMed citations extracted during question generation */
  pubmedCitations?: GroundingSource[];
}

/** Error taxonomy for meta-cognition - helps users understand why they miss questions */
export type ErrorTag = 'knowledge_gap' | 'misread_question' | 'guessing';

export interface PerformanceRecord {
  /** Optional persisted attempt identifier from cloud sync. */
  id?: string;
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
  // Difficulty is always PANCE-level ('same')

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
  mode?:
    | 'standard'
    | 'diagnostic'
    | 'photo'
    | 'anatomy'
    | 'quick-review'
    | 'custom'
    | 'core_adaptive'
    | 'drill'
    | 'session'
    | 'review'
    | 'exam'
    | 'rapid_recall'
    | 'cram_mode'
    | 'cram'
    | 'variant'
    | 'due';
  focus:
    | 'all'
    | 'growth'
    | 'review'
    | 'due'
    | 'topic'
    | 'reviewFlagged'
    | 'unseen'
    | 'incorrect'
    | 'bookmarked';
  topic?: string;
  count?: number;
  systems?: string[];
  /** Optional difficulty filter for pool/API */
  difficulty?: string;
  /** Core PANCE Simulation only: strict NCCPA blueprint, no weak-area bias, PANCE-level difficulty */
  simulationStrict?: boolean;

  /** Optional: when present, Gemini should target this specific condition */
  conditionName?: string;
  subcategoryName?: string;
  /** Optional time limit in milliseconds - session auto-ends at limit (for time-boxed study) */
  timeLimit?: number;
  /** Question count (legacy field name, kept for compatibility with 'count') */
  questionCount?: number;
  /** Optional study stage / blueprint stage metadata used by adaptive parents */
  stage?: string;
  /** Interleaving mode: 'interleaved' mixes systems, 'focused' drills one system */
  interleaveMode?: 'interleaved' | 'focused';
}

// ============================================================================
// System Codes and Condition Types
// ============================================================================

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

// ============================================================================
// User Profile and Onboarding Types
// ============================================================================

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
  examDate?: string; // ISO date string for PANCE/PANRE
  currentRotation?: ClinicalRotation;
  /** EOR exam date for current rotation (ISO date string); when set, dashboard shows EOR Readiness */
  eorTestDate?: string;
  /** Rotation start date (ISO date string); for EOR time-blocked scheduling */
  rotationStartDate?: string;
  /** Rotation end date (ISO date string); for EOR time-blocked scheduling */
  rotationEndDate?: string;
  yearInProgram?: YearInProgram;
  specialty?: string; // For practicing PAs - current specialty area
  hasCompletedOnboarding: boolean;
  isCertifiedPA?: boolean; // For PANRE-LA access
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

// ============================================================================
// Specialty CAQ and DLC Content
// ============================================================================

export type SpecialtyTrack = 'orthopedics' | 'dermatology' | 'psychiatry' | 'emergency_medicine';

export interface SpecialtyCAQPack {
  id: SpecialtyTrack;
  name: string;
  description: string;
  isPurchased?: boolean;
  releaseDate?: string;
}

// ============================================================================
// OSCE/Patient Encounter Configuration
// ============================================================================

export interface OSCEConfiguration {
  enableVoiceMode?: boolean; // Voice-to-Voice option
  aiDifficultyLevel?: 'cooperative' | 'difficult' | 'very_difficult';
  resourceLimited?: boolean; // Disables CT/MRI options
  culturalCompetency?: boolean; // Enable cultural vignettes
}

// ============================================================================
// Daily Ritual Features
// ============================================================================

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

// ============================================================================
// User Preferences
// ============================================================================

export type UnitSystem = 'us' | 'si';
export type DrugNamingConvention = 'us' | 'uk' | 'global';

export interface UserPreferences {
  unitSystem?: UnitSystem;
  drugNaming?: DrugNamingConvention;
  enableSmartWatchSync?: boolean;
}

// ============================================================================
// Smart Watch Integration
// ============================================================================

export interface SmartWatchComplication {
  daysUntilExam?: number;
  dailyProgress?: {
    current: number;
    goal: number;
  };
  currentStreak?: number;
}

// ============================================================================
// Content Types (from src/types/content.ts)
// ============================================================================

/**
 * Individual lab value with flag indicator
 */
export interface LabValue {
  name: string;
  value: string;
  unit: string;
  flag: 'H' | 'L' | 'N'; // High, Low, Normal
}

/**
 * Lab panel groupings (legacy - for backward compatibility)
 * Note: Additional panels can be added dynamically as orderable tests
 */
export interface LabPanels {
  BMP: LabValue[];
  CBC: LabValue[];
  LFT: LabValue[];
  // Additional orderable test panels are added at runtime
  // but not defined here to maintain type safety
}

/**
 * Basic science concept link for foundational learning
 */
export interface BasicScienceLink {
  title: string; // e.g., "Review: Insulin Signaling"
  conceptId: string; // Internal ID for the foundational page
}

/**
 * Lab case for Mini Mode training
 * Focuses on interpreting laboratory values to reach a diagnosis
 */
export interface LabCase {
  id: string;
  correctDiagnosis: string;
  clinicalVignette: string;
  labs: LabPanels;
  /** Optional: Additional orderable tests that are available but not shown initially */
  orderableTests?: Record<string, LabValue[]>;
  /** Optional: Links to foundational basic science concepts */
  basicScienceLinks?: BasicScienceLink[];
}

/**
 * Physical exam finding or buzzword clue
 */
export interface PresentationClue {
  type: 'buzzword' | 'physical_exam' | 'history';
  description: string;
}

/**
 * Clinical case for Mini Mode training
 * Focuses on presentation clues and differential diagnosis
 */
export interface ClinicalCase {
  id: string;
  correctDiagnosis: string;
  vignette: string;
  presentationClues: PresentationClue[];
  /** Optional: Links to foundational basic science concepts */
  basicScienceLinks?: BasicScienceLink[];
}

/**
 * Buzzword entry for quick reference
 */
export interface BuzzwordEntry {
  id?: string;
  buzzword: string;
  condition: string;
  system: SystemCode;
  subcategory?: string;
  explanation?: string;
}

/**
 * Pre-generated question from the question pool
 * Used for admin curation and review before questions enter the main pool
 */
export interface PreGeneratedQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  conditionId?: string;
  condition?: string;
  difficulty?: string;
  imageUrl?: string;
  source?: string;
  generatedAt?: string;
  status?: 'pending' | 'approved' | 'rejected';
}
