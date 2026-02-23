/**
 * POST /api/study/session/generate
 *
 * Generates a new study session with questions selected using the
 * Priority Waterfall algorithm (Blueprint + FSRS + Interleaving).
 *
 * **IMPORTANT:** Only 'mainSession' mode is currently implemented.
 * 'review' and 'focused' modes return 501 Not Implemented.
 * For review/SRS sessions, use GET /api/questions/session with focus: 'review'.
 *
 * Request Body:
 * {
 *   mode: 'mainSession' | 'review' | 'focused',  // Only 'mainSession' implemented
 *   size: number (default 20),
 *   systemFocus?: string (for focused mode - not implemented)
 * }
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { authenticatedEndpoint } from '../../_shared/middleware';
import {
  getQuestionByDifficulty,
  DifficultyLevel,
} from '../../../../lib/services/progressiveDifficultyService';
import { MainSessionQuestionSelector } from '../../../../lib/services/mainSessionQuestionSelector';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { z } from 'zod';

// Define Zod schema for request validation
const SessionGenerationSchema = z.object({
  mode: z.enum(['mainSession', 'review', 'focused']),
  size: z.number().int().min(1).max(50).default(20),
  systemFocus: z.string().optional(),
  initialDifficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export const onRequestPost = authenticatedEndpoint(SessionGenerationSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/study/session/generate');

  try {
    const { mode, size, systemFocus, initialDifficulty } = validated;

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Generate session based on mode
      if (mode === 'mainSession') {
        let result;
        if (initialDifficulty) {
          // Adaptive mode: Fetch questions based on difficulty
          const questions = [];
          for (let i = 0; i < size; i++) {
            const q = await getQuestionByDifficulty(auth.userId, initialDifficulty);
            if (q) questions.push(q);
          }
          result = {
            questionIds: questions.map((q) => q.id),
            questions,
            priorityBreakdown: { A: 0, B: 0, C: size }, // Simplified for adaptive
            deficitsAddressed: [],
            interleavingEnforced: true,
            interleavingViolations: 0,
            systemDistribution: {},
          };
        } else {
          // Standard mode: Use the existing selector
          const selector = new MainSessionQuestionSelector(prisma);
          result = await selector.generateSession(auth.userId, size);
        }

        // Create StudySession record
        const now = new Date();
        const session = await prisma.studySession.create({
          data: {
            id: crypto.randomUUID(),
            userId: auth.userId,
            startedAt: now,
            updatedAt: now,
            sessionType: 'mixed',
            mode: 'mainSession',
            difficulty: initialDifficulty || 'adaptive',
            systemsTargeted: Object.keys(
              result.questions.reduce(
                (acc, q) => {
                  acc[q.system] = true;
                  return acc;
                },
                {} as Record<string, boolean>
              )
            ),
          },
        });

        return {
          data: {
            sessionId: session.id,
            mode: 'mainSession',
            questionIds: result.questionIds,
            questions: result.questions,
            priorityBreakdown: result.priorityBreakdown,
            deficitsAddressed: result.deficitsAddressed,
            interleavingEnforced: result.interleavingEnforced,
            interleavingViolations: result.interleavingViolations,
            systemDistribution: result.systemDistribution,
            size: result.questionIds.length,
            message: generateSessionMessage(result),
            initialDifficulty,
          },
        };
      }

      // TODO: Implement 'review' and 'focused' modes
      return {
        status: 501,
        error: `Mode '${mode}' not yet implemented. Use 'mainSession'.`,
      };
    } catch (error) {
      logger.error('Error generating session:', error);
      return {
        status: 500,
        error: 'Failed to generate session',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  } catch (error) {
    logger.error('Unexpected error in session generation:', error);
    return {
      status: 500,
      error: 'Unexpected error in session generation',
    };
  }
});

function generateSessionMessage(result: {
  priorityBreakdown: { A: number; B: number; C: number };
  deficitsAddressed: { system: string; deficitPercent: number }[];
}): string {
  const { priorityBreakdown, deficitsAddressed } = result;

  if (deficitsAddressed.length > 0) {
    const systems = deficitsAddressed.map((d) => d.system).join(', ');
    return `Session includes extra ${systems} questions to balance your PANCE blueprint distribution.`;
  }

  if (priorityBreakdown.B > priorityBreakdown.C) {
    return 'Session focuses on cards due for review to strengthen your retention.';
  }

  return 'Session includes new content to expand your knowledge base.';
}
