/**
 * API: POST /api/study/session/generate
 *
 * Generates a study session by selecting questions through the concept-level
 * FSRS pipeline. Bridges blueprint resolution → concept selection → question serving.
 *
 * Request body:
 *   mode: 'mainSession' | 'cram' | 'rapid_recall'
 *   size: number (default 20)
 *   blueprintWeights: Record<string, number>
 *   gatedSystems?: string[]
 *   boostSystems?: string[]
 *   suppressSystems?: string[]
 *   perSystemCaps?: Record<string, number>
 *   blueprintStage?: string
 *   blueprintExamTypes?: string[]
 *   blueprintLabel?: string
 *
 * Response:
 *   sessionId: string
 *   questions: ConceptSelectionResult[]
 *   meta: { stage, label, size, overdueCount, newCount }
 *
 * Called by CoreAdaptiveSession.tsx during initialization (Step 3).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { buildStudySession } from '../../../../lib/services/conceptQuestionSelector';

// ─── Validation Schema ──────────────────────────────────────────────────────

const SessionGenerateSchema = z.object({
  body: z.object({
    mode: z.enum(['mainSession', 'cram', 'rapid_recall']).default('mainSession'),
    size: z.number().int().min(1).max(50).default(20),
    blueprintWeights: z.record(z.string(), z.number()),
    gatedSystems: z.array(z.string()).optional(),
    boostSystems: z.array(z.string()).optional(),
    suppressSystems: z.array(z.string()).optional(),
    perSystemCaps: z.record(z.string(), z.number()).optional(),
    blueprintStage: z.string().optional(),
    blueprintExamTypes: z.array(z.string()).optional(),
    blueprintLabel: z.string().optional(),
    urgencyMultiplier: z.number().min(0).max(3).optional(),
  }),
});

// ─── CORS ───────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  SessionGenerateSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/study/session/generate');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const {
        mode,
        size,
        blueprintWeights,
        gatedSystems,
        boostSystems,
        suppressSystems,
        perSystemCaps,
        blueprintStage,
        blueprintExamTypes,
        blueprintLabel,
        urgencyMultiplier,
      } = validated.body;

      // Look up internal user ID from Clerk auth
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      // Build suppression factors from the anti-gaming constraints
      const systemSuppressions: Record<string, number> = {};

      // Suppressed systems get reduced weighting
      if (suppressSystems) {
        for (const sys of suppressSystems) {
          systemSuppressions[sys] = 0.3; // Suppress to 30% of normal weight
        }
      }

      // Boosted systems get increased weighting
      if (boostSystems) {
        for (const sys of boostSystems) {
          systemSuppressions[sys] = 1.5; // Boost to 150% of normal weight
        }
      }

      // Per-system caps override individual factors
      if (perSystemCaps) {
        for (const [sys, cap] of Object.entries(perSystemCaps)) {
          systemSuppressions[sys] = cap;
        }
      }

      // Gated systems get zeroed out entirely
      if (gatedSystems) {
        for (const sys of gatedSystems) {
          systemSuppressions[sys] = 0;
        }
      }

      // Resolve blueprint into the format expected by buildStudySession
      // Split flat weights into system and taskType weights
      const NCCPA_TASK_TYPES = new Set([
        'DIAGNOSIS', 'CLINICAL_THERAPEUTICS', 'PHARMACEUTICAL_THERAPEUTICS',
        'DIAGNOSTIC_STUDIES', 'HISTORY_PE', 'HEALTH_MAINTENANCE', 'BASIC_SCIENCE',
      ]);

      const systemWeights: Record<string, number> = {};
      const taskTypeWeights: Record<string, number> = {};

      for (const [key, value] of Object.entries(blueprintWeights)) {
        if (NCCPA_TASK_TYPES.has(key)) {
          taskTypeWeights[key] = value;
        } else {
          systemWeights[key] = value;
        }
      }

      // If no task type weights were provided, use NCCPA defaults
      if (Object.keys(taskTypeWeights).length === 0) {
        taskTypeWeights.DIAGNOSIS = 0.18;
        taskTypeWeights.CLINICAL_THERAPEUTICS = 0.18;
        taskTypeWeights.PHARMACEUTICAL_THERAPEUTICS = 0.18;
        taskTypeWeights.HISTORY_PE = 0.16;
        taskTypeWeights.DIAGNOSTIC_STUDIES = 0.14;
        taskTypeWeights.HEALTH_MAINTENANCE = 0.10;
        taskTypeWeights.BASIC_SCIENCE = 0.06;
      }

      // Generate session via concept-level selector
      const questions = await buildStudySession(
        prisma,
        user.id,
        {
          systems: systemWeights,
          taskTypes: taskTypeWeights,
        },
        size,
        systemSuppressions,
        {
          debug: (msg: string, data?: Record<string, unknown>) =>
            logger.info(msg, data ?? {}),
          warn: (msg: string, data?: Record<string, unknown>) =>
            logger.warn(msg, data ?? {}),
        }
      );

      // Generate a unique session ID
      const sessionId = `session_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // Count overdue vs new for metadata
      const overdueCount = questions.filter(q => q.isOverdue).length;
      const newCount = questions.filter(q => q.isNewConcept).length;

      logger.info('Session generated', {
        sessionId,
        userId: user.id,
        mode,
        requestedSize: size,
        returnedSize: questions.length,
        overdueCount,
        newCount,
        stage: blueprintStage,
        label: blueprintLabel,
      });

      // Transform questions into the format expected by CoreAdaptiveSession / QuizView
      const formattedQuestions = questions.map((q, index) => ({
        id: q.variantId,
        questionId: q.variantId,
        conceptId: q.conceptId,
        conditionId: q.conditionId,
        system: q.system,
        taskType: q.taskType,
        cognitiveLevel: q.cognitiveLevel,
        difficulty: q.difficulty,
        questionData: {
          stem: q.question,
          question: q.question,
          vignette: q.vignette,
          options: q.options.map((opt, i) => ({
            value: opt,
            text: opt,
            label: opt,
          })),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        },
        meta: {
          blueprintWeight: q.blueprintWeight,
          isNewConcept: q.isNewConcept,
          isOverdue: q.isOverdue,
          sessionIndex: index,
        },
      }));

      return new Response(
        JSON.stringify({
          sessionId,
          questions: formattedQuestions,
          meta: {
            stage: blueprintStage ?? 'general',
            label: blueprintLabel ?? 'Study Session',
            examTypes: blueprintExamTypes ?? ['PANCE'],
            requestedSize: size,
            returnedSize: questions.length,
            overdueCount,
            newCount,
            systemSuppressions,
            urgencyMultiplier: urgencyMultiplier ?? null,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err: any) {
      logger.error('Session generation failed', { error: err.message });

      // Specific error handling
      if (err.code === 'P2025') {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: err.message ?? 'Failed to generate session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);