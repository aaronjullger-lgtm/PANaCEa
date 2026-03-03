/**
 * Study Path Optimizer Types
 * Phase 6.2: Path Generation & API
 */

/**
 * A single study session within a study plan.
 */
export interface StudySession {
  id: string;
  date: Date;
  topics: Array<{
    taxonomyCode: string;
    subcategory?: string;
    recommendedAction: 'REVIEW' | 'NEW' | 'CALIBRATE';
    estimatedMinutes: number;
    urgencyScore: number;
    // Optional identifiers for specific content (e.g., question IDs)
    contentIds?: string[];
  }>;
  notes?: string;
}

/**
 * A complete study plan generated for a user.
 */
export interface StudyPlan {
  id: string;
  userId: string;
  generatedAt: Date;
  validUntil: Date;
  sessions: StudySession[];
  totalEstimatedMinutes: number;
  confidence: number;
  metadata: {
    blueprintCoverage: Record<string, number>; // system -> percentage (0‑1)
    projectedRetentionIncrease: number;
    fatigueRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    // Additional metadata for debugging/analysis
    gapsProcessed: number;
    constraintsUsed: StudyPathConstraints;
  };
}

/**
 * User‑defined constraints for plan generation.
 */
export interface StudyPathConstraints {
  /** Maximum total study minutes per day (optional) */
  dailyMinutesLimit?: number;
  /** Target exam date (optional) */
  examDate?: Date;
  /** Desired retention rate (default 0.90) */
  targetRetention?: number;
  /** Focus areas (taxonomy codes to prioritize) */
  focusAreas?: string[];
  /** Excluded areas (taxonomy codes to avoid) */
  excludeAreas?: string[];
  /** Preferred days of week (0 = Sunday, 6 = Saturday) */
  preferredDays?: number[];
  /** Maximum sessions per day (default 2) */
  maxSessionsPerDay?: number;
}

/**
 * Input to the Path Generator.
 */
export interface PathGeneratorInput {
  userId: string;
  constraints?: StudyPathConstraints;
  /** Existing performance gaps (from Performance Gap Analyzer) */
  gaps: Array<{
    taxonomyCode: string;
    subcategory?: string | null;
    currentAccuracy: number;
    targetAccuracy: number;
    gap: number;
    reviewCount: number;
    lastReviewedAt?: Date;
  }>;
  /** Scheduled reviews (from Retention‑Aware Scheduler) */
  scheduledReviews: Array<{
    taxonomyCode: string;
    subcategory?: string | null;
    recommendedReviewDate: Date | null;
    urgencyScore: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  /** Blueprint‑weighted priorities (from Blueprint‑Balanced Selector) */
  blueprintPriorities: Array<{
    taxonomyCode: string;
    subcategory?: string | null;
    priorityScore: number;
    weightDeviation: number;
  }>;
  /** Optional fatigue risk level */
  fatigueRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Output from the Path Generator.
 */
export interface PathGeneratorOutput {
  plan: StudyPlan;
  alternatives: StudyPlan[]; // up to 3 alternative plans
  rationale: string; // human‑readable explanation
  confidence: number; // overall confidence (0‑1)
  canRegenerate: boolean;
  /** Diagnostics for debugging */
  diagnostics?: {
    gapsProcessed: number;
    schedulingLogic: string;
    constraintsApplied: string[];
  };
}

/**
 * Confidence scorer input.
 */
export interface ConfidenceScorerInput {
  /** Number of reviews per topic */
  reviewCounts: Record<string, number>;
  /** Variance of accuracy per topic (optional) */
  accuracyVariances?: Record<string, number>;
  /** Time since last review per topic (days) */
  daysSinceLastReview: Record<string, number>;
  /** Data density threshold (default 60) */
  dataDensityThreshold?: number;
}

/**
 * Confidence scorer output.
 */
export interface ConfidenceScorerOutput {
  /** Overall confidence (0‑1) */
  confidence: number;
  /** Confidence per topic */
  perTopicConfidence: Record<string, number>;
  /** Flags indicating issues */
  flags: Array<'NEEDS_MORE_DATA' | 'HIGH_VARIANCE' | 'STALE_DATA' | 'INSUFFICIENT_REVIEWS'>;
  /** Recommendations for improving confidence */
  recommendations: string[];
}

/**
 * API response for recommendation endpoints.
 */
export interface RecommendationResponse {
  plan: StudyPlan;
  alternatives: StudyPlan[];
  rationale: string;
  confidence: number;
  canRegenerate: boolean;
  /** Cache information */
  cached?: boolean;
  generatedAt: Date;
}

/**
 * API request for regenerating a plan with new constraints.
 */
export interface RegeneratePlanRequest {
  constraints?: StudyPathConstraints;
  /** If true, discard cached plan and force recomputation */
  forceRegenerate?: boolean;
}

/**
 * Progress projection data.
 */
export interface ProgressProjection {
  date: Date;
  projectedRetention: number;
  projectedAccuracy: number;
  projectedCoverage: number; // percentage of blueprint covered
  cumulativeStudyMinutes: number;
}

/**
 * API response for progress endpoint.
 */
export interface ProgressResponse {
  projections: ProgressProjection[];
  currentPlanId?: string;
  /** Metrics about the projection */
  metrics: {
    totalStudyDays: number;
    averageDailyMinutes: number;
    estimatedRetentionIncrease: number;
  };
}

/**
 * API request for accepting a plan.
 */
export interface AcceptPlanRequest {
  planId: string;
  /** Optional user feedback */
  feedback?: 'TOO_LONG' | 'TOO_SHORT' | 'WRONG_FOCUS' | 'OTHER';
  feedbackNotes?: string;
}