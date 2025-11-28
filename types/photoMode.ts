// types/photoMode.ts
// Phase 1: Architecture & Types for Global Photo Mode + Pattern Match feature

import type { SystemCode } from "../types";

/**
 * Represents a media asset (image) for the photo drill system.
 * Used for displaying medical images like ECG, X-ray, Derm, etc.
 */
export interface MediaAsset {
  /** Unique identifier for the media asset */
  id: string;
  /** URL to the high-resolution image */
  url: string;
  /** Type of medical image */
  type: MediaType;
  /** Source/attribution of the image */
  source: string;
  /** Optional thumbnail URL for faster loading */
  thumbnailUrl?: string;
  /** Alt text for accessibility */
  altText: string;
  /** Medical system this image belongs to (e.g., CV, DERM, PULM) */
  system: SystemCode;
  /** Subcategory within the system */
  subcategory?: string;
}

/**
 * Types of medical images supported in Photo Mode
 */
export type MediaType = 
  | "ecg"
  | "xray"
  | "ct"
  | "mri"
  | "ultrasound"
  | "derm"
  | "fundoscopy"
  | "microscopy"
  | "other";

/**
 * State machine states for the drill session.
 * Flow: view -> answering -> feedback -> ddx_comparison (if wrong)
 */
export type DrillSessionState = 
  | "view"           // User is viewing the image
  | "answering"      // User is selecting/typing their answer
  | "feedback"       // Showing if answer was correct
  | "ddx_comparison"; // Showing DDx comparison if answer was wrong

/**
 * Represents a single photo drill question
 */
export interface PhotoDrillQuestion {
  /** Unique identifier for this drill question */
  id: string;
  /** The media asset to display */
  media: MediaAsset;
  /** The correct diagnosis (answer) */
  correctDiagnosis: DiagnosisOption;
  /** Distractor diagnoses (wrong answers) */
  distractors: DiagnosisOption[];
  /** Optional clinical context (kept minimal for visual-only learning) */
  clinicalContext?: string;
  /** Difficulty level 1-5 */
  difficulty: number;
}

/**
 * Represents a diagnosis option (correct or distractor)
 */
export interface DiagnosisOption {
  /** Unique identifier */
  id: string;
  /** The diagnosis name */
  name: string;
  /** Key visual features that distinguish this diagnosis */
  keyFeatures: string[];
  /** Brief explanation of why this is/isn't the correct answer */
  rationale?: string;
  /** System code for categorization */
  system: SystemCode;
  /** Subcategory within the system */
  subcategory?: string;
}

/**
 * Tracks user confusion patterns: maps real diagnosis ID to mistaken diagnosis ID
 * This helps identify patterns in user mistakes for targeted learning
 */
export interface ConfusionMap {
  /** Maps correct diagnosis ID to an array of mistakenly chosen diagnosis IDs */
  [realId: string]: ConfusionEntry[];
}

/**
 * Entry in the confusion map tracking a single confusion instance
 */
export interface ConfusionEntry {
  /** The ID of the diagnosis the user incorrectly chose */
  mistakenId: string;
  /** Name of the mistaken diagnosis */
  mistakenName: string;
  /** Timestamp when this confusion occurred */
  timestamp: number;
  /** The question ID where this confusion occurred */
  questionId: string;
}

/**
 * Represents the current state of a photo drill session
 */
export interface DrillSession {
  /** Unique session identifier */
  id: string;
  /** Current state of the drill */
  state: DrillSessionState;
  /** Current question being displayed */
  currentQuestion: PhotoDrillQuestion | null;
  /** Questions that have been answered in this session */
  answeredQuestions: AnsweredQuestion[];
  /** User's confusion map for this session */
  confusionMap: ConfusionMap;
  /** Session start time */
  startedAt: number;
  /** Current score */
  score: {
    correct: number;
    total: number;
  };
  /** Input mode preference */
  inputMode: InputMode;
}

/**
 * Represents an answered question with the user's response
 */
export interface AnsweredQuestion {
  /** The question that was answered */
  question: PhotoDrillQuestion;
  /** The diagnosis the user selected */
  userAnswer: DiagnosisOption;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Time taken to answer in milliseconds */
  timeTaken: number;
  /** Timestamp when answered */
  answeredAt: number;
}

/**
 * Input mode for selecting diagnoses
 */
export type InputMode = "typeahead" | "multiple-choice";

/**
 * Actions that can be dispatched to the drill session reducer
 */
export type DrillSessionAction =
  | { type: "LOAD_QUESTION"; payload: PhotoDrillQuestion }
  | { type: "START_ANSWERING" }
  | { type: "SUBMIT_ANSWER"; payload: { answer: DiagnosisOption; timeTaken: number } }
  | { type: "SHOW_DDX_COMPARISON" }
  | { type: "NEXT_QUESTION" }
  | { type: "SET_INPUT_MODE"; payload: InputMode }
  | { type: "RESET_SESSION" };

/**
 * Props for the DDx Comparison panel
 */
export interface DDxComparisonProps {
  /** The user's incorrect choice */
  userChoice: DiagnosisOption;
  /** The correct answer */
  correctAnswer: DiagnosisOption;
  /** Media asset for reference */
  media: MediaAsset;
}

/**
 * Mock API response for fetching next image
 */
export interface PhotoModeApiResponse {
  success: boolean;
  data?: PhotoDrillQuestion;
  error?: string;
}

/**
 * Filter options for photo drill
 */
export interface PhotoDrillFilters {
  /** Filter by system (e.g., CV, DERM) */
  system?: SystemCode;
  /** Filter by media type */
  mediaType?: MediaType;
  /** Filter by difficulty (1-5) */
  difficulty?: number;
  /** Include previously missed questions */
  includeReview?: boolean;
}
