/**
 * PANaCEa Shared API Types — User
 *
 * Types for user profile, stats, and FSRS parameter endpoints.
 */

// =============================================================================
// USER PROFILE
// =============================================================================

/**
 * User profile as returned by GET /api/user/profile.
 */
export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  examDate?: string | null;
  graduationDate?: string | null;
  school?: string | null;
  specialty?: string | null;
  currentRotation?: string | null;
  yearInProgram?: string | null;
  eorTestDate?: string | null;
  rotationStartDate?: string | null;
  rotationEndDate?: string | null;
  rotationExamDate?: string | null;
  hasCompletedBaseline: boolean;
  hasCompletedOnboarding: boolean;
  trainingPhase?: string | null;
  updatedAt: string;
}

/**
 * PUT /api/user/profile request body (all fields optional).
 */
export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  examDate?: string | null;
  graduationDate?: string | null;
  school?: string | null;
  specialty?: string | null;
  currentRotation?: string | null;
  yearInProgram?: string | null;
  eorTestDate?: string | null;
  rotationStartDate?: string | null;
  rotationEndDate?: string | null;
  hasCompletedBaseline?: boolean;
  hasCompletedOnboarding?: boolean;
}

// =============================================================================
// USER STATS
// =============================================================================

/** Per-system performance breakdown. */
export interface SystemPerformance {
  total: number;
  correct: number;
  accuracy: number;
  trend: 'improving' | 'declining' | 'neutral';
  avgTimeMs: number | null;
}

/** Area summary (weak or strong). */
export interface PerformanceArea {
  system: string;
  accuracy: number;
  attempts: number;
}

/**
 * GET /api/user/stats response data (unwrapped).
 */
export interface UserStats {
  overall: {
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    questionsSeenCount: number;
    currentStreak: number;
    totalStudyDays: number;
    avgTimeMs: number | null;
    todayCount: number;
    todayTimeMs: number;
  };
  bySystems: Record<string, SystemPerformance>;
  weakAreas: PerformanceArea[];
  strongAreas: PerformanceArea[];
  recentPerformance: {
    last7Days: { attempts: number; accuracy: number | null };
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  };
  recommendations: string[];
}

// =============================================================================
// FSRS PARAMETERS
// =============================================================================

/**
 * GET /api/user/fsrs-params response data (unwrapped).
 */
export interface FSRSParams {
  weights: number[];
  retention: number;
  optimizedAt?: string;
  reviewCount?: number;
}
