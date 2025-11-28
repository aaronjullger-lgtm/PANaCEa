/**
 * Guideline Types for Vignette-Based Scoring Drills
 * 
 * These types define the structure for clinical scoring guidelines
 * like CURB-65, Wells Criteria, CHADS2-VASc, etc.
 */

/**
 * A single scoring component/criterion within a guideline.
 */
export interface GuidelineComponent {
  /** Unique identifier for this criterion */
  id: string;
  /** Display label for the criterion */
  label: string;
  /** Point value when this criterion is met */
  pointValue: number;
  /** Optional description/clarification */
  description?: string;
}

/**
 * Maps total scores to risk tiers/categories.
 */
export interface ScoreTier {
  /** Minimum score for this tier (inclusive) */
  minScore: number;
  /** Maximum score for this tier (inclusive) */
  maxScore: number;
  /** Risk tier label (e.g., "Low", "Moderate", "High") */
  tier: string;
  /** Recommended action or interpretation */
  recommendation?: string;
}

/**
 * A clinical vignette/case for practicing guideline scoring.
 */
export interface GuidelineCase {
  /** Unique identifier for this case */
  id: string;
  /** The clinical scenario text */
  story: string;
  /** IDs of the guideline components that are TRUE for this patient */
  metCriteriaIds: string[];
  /** Pre-calculated correct score for validation */
  correctScore: number;
  /** Clinical reasoning explanation shown after answering */
  explanation: string;
}

/**
 * Complete guideline definition with scoring criteria and practice cases.
 */
export interface Guideline {
  /** Unique identifier for the guideline */
  id: string;
  /** Display name (e.g., "CURB-65", "Wells Criteria") */
  name: string;
  /** Brief description of what the guideline assesses */
  description: string;
  /** The scoring components/criteria */
  components: GuidelineComponent[];
  /** Optional mapping of total scores to risk tiers */
  scoringMap?: ScoreTier[];
  /** Practice vignettes for this guideline */
  vignettes: GuidelineCase[];
  /** Maximum possible score */
  maxScore: number;
  /** Clinical context or when to use this guideline */
  clinicalContext?: string;
}

/**
 * State for the guideline drill component.
 */
export type GuidelineDrillStatus = 'answering' | 'feedback' | 'summary';

/**
 * Session results for a guideline drill.
 */
export interface GuidelineDrillResult {
  /** Total vignettes attempted */
  total: number;
  /** Number answered correctly */
  correct: number;
  /** Individual case results */
  cases: {
    caseId: string;
    userScore: number;
    correctScore: number;
    isCorrect: boolean;
  }[];
}
