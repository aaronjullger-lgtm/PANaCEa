/**
 * Centralized Zod Validation Schemas for PANaCEa API
 *
 * Purpose: Type-safe runtime validation for all API endpoints
 * Security: Enforces input constraints, prevents injection attacks
 *
 * Usage:
 *   import { validateQuestionGeneration } from './_shared/zodSchemas';
 *   const validated = validateQuestionGeneration(request.body);
 */

import { z } from 'zod';

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

/**
 * UUID validation (e.g., user IDs, condition IDs)
 */
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/**
 * Condition ID (canonical name format: lowercase-with-hyphens)
 */
export const conditionIdSchema = z
  .string()
  .min(2, 'Condition ID must be at least 2 characters')
  .max(100, 'Condition ID must not exceed 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Condition ID must contain only lowercase letters, numbers, and hyphens');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().max(1000).default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * Date range validation
 */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'startDate must be before endDate' }
  );

// ============================================================================
// QUESTION GENERATION SCHEMAS
// ============================================================================

/**
 * Question type validation
 */
export const questionTypeSchema = z.enum(
  [
    'clinical_vignette',
    'lab_interpretation',
    'differential_diagnosis',
    'pharmacology',
    'basic_science',
    'procedure',
    'emergency',
  ],
  {
    message: 'Invalid question type',
  }
);

/**
 * Organ system validation (NCCPA Blueprint)
 * Convention: UPPERCASE (e.g. CARDIOVASCULAR, PULMONARY).
 * Used by: question generation, session preferences.
 * Note: schemas.ts OrganSystemSchema uses lowercase; Condition.system in DB may vary.
 */
export const organSystemSchema = z.enum(
  [
    'CARDIOVASCULAR',
    'PULMONARY',
    'GASTROINTESTINAL',
    'MUSCULOSKELETAL',
    'HEENT',
    'REPRODUCTIVE',
    'NEUROLOGICAL',
    'PSYCHIATRY',
    'ENDOCRINE',
    'DERMATOLOGY',
    'GENITOURINARY',
    'HEMATOLOGY',
    'INFECTIOUS_DISEASE',
    'NEPHROLOGY',
    'EMERGENCY_MEDICINE',
  ],
  {
    message: 'Invalid organ system',
  }
);

/**
 * Question generation request validation
 * Used by: /api/questions/generate
 */
export const questionGenerationSchema = z
  .object({
    conditionId: conditionIdSchema,
    questionType: questionTypeSchema,
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    includeImages: z.boolean().default(false),
    systemOverride: organSystemSchema.optional(),
  })
  .strict(); // Reject unknown fields

/**
 * Batch question generation
 */
export const batchQuestionGenerationSchema = z
  .object({
    conditions: z.array(conditionIdSchema).min(1).max(50),
    questionType: questionTypeSchema,
    batchSize: z.number().int().min(1).max(100).default(20),
  })
  .strict();

// ============================================================================
// USER PROGRESS & REVIEW SCHEMAS
// ============================================================================

/**
 * FSRS rating validation (1=Again, 2=Hard, 3=Good, 4=Easy)
 */
export const fsrsRatingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], {
  message: 'Rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)',
});

/**
 * Question review submission (LEGACY - different flow)
 * Fields: userAnswer, rating, timeSpentMs, confidence.
 * Canonical for /api/drills/submit-review: DrillSubmitReviewSchema in schemas.ts
 * (selectedAnswer, telemetry, timeToFirstClick, etc).
 */
export const reviewSubmissionSchema = z
  .object({
    questionId: uuidSchema,
    userAnswer: z.string().min(1, 'Answer cannot be empty').max(5000, 'Answer too long'),
    rating: fsrsRatingSchema,
    timeSpentMs: z.number().int().min(0).max(3600000), // Max 1 hour
    confidence: z.number().min(0).max(100).optional(),
  })
  .strict();

/**
 * User progress update
 */
export const progressUpdateSchema = z
  .object({
    conditionId: conditionIdSchema,
    mastery: z.number().min(0).max(100),
    lastReviewedAt: z.string().datetime(),
    reviewCount: z.number().int().nonnegative(),
  })
  .strict();

