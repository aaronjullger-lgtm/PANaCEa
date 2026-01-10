/**
 * Zod Validation Schemas for API Endpoints
 * 
 * Sprint A: Security & Stability
 * Centralized input validation for all POST/PUT endpoints
 */

import { z } from 'zod';

// =============================================================================
// COMMON TYPES
// =============================================================================

/** UUID validation */
export const UUIDSchema = z.string().uuid();

/** CUID validation (Prisma default ID format) */
export const CUIDSchema = z.string().min(20).max(30);

/** Flexible ID that accepts both UUID and CUID */
export const IDSchema = z.string().min(1).max(100);

/** Organ system enum */
export const OrganSystemSchema = z.enum([
  'cardiovascular',
  'pulmonary',
  'gastrointestinal',
  'musculoskeletal',
  'heent',
  'reproductive',
  'neurological',
  'psychiatry',
  'endocrine',
  'dermatology',
  'genitourinary',
  'hematology',
  'infectious_disease',
  'nephrology',
  'emergency_medicine',
]);

/** Difficulty level */
export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

/** Question mode */
export const QuestionModeSchema = z.enum([
  'drill',
  'session',
  'review',
  'exam',
  'rapid_recall',
]);

// =============================================================================
// QUESTION ATTEMPT
// =============================================================================

export const QuestionAttemptSchema = z.object({
  questionId: IDSchema,
  isCorrect: z.boolean().optional(),
  wasCorrect: z.boolean().optional(),
  system: OrganSystemSchema.optional(),
  conditionId: IDSchema.optional(),
  questionType: z.string().max(50).optional(),
  mode: QuestionModeSchema.optional().default('session'),
  timeSpent: z.number().int().min(0).max(600000).optional(),
  timeSpentMs: z.number().int().min(0).max(600000).optional(),
  answerChangedCount: z.number().int().min(0).max(100).optional(),
  isRankedAttempt: z.boolean().optional().default(false),
}).refine(
  (data) => data.isCorrect !== undefined || data.wasCorrect !== undefined,
  { message: 'Either isCorrect or wasCorrect must be provided' }
);

export type QuestionAttemptInput = z.infer<typeof QuestionAttemptSchema>;

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

export const SessionConfigSchema = z.object({
  questionCount: z.number().int().min(5).max(100).default(20),
  systems: z.array(OrganSystemSchema).min(1).max(15).optional(),
  difficulty: DifficultySchema.optional(),
  mode: QuestionModeSchema.optional().default('session'),
  includeNew: z.boolean().optional().default(true),
  includeReview: z.boolean().optional().default(true),
  includeMissed: z.boolean().optional().default(false),
  interleaved: z.boolean().optional().default(true),
});

export type SessionConfigInput = z.infer<typeof SessionConfigSchema>;

export const StartExamSchema = z.object({
  configId: IDSchema,
  resumeAttemptId: IDSchema.optional(),
});

export type StartExamInput = z.infer<typeof StartExamSchema>;

export const CompleteExamSchema = z.object({
  attemptId: IDSchema,
});

export type CompleteExamInput = z.infer<typeof CompleteExamSchema>;

export const SubmitExamAnswersSchema = z.object({
  examAttemptId: IDSchema,
  answers: z.array(z.object({
    questionId: IDSchema,
    selectedAnswer: z.string().max(500),
    flagged: z.boolean().optional(),
    timeSpentMs: z.number().int().min(0).optional(),
  })),
});

export type SubmitExamAnswersInput = z.infer<typeof SubmitExamAnswersSchema>;

// =============================================================================
// QUESTION FLAGGING
// =============================================================================

export const FlagQuestionSchema = z.object({
  questionId: IDSchema,
  questionText: z.string().min(1).max(5000),
  correctAnswer: z.string().max(1000).optional(),
  topic: z.string().max(200).optional(),
  system: OrganSystemSchema.optional(),
  flagType: z.enum([
    'incorrect_answer',
    'unclear_question',
    'outdated_content',
    'typo',
    'duplicate',
    'inappropriate',
    'other',
  ]),
  description: z.string().min(10).max(2000),
});

export type FlagQuestionInput = z.infer<typeof FlagQuestionSchema>;

// =============================================================================
// USER PROGRESS / FSRS
// =============================================================================

export const ReviewSubmissionSchema = z.object({
  conditionId: IDSchema,
  rating: z.number().int().min(1).max(4), // FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy
  questionId: IDSchema.optional(),
  timeSpentMs: z.number().int().min(0).max(600000).optional(),
});

export type ReviewSubmissionInput = z.infer<typeof ReviewSubmissionSchema>;

export const DrillSubmitReviewSchema = z.object({
  questionId: IDSchema,
  selectedAnswer: z.union([z.string(), z.number()]),
  timeSpentMs: z.number().int().min(0).max(600000).optional(),
});

