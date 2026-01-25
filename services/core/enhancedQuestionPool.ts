/**
 * Enhanced Question Pool Service
 *
 * Integrates Sprint A & B utilities:
 * - Step 1: Condition resolver (fuzzy matching)
 * - Step 2: NCCPA blueprint weighting
 * - Step 3: Question deduplication
 * - Step 4: Adaptive difficulty
 * - Step 5: Session interleaving
 *
 * This service wraps the existing question fetching with intelligent
 * selection, deduplication, adaptive difficulty, and proper interleaving.
 */

import { PrismaClient } from '@prisma/client';
import type { Question, SessionSettings } from '../../types';

// Sprint A utilities
import { resolveConditionId } from '../../lib/conditionResolver';
import { calculateSessionDistribution } from '../../lib/nccpa-question-weighting';

// Sprint B utilities
import { filterUnseenQuestions, getUserSeenQuestionIds } from '../../lib/questionDeduplication';
import {
  getUserPerformanceBySystem,
  getRecommendedDifficultiesBySystem,
} from '../../lib/adaptiveDifficulty';
import { ensureInterleaving, validateInterleaving } from '../../lib/sessionInterleaving';

// Existing services
import { convertPoolQuestion } from './questionService';

/**
 * Enhanced question selection with all Sprint A & B improvements
 */
