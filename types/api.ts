/**
 * API Response Types for PANaCEa
 *
 * Generic envelope types are now canonical in `lib/api/types/common.ts`
 * and re-exported here so existing `import { X } from '@/types/api'`
 * call sites continue to work without changes.
 *
 * Domain-specific types (questions, drills, sessions, user) live in
 * `lib/api/types/` and should be imported from there directly.
 */

// ============================================================================
// GENERIC API RESPONSE TYPES — re-exported from shared library
// ============================================================================

// ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse (discriminated union)
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
} from '@/lib/api/types/common';

export { isApiError, isApiSuccess } from '@/lib/api/types/common';

// ============================================================================
// AUTHENTICATION & USER TYPES
// ============================================================================

/**
 * User authentication response
 */
export interface AuthResponse {
  user: {
    id: string;
    clerkId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
  token?: string;
}

/**
 * Admin authentication context
 */
export interface AdminAuthResponse {
  userId: string;
  clerkId: string;
  role: 'admin' | 'superadmin';
  email?: string;
  permissions: string[];
}

// ============================================================================
// QUESTION & QUIZ TYPES
// ============================================================================

/**
 * Question generation request
 */
export interface QuestionGenerationRequest {
  system?: string;
  // Difficulty is fixed at PANCE-level ('same')
  conditionId?: string;
  focus?: 'all' | 'growth' | 'topic';
  count?: number;
}

/**
 * Question response from API
 */
export interface QuestionResponse {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  topic: string;
  system?: string;
  subcategory?: string;
  conditionId: string;
  condition: string;
  pearls: string[];
}

/**
 * Quiz session response
 */
export interface QuizSessionResponse {
  sessionId: string;
  questions: QuestionResponse[];
  settings: {
    focus: string;
    difficulty: string;
    topic?: string;
  };
}

// ============================================================================
// PERFORMANCE & ANALYTICS TYPES
// ============================================================================

/**
 * Performance record submission
 */
export interface PerformanceRecordRequest {
  timestamp: number;
  system: string | null;
  subcategory: string | null;
  conditionId: string;
  condition: string;
  topic: string;
  isCorrect: boolean;
  focus: string;
  // Difficulty is fixed at PANCE-level
  timeSpentMs?: number;
  answerChangedCount?: number;
  finalAnswerWasChanged?: boolean;
  questionType?: 'diagnosis' | 'management' | 'pharm' | 'other';
  errorTag?: 'knowledge_gap' | 'misread_question' | 'guessing';
  questionWordCount?: number;
}

/**
 * Analytics data response
 */
export interface AnalyticsResponse {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  systemBreakdown: Record<
    string,
    {
      correct: number;
      total: number;
      accuracy: number;
    }
  >;
  recentPerformance: PerformanceRecordRequest[];
  weakestSystems: string[];
  strongestSystems: string[];
}

// ============================================================================
// MEDIA & CONTENT TYPES
// ============================================================================

/**
 * Media asset response
 */
export interface MediaAssetResponse {
  id: string;
  conditionId?: string;
  type: 'ekg' | 'imaging' | 'labs' | 'diagram' | 'photo' | 'other';
  filename: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  description?: string;
  altText?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  qualityScore?: number;
  uploadedAt: string;
}

/**
 * Media approval request
 */
export interface MediaApprovalRequest {
  mediaId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
  qualityScore?: number;
}

/**
 * Media stats response
 */
export interface MediaStatsResponse {
  totalMedia: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  averageQualityScore: number;
  recentUploads: MediaAssetResponse[];
}

// ============================================================================
// ADMIN & AUDIT TYPES
// ============================================================================

/**
 * Admin audit log entry
 */
export interface AdminAuditLogResponse {
  id: string;
  userId: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'blocked';
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Admin dashboard stats
 */
export interface AdminDashboardResponse {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
  };
  content: {
    totalQuestions: number;
    pendingApproval: number;
    qualityIssues: number;
  };
  system: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  recentActivity: AdminAuditLogResponse[];
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

/**
 * Export result response
 */
export interface ExportResultResponse {
  success: boolean;
  format: 'oauth' | 'csv';
  taskCount: number;
  downloadUrl?: string; // For CSV exports
  projectId?: string; // For OAuth exports
  message: string;
}

// ============================================================================
// SYNC & OFFLINE TYPES
// ============================================================================

/**
 * Sync request payload
 */
export interface SyncRequest {
  userId: string;
  performanceRecords?: PerformanceRecordRequest[];
  srsItems?: Array<{
    questionId: string;
    interval: number;
    repetition: number;
    easiness: number;
    dueDate: string;
    lastReviewed: string;
    quality: number;
  }>;
  savedQuestions?: Array<{
    questionId: string;
    questionText: string;
    correctAnswer: string;
    explanation: string;
    topic: string;
    system?: string;
    type: 'missed' | 'flagged';
    userNote?: string;
  }>;
}

/**
 * Sync response
 */
export interface SyncResponse {
  success: boolean;
  synced: {
    performanceRecords: number;
    srsItems: number;
    savedQuestions: number;
  };
  conflicts?: Array<{
    type: string;
    id: string;
    reason: string;
  }>;
  lastSyncTime: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    gemini: 'up' | 'down';
    supabase: 'up' | 'down';
    clerk: 'up' | 'down';
  };
  version: string;
  uptime: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Type guards (isApiError, isApiSuccess) are re-exported from lib/api/types/common on line 24.
// Response creators (createErrorResponse, createSuccessResponse) live in lib/errorHandling.ts
// and functions/api/_shared/auth.ts — import from there.