// ============================================================================
// SESSION GENERATION SCHEMAS
// ============================================================================

/**
 * Session preferences
 */
export const sessionPreferencesSchema = z
  .object({
    questionCount: z.number().int().min(5).max(100).default(20),
    systems: z.array(organSystemSchema).min(1).max(15).optional(),
    excludeRecent: z.boolean().default(true),
    targetDifficulty: z.enum(['adaptive', 'easy', 'medium', 'hard']).default('adaptive'),
    focusWeakAreas: z.boolean().default(true),
  })
  .strict();

/**
 * Session generation request
 * Used by: /api/study/session/generate
 */
export const sessionGenerationSchema = z
  .object({
    userId: uuidSchema,
    sessionType: z.enum(['rapid_review', 'deep_learning', 'exam_simulation', 'custom']),
    preferences: sessionPreferencesSchema.optional(),
  })
  .strict();

// ============================================================================
// CONTENT MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Clinical pearl creation
 */
export const clinicalPearlSchema = z
  .object({
    conditionId: conditionIdSchema,
    pearl: z.string().min(10, 'Pearl must be at least 10 characters').max(500, 'Pearl too long'),
    category: z.enum(['diagnosis', 'treatment', 'red_flags', 'pearls', 'buzzwords']),
    source: z.string().max(200).optional(),
  })
  .strict();

/**
 * Buzzword validation
 */
export const buzzwordSchema = z
  .object({
    term: z.string().min(2).max(100),
    conditionId: conditionIdSchema,
    context: z.string().max(500).optional(),
  })
  .strict();

/**
 * Media asset validation
 */
export const mediaAssetSchema = z
  .object({
    conditionId: conditionIdSchema,
    assetType: z.enum(['image', 'diagram', 'xray', 'ecg', 'lab_result']),
    caption: z.string().max(500),
    altText: z.string().min(10).max(200),
    url: z.string().url(),
  })
  .strict();

// ============================================================================
// ANALYTICS & REPORTING SCHEMAS
// ============================================================================

/**
 * Performance metrics request
 */
export const performanceMetricsSchema = z
  .object({
    userId: uuidSchema,
    timeRange: dateRangeSchema.optional(),
    systems: z.array(organSystemSchema).optional(),
    groupBy: z.enum(['day', 'week', 'month', 'system']).default('week'),
  })
  .strict();

/**
 * Confusion pair report
 */
export const confusionPairSchema = z
  .object({
    condition1: conditionIdSchema,
    condition2: conditionIdSchema,
    confusionCount: z.number().int().nonnegative(),
  })
  .strict();

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/**
 * User profile partial update (PUT /api/user/profile)
 */
export const profileUpdateSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    examDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid exam date format' })
      .optional()
      .nullable(),
    graduationDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid graduation date format' })
      .optional()
      .nullable(),
    school: z.string().max(200).optional().nullable(),
    currentRotation: z.string().max(100).optional().nullable(),
    yearInProgram: z.string().max(50).optional().nullable(),
    eorTestDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid EOR test date format' })
      .optional()
      .nullable(),
    rotationStartDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid rotation start date format' })
      .optional()
      .nullable(),
    rotationEndDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid rotation end date format' })
      .optional()
      .nullable(),
    hasCompletedBaseline: z.boolean().optional(),
    hasCompletedOnboarding: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Learning profile recompute request
 */
export const profileRecomputeSchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional()
  .default({});

/**
 * Question quality analytics query
 */
export const questionQualityQuerySchema = z.object({
  system: z.string().optional(),
  validationStatus: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
});

/**
 * Session analytics recording (comprehensive behavioral data)
 */