export async function getEnhancedQuestionBatch(
  prisma: PrismaClient,
  userId: string,
  settings: SessionSettings,
  count: number = 10
): Promise<{
  questions: Question[];
  metadata: {
    usingAdaptiveDifficulty: boolean;
    usingDeduplication: boolean;
    usingInterleaving: boolean;
    usingNCCPAWeighting: boolean;
    filteredCount: number;
    interleavingValid: boolean;
  };
}> {
  const { focus } = settings;

  try {
    // STEP 1: Determine systems using NCCPA weighting
    let systemDistribution: Map<string, number>;
    let systems: string[];

    if (focus !== 'all') {
      // Single system focus
      systems = [focus.toUpperCase()];
      systemDistribution = new Map([[focus.toUpperCase(), count]]);
    } else {
      // Multi-system: use NCCPA blueprint
      systemDistribution = calculateSessionDistribution(count);
      systems = Array.from(systemDistribution.keys());
    }

    // STEP 2: Get adaptive difficulty per system
    const difficultyMap = await getRecommendedDifficultiesBySystem(
      prisma,
      userId,
      systems,
      7 // Last 7 days
    );

    // STEP 3: Get seen questions for deduplication
    const seenIds = await getUserSeenQuestionIds(prisma, userId, {
      questionType: 'pre_generated',
    });

    // STEP 4: Fetch questions per system with appropriate difficulty
    const questionsBySystem: Array<{
      id: string;
      system: string;
      difficulty: string;
      vignette?: string;
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      conditionId?: string;
      tags?: string[];
    }> = [];

    for (const [system, targetCount] of systemDistribution.entries()) {
      const difficulty = difficultyMap.get(system) || 'medium';

      // Fetch extra to account for deduplication filtering
      const questions = await prisma.preGeneratedQuestion.findMany({
        where: {
          system,
          difficulty,
        },
        take: targetCount * 3, // Fetch 3x to ensure enough after filtering
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          system: true,
          difficulty: true,
          questionData: true,
          conditionId: true,
        },
      });

      // Parse questionData JSON
      for (const q of questions) {
        try {
          const data = q.questionData as any;
          questionsBySystem.push({
            id: q.id,
            system: q.system ?? system,
            difficulty: q.difficulty,
            vignette: data.vignette,
            question: data.question,
            options: Array.isArray(data.options) ? data.options : [],
            correctAnswer: data.correctAnswer || data.correct_answer || 'A',
            explanation: data.explanation || data.rationale || '',
            conditionId: q.conditionId || undefined,
            tags: data.tags || [],
          });
        } catch (error) {
          console.error('[EnhancedPool] Failed to parse questionData:', error);
        }
      }
    }

    // STEP 5: Apply deduplication
    const unseenQuestionIds = await filterUnseenQuestions(
      prisma,
      userId,
      questionsBySystem.map((q) => q.id),
      'pre_generated'
    );

    const unseenQuestions = questionsBySystem.filter((q) => unseenQuestionIds.includes(q.id));
    const filteredCount = questionsBySystem.length - unseenQuestions.length;

    // STEP 6: Select exact count needed, respecting system distribution
    const selectedQuestions: typeof questionsBySystem = [];
    const systemCounters = new Map<string, number>();

    // Initialize counters
    for (const system of systems) {
      systemCounters.set(system, 0);
    }

    // Prioritize filling each system to target
    for (const [system, targetCount] of systemDistribution.entries()) {
      const systemQuestions = unseenQuestions
        .filter((q) => q.system === system)
        .slice(0, targetCount);

      selectedQuestions.push(...systemQuestions);
      systemCounters.set(system, systemQuestions.length);
    }

    // If we're short, fill with any unseen questions
    if (selectedQuestions.length < count) {
      const remaining = unseenQuestions
        .filter((q) => !selectedQuestions.includes(q))
        .slice(0, count - selectedQuestions.length);

      selectedQuestions.push(...remaining);
    }

    // Trim to exact count if we have too many
    const finalQuestions = selectedQuestions.slice(0, count);

    // STEP 7: Apply interleaving
    const interleavedQuestions = ensureInterleaving(finalQuestions, 2, 5);
    const interleavingValid = validateInterleaving(interleavedQuestions, 2, 5);

    // STEP 8: Convert to Question format
    const convertedQuestions: Question[] = [];

    for (const q of interleavedQuestions) {
      const converted = await convertPoolQuestion({
        id: q.id,
        vignette: q.vignette,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        system: q.system,
        difficulty: q.difficulty,
        tags: q.tags,
        source: 'pool',
        conditionId: q.conditionId,
      });

      // STEP 9: Resolve conditionId if missing (Sprint A Step 1)
      if (
        !converted.conditionId ||
        converted.conditionId === 'unknown' ||
        converted.conditionId.includes('-')
      ) {
        try {
          const resolved = await resolveConditionId(
            prisma,
            converted.condition || q.tags?.[0] || q.system,
            q.system,
            0.7 // 70% confidence threshold
          );

          if (resolved) {
            converted.conditionId = resolved.conditionId;

            // Update database with resolved conditionId
            await prisma.preGeneratedQuestion
              .update({
                where: { id: q.id },
                data: { conditionId: resolved.conditionId },
              })
              .catch((err) => console.warn('[EnhancedPool] Failed to update conditionId:', err));
          }
        } catch (error) {
          console.warn('[EnhancedPool] Failed to resolve conditionId:', error);
        }
      }

      convertedQuestions.push(converted);
    }

    return {
      questions: convertedQuestions,
      metadata: {
        usingAdaptiveDifficulty: difficultyMap.size > 0,
        usingDeduplication: seenIds.size > 0,
        usingInterleaving: interleavingValid,
        usingNCCPAWeighting: focus === 'all',
        filteredCount,
        interleavingValid,
      },
    };
  } catch (error) {
    console.error('[EnhancedPool] Failed to get enhanced questions:', error);
    throw error;
  }
}

/**
 * Get single enhanced question (for on-demand fetching)
 */