export type DrillSubmitReviewInput = z.infer<typeof DrillSubmitReviewSchema>;

export const UserProgressUpdateSchema = z.object({
  conditionId: IDSchema,
  totalAttempts: z.number().int().min(0).optional(),
  correctCount: z.number().int().min(0).optional(),
  fsrsCard: z.object({
    due: z.string().datetime().optional(),
    stability: z.number().min(0).optional(),
    difficulty: z.number().min(1).max(10).optional(),
    elapsed_days: z.number().int().min(0).optional(),
    scheduled_days: z.number().int().min(0).optional(),
    reps: z.number().int().min(0).optional(),
    lapses: z.number().int().min(0).optional(),
    state: z.number().int().min(0).max(3).optional(),
    last_review: z.string().datetime().optional(),
  }).optional(),
});

export type UserProgressUpdateInput = z.infer<typeof UserProgressUpdateSchema>;

// =============================================================================
// CONTENT MANAGEMENT
// =============================================================================

export const ContentUpdateSchema = z.object({
  conditionId: IDSchema,
  field: z.string().max(100),
  value: z.unknown(),
  reason: z.string().max(500).optional(),
});

export type ContentUpdateInput = z.infer<typeof ContentUpdateSchema>;

export const MediaUploadSchema = z.object({
  conditionId: IDSchema.optional(),
  type: z.enum(['image', 'diagram', 'ecg', 'xray', 'ct', 'mri', 'photo']),
  filename: z.string().min(1).max(255),
  mimeType: z.string().regex(/^image\/(jpeg|png|gif|webp|svg\+xml)$/),
  description: z.string().max(1000).optional(),
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export type MediaUploadInput = z.infer<typeof MediaUploadSchema>;

// =============================================================================
// FEEDBACK & PEARLS
// =============================================================================

export const FeedbackSubmitSchema = z.object({
  type: z.enum(['bug', 'feature', 'content', 'general']),
  message: z.string().min(10).max(5000),
  page: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type FeedbackSubmitInput = z.infer<typeof FeedbackSubmitSchema>;

export const QuestionFeedbackSchema = z.object({
  questionId: IDSchema,
  flagType: z.enum(['incorrect_fact', 'typo', 'confusing_options', 'image_unclear', 'other']),
  description: z.string().min(5).max(2000),
  questionText: z.string().max(5000).optional(),
  topic: z.string().max(200).optional(),
  system: OrganSystemSchema.optional(),
});

export type QuestionFeedbackInput = z.infer<typeof QuestionFeedbackSchema>;

export const PearlSaveSchema = z.object({
  pearlId: IDSchema,
  notes: z.string().max(2000).optional(),
  markedUseful: z.boolean().optional(),
});

export type PearlSaveInput = z.infer<typeof PearlSaveSchema>;

// =============================================================================
// ANALYTICS
// =============================================================================

export const SessionAnalyticsSchema = z.object({
  sessionId: IDSchema.optional(),
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  totalTimeMs: z.number().int().min(0),
  bestStreak: z.number().int().min(0).optional(),
  finalStreak: z.number().int().min(0).optional(),
  totalAnswerChanges: z.number().int().min(0).optional(),
  systemsCovered: z.array(OrganSystemSchema).optional(),
  mode: QuestionModeSchema.optional(),
  focus: z.string().max(50).optional(),
  difficulty: DifficultySchema.optional(),
});

export type SessionAnalyticsInput = z.infer<typeof SessionAnalyticsSchema>;

// =============================================================================
// ADMIN
// =============================================================================

export const AdminMediaApproveSchema = z.object({
  mediaId: IDSchema,
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

export type AdminMediaApproveInput = z.infer<typeof AdminMediaApproveSchema>;

export const QuestionCurateSchema = z.object({
  questionId: IDSchema,
  action: z.enum(['approve', 'reject', 'edit', 'archive']),
  edits: z.object({
    vignette: z.string().max(5000).optional(),
    question: z.string().max(2000).optional(),
    options: z.array(z.string().max(500)).length(4).optional(),
    correctAnswer: z.string().max(1).optional(),
    explanation: z.string().max(5000).optional(),
    difficulty: DifficultySchema.optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }).optional(),
  reason: z.string().max(500).optional(),
});

export type QuestionCurateInput = z.infer<typeof QuestionCurateSchema>;

// =============================================================================
// PERFORMANCE RECORDING
// =============================================================================

export const PerformanceRecordSchema = z.object({
  drillType: z.string().min(1).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  questionsAttempted: z.number().int().min(0).max(10000),
  correctAnswers: z.number().int().min(0).max(10000),
  accuracy: z.number().min(0).max(100),
  timeSpent: z.number().int().min(0).max(86400000), // Max 24 hours in ms
  bestStreak: z.number().int().min(0).max(10000),
  metadata: z.record(z.unknown()).optional(),
});

export type PerformanceRecordInput = z.infer<typeof PerformanceRecordSchema>;

// =============================================================================
// SRS SYNC
// =============================================================================

export const SRSItemSchema = z.object({
  questionId: IDSchema,
  interval: z.number().int().min(0).max(365000),
  repetition: z.number().int().min(0).max(10000),
  easiness: z.number().min(1).max(5),
  dueDate: z.string().datetime(),
  lastReviewed: z.string().datetime(),
  quality: z.number().int().min(0).max(5),
  difficulty: z.number().min(0).max(10),
  stabilityScore: z.number().min(0).max(100),
  fsrsStability: z.number().min(0).optional(),
  fsrsDifficulty: z.number().min(1).max(10).optional(),
  fsrsState: z.number().int().min(0).max(3).optional(),
  fsrsLastReview: z.string().datetime().optional(),
});

export const SRSSyncSchema = z.object({
  items: z.array(SRSItemSchema).max(5000),
});

export type SRSItemInput = z.infer<typeof SRSItemSchema>;
export type SRSSyncInput = z.infer<typeof SRSSyncSchema>;

// =============================================================================
// QUESTIONS SESSION
// =============================================================================

export const SessionRequestSchema = z.object({
  count: z.number().int().min(1).max(100).optional().default(10),
  system: z.string().max(100).optional(),
  systems: z.array(OrganSystemSchema).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  mode: z.enum(['standard', 'interleaved', 'review', 'weakness', 'random']).optional().default('standard'),
  focus: z.enum(['all', 'growth', 'review', 'reviewFlagged', 'flagged', 'due', 'new']).optional().default('all'),
  excludeIds: z.array(IDSchema).max(1000).optional(),
  includeInterleaved: z.boolean().optional().default(true),
  conditionIds: z.array(IDSchema).max(500).optional(),
  subcategory: z.string().max(200).optional(),
});

export type SessionRequestInput = z.infer<typeof SessionRequestSchema>;

// =============================================================================
// STREAKS
// =============================================================================

export const StreakRecordSchema = z.object({
  questionsAnswered: z.number().int().min(0).max(10000),
  accuracyPercent: z.number().min(0).max(100),
  studyMinutes: z.number().int().min(0).max(1440).optional(), // Max 24 hours
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD format
});

export type StreakRecordInput = z.infer<typeof StreakRecordSchema>;

// =============================================================================
// SYNC
// =============================================================================

export const SyncPerformanceRecordSchema = z.object({
  id: IDSchema.optional(),
  topic: z.string().max(200),
  system: z.string().max(100).nullable().optional(),
  focus: z.string().max(100),
  difficulty: z.number().int().min(1).max(10),
  isCorrect: z.boolean(),
  timestamp: z.number().int().positive(),
  questionWordCount: z.number().int().positive().nullable().optional(),
  errorTag: z.string().max(100).nullable().optional(),
  subcategoryName: z.string().max(200).nullable().optional(),
  conditionName: z.string().max(200).nullable().optional(),
});

export const SyncSRSItemSchema = z.object({
  questionId: IDSchema,
  interval: z.number().int().min(0),
  repetition: z.number().int().min(0),
  easiness: z.number().min(1).max(5),
  dueDate: z.string(),
  lastReviewed: z.string(),
  quality: z.number().int().min(0).max(5),
  difficulty: z.number().min(0).max(10),
  stabilityScore: z.number().min(0).optional(),
  updatedAt: z.string().optional(),
});

export const SyncSavedQuestionSchema = z.object({
  questionId: IDSchema,
  questionText: z.string().max(5000),
  correctAnswer: z.string().max(2000),
  explanation: z.string().max(5000).optional(),
  topic: z.string().max(200),
  system: z.string().max(100).optional(),
  type: z.enum(['missed', 'flagged']),
  userNote: z.string().max(2000).optional(),
  repetitionLevel: z.number().int().min(0).max(100).optional(),
  nextReviewDate: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const SyncPayloadSchema = z.object({
  userId: z.string().max(200),
  performanceRecords: z.array(SyncPerformanceRecordSchema).max(10000).optional(),
  srsItems: z.array(SyncSRSItemSchema).max(10000).optional(),
  savedQuestions: z.array(SyncSavedQuestionSchema).max(5000).optional(),
});

export type SyncPerformanceRecordInput = z.infer<typeof SyncPerformanceRecordSchema>;
export type SyncSRSItemInput = z.infer<typeof SyncSRSItemSchema>;
export type SyncSavedQuestionInput = z.infer<typeof SyncSavedQuestionSchema>;
export type SyncPayloadInput = z.infer<typeof SyncPayloadSchema>;

// =============================================================================
// VALIDATION HELPER
// =============================================================================

/**
 * Validate request body against schema and return parsed data or error response
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      const zodError = result as z.SafeParseError<T>;
      return {
        success: false,
        response: new Response(
          JSON.stringify({
            error: 'Validation Error',
            details: zodError.error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}
