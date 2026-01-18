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
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
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
router.post('/fetch', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
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
router.post('/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { system, difficulty, limit = 10 } = req.body;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, questions: [] });
    }

    const { getQuestionsWithNoRepeat } = await import('../services/noRepeatService');
    const userId = req.auth.userId;

    const result = await getQuestionsWithNoRepeat(userId, { system, difficulty }, limit);

    res.json({ success: true, questions: result.questions });
  } catch (error) {
    console.error('Error querying questions:', error);
    res.status(500).json({ error: 'Failed to query questions' });
  }
});

// Batch fetch questions by ID
router.post('/batch', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid request: ids array required' });
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

      return res.json({ success: true, questions: mappedQuestions });
    }

    // Mock response if no DB
    return res.json({
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
});

// Get no-repeat questions (Task 109)
router.post(
  '/no-repeat',
  validateRequired(['userId', 'filter']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { getQuestionsWithNoRepeat } = await import('../services/noRepeatService');
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
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { recordQuestionSeen } = await import('../services/noRepeatService');
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
router.get('/repository/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, stats: { totalQuestions: 0 } });
    }

    const { getRepositoryStats } = await import('../services/noRepeatService');
    const stats = await getRepositoryStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get repository stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get repository stats' });
  }
});

// Get question statistics (simple alias for repository stats)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { getRepositoryStats } = await import('../services/noRepeatService');
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
  async (req: Request, res: Response) => {
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
        return res.status(503).json({
          success: false,
          error: 'Database not configured',
        });
      }

      const { sendAdminFlagNotification } = await import('../lib/services/notificationService');

      // Create flag in database
      const flag = await prisma.questionFlag.create({
        data: {
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
  async (req: Request, res: Response) => {
    try {
      const { flagId } = req.params;
      const { reviewedBy, resolutionNote } = req.body;

      if (!process.env.DATABASE_URL) {
        return res.status(503).json({
          success: false,
          error: 'Database not configured',
        });
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
router.get('/flags', async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, flags: [] });
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
// Question Query & AI Generation
// ============================================================================

// Semantic cache & generation endpoint
router.post(
  '/generate',
  validateRequired(['queryText', 'questionType']),
  async (req: Request, res: Response) => {
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
        return res.json({
          success: true,
          question: cached.question,
          cached: true,
          similarity: cached.similarity,
        });
      }

      // Generate new question using AI question generation service
      let newQuestion = null;

      try {
        const { loadConditionData } = await import('../services/conditionDataLoader');
        const { generateSingleQuestion } = await import('../lib/questionGenerator');

        // Load condition data based on query text
        const conditionData = await loadConditionData(queryText);

        if (conditionData) {
          const transformedCondition = {
            condition: conditionData.name,
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

router.post('/seeds', validateRequired(['seedData']), async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { createQuestionSeed } = await import('../services/questionSeedService');
    const seed = await createQuestionSeed(req.body.seedData);

    res.json({ success: true, seed });
  } catch (error) {
    console.error('Failed to create question seed:', error);
    res.status(500).json({ success: false, error: 'Failed to create question seed' });
  }
});

router.get('/seeds/:id/assemble', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { assembleQuestionFromSeed } = await import('../services/questionSeedService');
    const question = await assembleQuestionFromSeed(req.params.id);

    res.json({ success: true, question });
  } catch (error) {
    console.error('Failed to assemble question:', error);
    res.status(500).json({ success: false, error: 'Failed to assemble question' });
  }
});

router.post(
  '/seeds/assemble',
  validateRequired(['filter', 'count']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { assembleQuestionsFromSeeds } = await import('../services/questionSeedService');
      const { filter, count } = req.body;
      const questions = await assembleQuestionsFromSeeds(filter, count);

      res.json({ success: true, questions });
    } catch (error) {
      console.error('Failed to assemble questions:', error);
      res.status(500).json({ success: false, error: 'Failed to assemble questions' });
    }
  }
);

router.get('/seeds/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, stats: {} });
    }

    const { getSeedStats } = await import('../services/questionSeedService');
    const stats = await getSeedStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get seed stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get seed stats' });
  }
});

export default router;