export const sessionAnalyticsSchema = z.object({
  // Accept any string format for sessionId (some clients use `session-timestamp-random` format)
  sessionId: z.string().min(1).optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),

  // Core metrics
  totalQuestions: z.number().int().min(0).max(10000),
  correctAnswers: z.number().int().min(0).max(10000).optional().default(0),
  accuracy: z.number().min(0).max(100).optional().default(0),
  totalTimeMs: z.number().int().min(0).max(86400000).optional().default(0),
  avgTimePerQuestion: z.number().int().min(0).optional(),

  // Streak data
  bestStreak: z.number().int().min(0).max(10000).optional().default(0),
  finalStreak: z.number().int().min(0).max(10000).optional().default(0),
  avgStreak: z.number().min(0).optional(),
  errorClusters: z.number().int().min(0).optional().default(0),

  // Momentum metrics
  peakMomentum: z.number().optional(),
  avgMomentum: z.number().optional(),
  momentumTrend: z.string().max(50).optional(),

  // Behavioral signals
  totalAnswerChanges: z.number().int().min(0).optional().default(0),
  helpfulChanges: z.number().int().min(0).optional().default(0),
  harmfulChanges: z.number().int().min(0).optional().default(0),
  firstInstinctAccuracy: z.number().min(0).max(100).optional(),

  // Confidence calibration
  avgInferredConfidence: z.number().min(0).max(100).optional(),
  highConfidenceAccuracy: z.number().min(0).max(100).optional(),
  lowConfidenceAccuracy: z.number().min(0).max(100).optional(),
  calibrationScore: z.number().optional(),

  // Time pressure analysis
  questionsUnderPar: z.number().int().min(0).optional().default(0),
  questionsOverPar: z.number().int().min(0).optional().default(0),
  rushingAccuracy: z.number().min(0).max(100).optional(),
  deliberateAccuracy: z.number().min(0).max(100).optional(),

  // Fatigue indicators
  early10Accuracy: z.number().min(0).max(100).optional(),
  late10Accuracy: z.number().min(0).max(100).optional(),
  staminaFade: z.number().optional(),

  // PANCE distribution
  distributionScore: z.number().optional(),
  systemsCovered: z.array(z.string().max(100)).max(20).optional().default([]),

  // Predicted score
  predictedScore: z.number().optional(),
  scoreConfidence: z.string().max(50).optional(),
  passLikelihood: z.number().min(0).max(100).optional(),

  // Session settings
  mode: z.string().max(50).optional(),
  focus: z.string().max(50).optional(),
  difficulty: z.string().max(50).optional(),

  // Device info
  deviceType: z.string().max(100).optional(),
  browserName: z.string().max(100).optional(),
});

/**
 * Session analytics GET query parameters
 */
export const sessionAnalyticsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeProfile: z
    .string()
    .default('true')
    .optional()
    .transform((val) => val !== 'false'),
});

/**
 * SRS summary analytics (empty schema - no query params)
 */
export const srsSummaryQuerySchema = z.object({}).optional().default({});

// ============================================================================
// DRILL ENDPOINT SCHEMAS
// ============================================================================

/**
 * Antibiotic class filter validation
 * Used by: /api/drills/antibiotics
 */
export const antibioticQuerySchema = z.object({
  class: z.enum(['Gram Positive', 'Gram Negative', 'Atypical', 'Fungal', 'Anaerobic']).optional(),
});

/**
 * Code Blue drill query parameters
 * Used by: /api/drills/code-blue
 */
