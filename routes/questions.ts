/**
 * Questions Routes
 *
 * Handles all question-related API endpoints including:
 * - Fetching questions (bank, no-repeat, batch)
 * - Flagging system
 * - Question generation (AI)
 * - Seed management
 * - Drill submissions (grading)
 *
 * Extracted from server.ts for modularity.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import { requireAdmin } from '../lib/middleware/adminAuth';
import { validateRequired, validateEnum } from '../lib/middleware/validation';

const router = Router();

// ============================================================================
// Question Fetching & Management
// ============================================================================

// Fetch questions from the database-first question bank
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { system, difficulty } = req.query;
    const limit = Number(req.query.limit) || 10;

    const { getQuestionsWithFallback } = await import('../lib/services/questionBankService');

    const result = await getQuestionsWithFallback({
      system: system ? String(system) : undefined,
      difficulty: difficulty ? String(difficulty) : undefined,
      limit,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Fetch questions for a user (with no-repeat logic) - POST variant
router.post('/fetch', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { system, difficulty, limit = 10 } = req.body || {};
    const { getQuestionsWithFallback } = await import('../lib/services/questionBankService');

    const result = await getQuestionsWithFallback({
      system: system ? String(system) : undefined,
      difficulty: difficulty ? String(difficulty) : undefined,
      limit: Number(limit) || 10,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Question Query Route (Authenticated No-Repeat)
router.post(
  '/query',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { system, difficulty, limit = 10 } = req.body;

      if (!process.env.DATABASE_URL) {
        res.json({ success: true, questions: [] });
      }

      const { getQuestionsWithNoRepeat } = await import('../services/core/noRepeatService');
      const userId = req.auth!.userId;

      const result = await getQuestionsWithNoRepeat(userId, { system, difficulty }, limit);

      res.json({ success: true, questions: result.questions });
    } catch (error) {
      console.error('Error querying questions:', error);
      res.status(500).json({ error: 'Failed to query questions' });
    }
  }
);

// Batch fetch questions by ID
router.post(
  '/batch',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids)) {
        res.status(400).json({ error: 'Invalid request: ids array required' });
        return;
      }

      if (process.env.DATABASE_URL) {
        const questions = await prisma.preGeneratedQuestion.findMany({
          where: {
            id: { in: ids },
          },
        });

        // Map to frontend Question format
        const mappedQuestions = questions.map((q) => {
          const qData = q.questionData as any;
          return {
            id: q.id,
            question: qData?.question || qData?.text || 'Question text missing',
            options: qData?.options || [],
            correctAnswer: qData?.correctAnswer || '',
            explanation: qData?.explanation || '',
            system: q.system || undefined,
            difficulty: q.difficulty || 'medium',
            type: q.questionType || 'mcq',
          };
        });

        res.json({ success: true, questions: mappedQuestions });
      }

      // Mock response if no DB
      res.json({
        success: true,
        questions: ids.map((id) => ({
          id,
          question: `Mock Question for ID ${id}`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A',
          explanation: 'This is a mock explanation because the database is not connected.',
          system: 'General',
          difficulty: 'medium',
        })),
      });
    } catch (error) {
      console.error('Error fetching batch questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  }
);

// Get no-repeat questions (Task 109)
router.post(
  '/no-repeat',
  validateRequired(['userId', 'filter']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { getQuestionsWithNoRepeat } = await import('../services/core/noRepeatService');
      const { userId, filter, limit = 10 } = req.body;
      const result = await getQuestionsWithNoRepeat(userId, filter, limit);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Failed to get questions:', error);
      res.status(500).json({ success: false, error: 'Failed to get questions' });
    }
  }
);

// Record question seen
router.post(
  '/history',
  validateRequired(['userId', 'questionId', 'metadata']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { recordQuestionSeen } = await import('../services/core/noRepeatService');
      const { userId, questionId, metadata } = req.body;
      await recordQuestionSeen(userId, questionId, metadata);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to record question history:', error);
      res.status(500).json({ success: false, error: 'Failed to record question history' });
    }
  }
);

// Get golden repository statistics
router.get('/repository/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, stats: { totalQuestions: 0 } });
    }

    const { getRepositoryStats } = await import('../services/core/noRepeatService');
    const stats = await getRepositoryStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get repository stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get repository stats' });
  }
});

// Get question statistics (simple alias for repository stats)
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { getRepositoryStats } = await import('../services/core/noRepeatService');
    const stats = await getRepositoryStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// ============================================================================
// Flagging System
// ============================================================================

// Flag a question
router.post(
  '/flag',
  validateRequired(['userId', 'questionId', 'flagType', 'description']),
  validateEnum('flagType', ['typo', 'incorrect_answer', 'unclear', 'outdated', 'other']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        userEmail,
        userFirstName,
        questionId,
        questionText,
        correctAnswer,
        topic,
        system,
        flagType,
        description,
        priority,
      } = req.body;

      if (!process.env.DATABASE_URL) {
        res.status(503).json({
          success: false,
          error: 'Database not configured',
        });
        return;
      }

      const { sendAdminFlagNotification } = await import('../lib/services/notificationService');

      // Create flag in database
      const flag = await prisma.questionFlag.create({
        data: {
          id: uuidv4(),
          userId,
          userEmail: userEmail || null,
          userFirstName: userFirstName || null,
          questionId,
          questionText: questionText || '',
          correctAnswer: correctAnswer || null,
          topic: topic || null,
          system: system || null,
          flagType,
          description,
          priority: priority || 'medium',
          updatedAt: new Date(),
        },
      });

      // Send notification to admin (if configured)
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendAdminFlagNotification(adminEmail, {
          id: flag.id,
          questionId,
          questionText: questionText || '',
          flagType,
          description,
          userEmail,
          userFirstName,
        });
      }

      res.json({
        success: true,
        flagId: flag.id,
        message: 'Question flagged successfully. We will review it soon!',
      });
    } catch (error) {
      console.error('Failed to flag question:', error);
      res.status(500).json({ success: false, error: 'Failed to flag question' });
    }
  }
);

// Resolve a flag (Admin-only)
router.post(
  '/flag/:flagId/resolve',
  requireAdmin(),
  validateRequired(['reviewedBy', 'resolutionNote']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { flagId } = req.params;
      const { reviewedBy, resolutionNote } = req.body;

      if (!process.env.DATABASE_URL) {
        res.status(503).json({
          success: false,
          error: 'Database not configured',
        });
        return;
      }

      const { sendFlagResolvedNotification } = await import('../lib/services/notificationService');

      // Update flag status
      const flag = await prisma.questionFlag.update({
        where: { id: flagId },
        data: {
          status: 'fixed',
          reviewedBy,
          reviewedAt: new Date(),
          resolutionNote,
        },
      });

      // Send notification to user
      if (flag.userEmail) {
        const notificationSent = await sendFlagResolvedNotification({
          userEmail: flag.userEmail,
          userFirstName: flag.userFirstName || undefined,
          questionId: flag.questionId,
          questionText: flag.questionText,
          flagType: flag.flagType as any,
          resolutionNote,
        });

        if (notificationSent) {
          await prisma.questionFlag.update({
            where: { id: flagId },
            data: {
              notificationSent: true,
              notifiedAt: new Date(),
            },
          });
        }
      }

      res.json({
        success: true,
        message: 'Flag resolved and user notified',
      });
    } catch (error) {
      console.error('Failed to resolve flag:', error);
      res.status(500).json({ success: false, error: 'Failed to resolve flag' });
    }
  }
);

// Get all flags (Admin-only)
router.get('/flags', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority } = req.query;

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, flags: [] });
    }

    const flags = await prisma.questionFlag.findMany({
      where: {
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, flags });
  } catch (error) {
    console.error('Failed to get flags:', error);
    res.status(500).json({ success: false, error: 'Failed to get flags' });
  }
});

// ============================================================================
// Custom Study Session (parity with CF POST /api/questions/custom-session)
// ============================================================================

router.post(
  '/custom-session',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ error: 'Database not configured' });
      return;
      }

      const body = req.body as { config?: Record<string, unknown>; count?: number };
      const config = body?.config ?? {};
      const requestedCount = Math.min(Number(body?.count) || 10, 50);

      const systems = (config.systems as string[] | undefined) ?? [];
      const subcategories = (config.subcategories as string[] | undefined) ?? [];
      const conditions = (config.conditions as string[] | undefined) ?? [];
      const focusAreas = (config.focusAreas as string[] | undefined) ?? [];
      const difficulty = config.difficulty as string | undefined;

      const whereConditions: Record<string, unknown>[] = [];

      if (systems.length > 0) {
        whereConditions.push({ system: { in: systems } });
      }
      if (subcategories.length > 0) {
        whereConditions.push({ conditionId: { in: subcategories } });
      }
      if (conditions.length > 0) {
        whereConditions.push({ conditionId: { in: conditions } });
      }

      const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

      const preGenRecords = await prisma.preGeneratedQuestion.findMany({
        where,
        take: requestedCount * 3,
        orderBy: { generatedAt: 'asc' },
      });

      type PoolRow = (typeof preGenRecords)[0];
      let filtered = preGenRecords as PoolRow[];
      if (focusAreas.length > 0) {
        filtered = preGenRecords.filter((r) => {
          const data = (r.questionData as Record<string, unknown>) || {};
          const fa = data.focusArea as string | undefined;
          return !fa || focusAreas.includes(fa);
        }) as PoolRow[];
      }

      if (difficulty && difficulty !== 'same') {
        filtered = [...filtered].sort((a, b) => {
          const dataA = (a.questionData as Record<string, unknown>) || {};
          const dataB = (b.questionData as Record<string, unknown>) || {};
          const aDiff = (typeof dataA.difficulty === 'number' ? dataA.difficulty : 50) as number;
          const bDiff = (typeof dataB.difficulty === 'number' ? dataB.difficulty : 50) as number;
          return difficulty === 'easier' ? aDiff - bDiff : bDiff - aDiff;
        }) as PoolRow[];
      }

      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, requestedCount);

      const letters = ['A', 'B', 'C', 'D'];
      const questions = selected.map((r) => {
        const data = (r.questionData as Record<string, unknown>) || {};
        const optsRaw = data.options ?? data.answers ?? data.choices;
        const opts: string[] = Array.isArray(optsRaw) ? optsRaw : [];
        let correct = (data.correctAnswer as string) || 'A';
        if (typeof data.correctAnswerIndex === 'number') {
          correct = letters[data.correctAnswerIndex] ?? 'A';
        }
        if (typeof data.correctIndex === 'number') {
          correct = letters[data.correctIndex] ?? 'A';
        }
        const correctIndex = opts.findIndex((o) => o === correct || (typeof o === 'string' && o.includes(correct)));
        return {
          id: r.id,
          question: (data.question as string) || (data.text as string) || 'Question text missing',
          options: opts,
          correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
          rationale: (data.explanation as string) || (data.rationale as string) || '',
          topic: (data.topic as string) || r.system || '',
          system: r.system ?? undefined,
          subcategory: (data.subcategory as string) ?? null,
          conditionId: r.conditionId ?? undefined,
          condition: (data.condition as string) || 'Unknown',
          pearls: (data.pearls as string[]) || [],
          focusArea: (data.focusArea as string) ?? undefined,
          difficulty: (data.difficulty as number) ?? undefined,
        };
      });

      const totalAvailable = await prisma.preGeneratedQuestion.count({ where });
      let warning: string | undefined;
      if (questions.length < requestedCount) {
        warning = `Only ${questions.length} questions available matching your filters. Consider broadening your selection.`;
      }

      res.json({ questions, totalAvailable, warning });
    } catch (error) {
      console.error('Error fetching custom session questions:', error);
      res.status(500).json({ error: 'Failed to fetch custom session questions' });
    }
  }
);

// ============================================================================
// Question Pool (parity with CF /api/questions/pool)
// ============================================================================

router.get('/pool', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const count = Math.min(Number(req.query.count) || 10, 50);
    const system = (req.query.system as string) || undefined;
    const difficulty = (req.query.difficulty as string) || undefined;

    const where: Record<string, unknown> = {};
    if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;

    // Try PreGeneratedQuestion first (seeded by seed:question-pool)
    const preGenRecords = await prisma.preGeneratedQuestion.findMany({
      where,
      take: count * 3, // fetch extra for filtering
      orderBy: { generatedAt: 'asc' },
    });

    const poolRemaining = await prisma.preGeneratedQuestion.count({ where });
    const letters = ['A', 'B', 'C', 'D'];

    const poolQuestions = preGenRecords.slice(0, count).map((r) => {
      const data = (r.questionData as Record<string, unknown>) || {};
      const optsRaw = data.options ?? data.answers ?? data.choices;
      const opts: string[] = Array.isArray(optsRaw) ? optsRaw : [];
      let correct = (data.correctAnswer as string) || 'A';
      if (!correct && typeof data.correctAnswerIndex === 'number') {
        correct = letters[data.correctAnswerIndex] ?? 'A';
      }
      if (!correct && typeof data.correctIndex === 'number') {
        correct = letters[data.correctIndex] ?? 'A';
      }
      return {
        id: r.id,
        vignette: (data.vignette as string) || undefined,
        question: (data.question as string) || 'Question text missing',
        options: opts,
        correctAnswer: correct,
        explanation: (data.explanation as string) || '',
        system: r.system || 'General',
        difficulty: r.difficulty || 'medium',
        tags: (data.tags as string[]) || [],
        conditionId: r.conditionId ?? undefined,
        source: 'pool',
      };
    });

    // Fallback to Question table if PreGeneratedQuestion is empty
    let questions = poolQuestions;
    let available = poolRemaining;
    if (questions.length === 0) {
      const { getQuestionsWithFallback } = await import('../lib/services/questionBankService');
      const { questions: fallbackQs, total } = await getQuestionsWithFallback({
        system,
        difficulty,
        limit: count,
      });
      questions = fallbackQs.map((q) => {
        const opts = q.options || [];
        const correctIdx = opts.findIndex(
          (o) => o === (q as { correctAnswer?: string }).correctAnswer || o.includes((q as { correctAnswer?: string }).correctAnswer ?? '')
        );
        const letter = (correctIdx >= 0 ? letters[correctIdx] : undefined) ?? 'A';
        return {
          id: q.id,
          vignette: q.vignette || undefined,
          question: q.question,
          options: opts,
          correctAnswer: letter,
          explanation: q.explanation,
          system: q.system || 'General',
          difficulty: q.difficulty || 'medium',
          tags: q.tags || [],
          conditionId: (q as { conditionId?: string }).conditionId ?? undefined,
          source: 'pool',
        };
      });
      available = total;
    }

    const POOL_LOW_THRESHOLD = 20;
    res.json({
      questions,
      poolStatus: {
        available,
        needsGeneration: available < POOL_LOW_THRESHOLD,
        threshold: POOL_LOW_THRESHOLD,
      },
    });
  } catch (error) {
    console.error('Error fetching pool questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions from pool' });
  }
});

// ============================================================================
// Question Query & AI Generation
// ============================================================================

// Semantic cache & generation endpoint
router.post(
  '/generate',
  validateRequired(['queryText', 'questionType']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { queryText, questionType, system, difficulty } = req.body;

      const { findSimilarCachedQuestion, cacheGeneratedQuestion } =
        await import('../lib/services/semanticCacheService');

      // Check cache first
      const cached = await findSimilarCachedQuestion({
        queryText,
        questionType,
        system,
        difficulty,
      });

      if (cached) {
        res.json({
          success: true,
          question: cached.question,
          cached: true,
          similarity: cached.similarity,
        });
      }

      // Generate new question using AI question generation service
      let newQuestion = null;

      try {
        const { loadConditionData } = await import('../services/core/conditionDataLoader');
        const { generateSingleQuestion } = await import('../lib/questionGenerator');

        // Load condition data based on query text
        const conditionData = await loadConditionData(queryText);

        if (conditionData) {
          const transformedCondition = {
            condition: conditionData.condition,
            sections: {
              overview: conditionData.content.overview || '',
              etiology: conditionData.content.etiologyPathophysiology || '',
              clinicalPresentation: conditionData.content.clinicalPresentation || '',
              diagnostics: conditionData.content.diagnostics?.notes || '',
              treatment: (
                conditionData.content.treatment ||
                conditionData.content.management ||
                []
              ).join('\n'),
            },
          };

          // Generate question using AI
          const generatedQ = await generateSingleQuestion(
            transformedCondition,
            questionType as any
          );

          if (generatedQ) {
            newQuestion = {
              ...generatedQ,
              system: system || conditionData.system,
              difficulty: difficulty || 'medium',
              generatedAt: new Date().toISOString(),
              metadata: {
                originalQuery: queryText,
                cached: false,
              },
            };
          }
        }
      } catch (generationError) {
        console.error('Failed to generate question with AI:', generationError);
      }

      // Fallback if generation failed
      if (!newQuestion) {
        newQuestion = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: questionType,
          system: system || null,
          difficulty: difficulty || 'medium',
          text: `Unable to generate question for: ${queryText}. Please try a different condition or query.`,
          options:
            questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : undefined,
          correctAnswer: questionType === 'mcq' ? 'Option A' : undefined,
          explanation: 'Question generation failed. This is a placeholder response.',
          generatedAt: new Date().toISOString(),
          metadata: {
            originalQuery: queryText,
            cached: false,
            generationFailed: true,
          },
        };
      }

      // Cache the result
      await cacheGeneratedQuestion(
        {
          queryText,
          questionType,
          system,
          difficulty,
        },
        newQuestion
      );

      res.json({
        success: true,
        question: newQuestion,
        cached: false,
      });
    } catch (error) {
      console.error('Failed to generate question:', error);
      res.status(500).json({ success: false, error: 'Failed to generate question' });
    }
  }
);

// Seeds Management (Tasks 111)

router.post(
  '/seeds',
  validateRequired(['seedData']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { createQuestionSeed } = await import('../services/core/questionSeedService');
      const seed = await createQuestionSeed(req.body.seedData);

      res.json({ success: true, seed });
    } catch (error) {
      console.error('Failed to create question seed:', error);
      res.status(500).json({ success: false, error: 'Failed to create question seed' });
    }
  }
);

router.get('/seeds/:id/assemble', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ success: false, error: 'Database not configured' });
      return;
    }

    const seedId = req.params.id;
    if (!seedId) {
      res.status(400).json({ success: false, error: 'Seed id is required' });
      return;
    }
    const { assembleQuestionFromSeed } = await import('../services/core/questionSeedService');
    const question = await assembleQuestionFromSeed(seedId);

    res.json({ success: true, question });
  } catch (error) {
    console.error('Failed to assemble question:', error);
    res.status(500).json({ success: false, error: 'Failed to assemble question' });
  }
});

router.post(
  '/seeds/assemble',
  validateRequired(['filter', 'count']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { assembleQuestionsFromSeeds } = await import('../services/core/questionSeedService');
      const { filter, count } = req.body;
      const questions = await assembleQuestionsFromSeeds(filter, count);

      res.json({ success: true, questions });
    } catch (error) {
      console.error('Failed to assemble questions:', error);
      res.status(500).json({ success: false, error: 'Failed to assemble questions' });
    }
  }
);

router.get('/seeds/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, stats: {} });
    }

    const { getSeedStats } = await import('../services/core/questionSeedService');
    const stats = await getSeedStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get seed stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get seed stats' });
  }
});

export default router;