export async function getEnhancedQuestion(
  prisma: PrismaClient,
  userId: string,
  system?: string,
  targetDifficulty?: 'easy' | 'medium' | 'hard'
): Promise<Question | null> {
  try {
    // Get user performance for this system
    let difficulty = targetDifficulty;

    if (!difficulty && system) {
      const performance = await getUserPerformanceBySystem(prisma, userId, system, 7);
      difficulty = performance.recommendedDifficulty;
    }

    difficulty = difficulty || 'medium';

    // Get seen questions
    const seenIds = await getUserSeenQuestionIds(prisma, userId, {
      questionType: 'pre_generated',
    });

    // Fetch unseen question
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: {
        system: system,
        difficulty,
        id: { notIn: Array.from(seenIds) },
      },
      take: 1,
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        system: true,
        difficulty: true,
        questionData: true,
        conditionId: true,
      },
    });

    if (questions.length === 0) {
      return null;
    }

    const q = questions[0]!;
    const data = q.questionData as any;

    const converted = await convertPoolQuestion({
      id: q.id,
      vignette: data.vignette,
      question: data.question,
      options: Array.isArray(data.options) ? data.options : [],
      correctAnswer: data.correctAnswer || data.correct_answer || 'A',
      explanation: data.explanation || data.rationale || '',
      system: q.system ?? 'unknown',
      difficulty: q.difficulty,
      tags: data.tags || [],
      source: 'pool',
      conditionId: q.conditionId ?? undefined,
    });

    // Resolve conditionId if needed
    if (
      !converted.conditionId ||
      converted.conditionId === 'unknown' ||
      converted.conditionId.includes('-')
    ) {
      try {
        const resolved = await resolveConditionId(
          prisma,
          converted.condition || data.tags?.[0] || (q.system ?? 'unknown'),
          q.system ?? undefined,
          0.7
        );

        if (resolved) {
          converted.conditionId = resolved.conditionId;

          await prisma.preGeneratedQuestion
            .update({
              where: { id: q.id },
              data: { conditionId: resolved.conditionId },
            })
            .catch((err) => console.warn('[EnhancedPool] Failed to update conditionId:', err));
        }
      } catch (error) {
        console.warn('[EnhancedPool] Failed to resolve conditionId:', error);
      }
    }

    return converted;
  } catch (error) {
    console.error('[EnhancedPool] Failed to get enhanced question:', error);
    return null;
  }
}

/**
 * Check pool health with deduplication stats
 */
export async function getEnhancedPoolStatus(
  prisma: PrismaClient,
  userId: string,
  system?: string
): Promise<{
  totalInPool: number;
  userSeen: number;
  userUnseen: number;
  percentExplored: number;
  byDifficulty: Record<string, { total: number; seen: number; unseen: number }>;
}> {
  try {
    // Get total pool count
    const totalInPool = await prisma.preGeneratedQuestion.count({
      where: system ? { system } : undefined,
    });

    // Get user's seen questions
    const seenIds = await getUserSeenQuestionIds(prisma, userId, {
      questionType: 'pre_generated',
    });

    // Count how many of the pool this user has seen
    const userSeenInPool = await prisma.preGeneratedQuestion.count({
      where: {
        id: { in: Array.from(seenIds) },
        ...(system ? { system } : {}),
      },
    });

    const userUnseen = totalInPool - userSeenInPool;
    const percentExplored = totalInPool > 0 ? Math.round((userSeenInPool / totalInPool) * 100) : 0;

    // Get breakdown by difficulty
    const difficulties = ['easy', 'medium', 'hard'];
    const byDifficulty: Record<string, { total: number; seen: number; unseen: number }> = {};

    for (const difficulty of difficulties) {
      const total = await prisma.preGeneratedQuestion.count({
        where: {
          difficulty,
          ...(system ? { system } : {}),
        },
      });

      const seen = await prisma.preGeneratedQuestion.count({
        where: {
          difficulty,
          id: { in: Array.from(seenIds) },
          ...(system ? { system } : {}),
        },
      });

      byDifficulty[difficulty] = {
        total,
        seen,
        unseen: total - seen,
      };
    }

    return {
      totalInPool,
      userSeen: userSeenInPool,
      userUnseen,
      percentExplored,
      byDifficulty,
    };
  } catch (error) {
    console.error('[EnhancedPool] Failed to get pool status:', error);
    throw error;
  }
}