export const codeBlueQuerySchema = z.object({
  category: z.enum(['ACLS', 'PALS', 'BLS', 'Critical Care']).optional(),
  count: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Fluid & Electrolyte drill query parameters
 * Used by: /api/drills/fluids
 */
export const fluidsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(1),
  category: z.enum(['fena', 'anion_gap', 'free_water_deficit', 'maintenance_fluids']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

/**
 * Lab cases drill query parameters
 * Used by: /api/drills/lab-cases (GET)
 */
export const labCasesQuerySchema = z.object({
  category: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  shuffle: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
});

/**
 * Lab cases POST action schema
 * Used by: /api/drills/lab-cases (POST)
 */
export const labCasesActionSchema = z.object({
  action: z.enum(['getDiagnoses']),
});

/**
 * Media drill query parameters
 * Used by: /api/drills/media
 */
export const mediaDrillQuerySchema = z.object({
  modality: z.enum(['ecg', 'derm', 'radiology']).optional(),
  count: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Pharm drill query parameters
 * Used by: /api/drills/pharm
 */
export const pharmDrillQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(10),
  category: z
    .enum([
      'mechanism',
      'side_effect',
      'contraindication',
      'drug_class',
      'antidote',
      'interaction',
      'clinical_use',
    ])
    .optional(),
});

/**
 * Related content request body
 * Used by: /api/drills/related-content
 */
export const relatedContentSchema = z.object({
  category: z.enum(['physiology', 'anatomy', 'lab', 'ecg', 'procedure', 'finding', 'imaging']),
  tags: z.array(z.string().max(100)).max(20).optional().default([]),
  conceptId: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * Content enrichment request
 */
export const contentEnrichmentSchema = z
  .object({
    conditionId: conditionIdSchema,
    fields: z
      .array(
        z.enum(['differentials', 'workup', 'treatment', 'complications', 'prognosis', 'guidelines'])
      )
      .min(1),
    regenerate: z.boolean().default(false),
  })
  .strict();

/**
 * Question quality flag
 */
export const questionFlagSchema = z
  .object({
    questionId: uuidSchema,
    reason: z.enum([
      'incorrect_answer',
      'ambiguous_wording',
      'outdated_guideline',
      'poor_distractors',
      'duplicate',
      'other',
    ]),
    details: z.string().max(1000).optional(),
    reportedBy: uuidSchema,
  })
  .strict();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Generic validation helper with error formatting
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((err) => {
    const path = err.path.join('.');
    const contextPrefix = context ? `[${context}] ` : '';
    return `${contextPrefix}${path}: ${err.message}`;
  });

  return { success: false, errors };
}

/**
 * Middleware-style validator
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        throw new Error(`Validation failed: ${formattedErrors}`);
      }
      throw error;
    }
  };
}

// ============================================================================
// GEMINI STREAM REQUEST
// ============================================================================

/**
 * Gemini streaming API request body
 * Used by: /api/gemini/stream
 */
export const geminiStreamRequestSchema = z
  .object({
    modelName: z.string().min(1).max(64).default('gemini-2.5-flash'),
    prompt: z
      .string()
      .min(1, 'Prompt is required')
      .max(128 * 1024, 'Prompt too long'),
    temperature: z.number().min(0).max(2).default(0.8),
    /** Optional: use Gemini context cache (e.g. cachedContents/xxx) for "Chat with your Library" */
    cachedContent: z.string().min(1).startsWith('cachedContents/').optional(),
    /** Optional: Gemini 3 thinking level for reasoning control */
    thinkingLevel: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  })
  .strict();

export const validateGeminiStreamRequest = createValidator(geminiStreamRequestSchema);

// ============================================================================
// PRE-BUILT VALIDATORS
// ============================================================================

export const validateQuestionGeneration = createValidator(questionGenerationSchema);
export const validateReviewSubmission = createValidator(reviewSubmissionSchema);
export const validateSessionGeneration = createValidator(sessionGenerationSchema);
export const validatePerformanceMetrics = createValidator(performanceMetricsSchema);
export const validateContentEnrichment = createValidator(contentEnrichmentSchema);
export const validateQuestionFlag = createValidator(questionFlagSchema);

// ============================================================================
// PAYLOAD SIZE LIMITS
// ============================================================================

/**
 * Enforce maximum payload size (prevents DoS via large requests)
 */
export const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Get UTF-8 byte length (edge-compatible; avoids Node.js Buffer)
 */
function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export function validatePayloadSize(payload: string | object): boolean {
  const size =
    typeof payload === 'string' ? utf8ByteLength(payload) : utf8ByteLength(JSON.stringify(payload));

  return size <= MAX_PAYLOAD_SIZE;
}

/**
 * Check payload size and throw error if exceeded
 */
export function enforcePayloadSize(payload: string | object, context?: string): void {
  if (!validatePayloadSize(payload)) {
    const contextStr = context ? ` for ${context}` : '';
    throw new Error(
      `Payload size exceeds maximum allowed (${MAX_PAYLOAD_SIZE} bytes)${contextStr}`
    );
  }
}
