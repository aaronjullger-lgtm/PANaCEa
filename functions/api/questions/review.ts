/**
 * Review Questions API
 * 
 * Comprehensive endpoint for fetching questions that need review:
 * - SRS due questions (spaced repetition)
 * - Flagged questions (user marked for review)
 * - Missed questions (incorrect answers)
 * - Weak area questions (low accuracy topics)
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { JsonValue } from '@prisma/client/runtime/library';

interface PagesContext {
  request: Request;
  env: Env;
}

/**
 * Generate a fresh review question for a condition using Gemini API
 * This is called when the pre-generated pool is exhausted for a condition
 */
async function generateReviewQuestion(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  conditionId: string,
  env: Env
): Promise<{
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition?: string;
  difficulty: string;
} | null> {
  if (!env.GEMINI_API_KEY) {
    console.warn('[Review] No GEMINI_API_KEY for fallback generation');
    return null;
  }

  // Fetch condition content from MedicalContent
  const content = await prisma.medicalContent.findUnique({
    where: { conditionId },
    select: {
      condition: true,
      system: true,
      overview: true,
      diagnostics: true,
      treatment: true,
      clinical_pearls: true,
      symptoms: true,
      pathophysiology: true,
      first_line_rx: true,
      gold_standard_dx: true,
      classic_patient: true,
    },
  });

  if (!content) {
    console.warn(`[Review] No MedicalContent found for conditionId: ${conditionId}`);
    return null;
  }

  const prompt = `Generate a PANCE-style follow-up review question about ${content.condition}.

This is a spaced repetition review. Create a DIFFERENT clinical vignette than typical questions for this condition, but test the SAME core concepts:
- Vary the patient demographics (age, sex)
- Use different presenting symptoms but same underlying condition
- Test the same diagnostic/treatment knowledge from a new angle

Condition Context:
- Overview: ${content.overview || 'N/A'}
- Classic Patient: ${content.classic_patient || 'N/A'}
- Symptoms: ${content.symptoms || 'N/A'}
- Diagnostics: ${content.diagnostics || 'N/A'}
- Gold Standard Dx: ${content.gold_standard_dx || 'N/A'}
- Treatment: ${content.treatment || 'N/A'}
- First Line Rx: ${content.first_line_rx || 'N/A'}
- Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

Requirements:
1. Clinical vignette: 2-4 sentences with realistic patient scenario
2. Question stem: Clear, PANCE-appropriate
3. 4 answer options (A, B, C, D) with one correct and three plausible distractors
4. Educational explanation for the correct answer

Return ONLY valid JSON (no markdown):
{
  "vignette": "Clinical scenario...",
  "question": "What is the most appropriate next step?",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correctAnswer": "A",
  "explanation": "Detailed explanation...",
  "difficulty": "medium"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8, // Slightly higher for variety
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('[Review] Gemini API error:', response.status);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Review] No text in Gemini response');
      return null;
    }

    // Parse JSON (handle potential markdown wrapping)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);
    
    if (!parsed.question && !parsed.vignette) {
      console.error('[Review] Invalid question format from Gemini');
      return null;
    }

    // Convert correctAnswer letter to index
    const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const correctIndex = letterToIndex[parsed.correctAnswer?.charAt(0)?.toUpperCase()] ?? 0;

    // Generate unique ID for this question
    const id = `review-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Optionally save to PreGeneratedQuestion pool for future use
    try {
      await prisma.preGeneratedQuestion.create({
        data: {
          id,
          conditionId,
          system: content.system,
          difficulty: parsed.difficulty || 'medium',
          questionData: {
            vignette: parsed.vignette || parsed.question,
            question: parsed.question,
            options: parsed.options,
            correctAnswerIndex: correctIndex,
            explanation: parsed.explanation,
            condition: content.condition,
          },
          generatedAt: new Date(),
          source: 'review-fallback',
        },
      });
      console.log(`[Review] Saved generated question to pool: ${id}`);
    } catch (saveError) {
      // Don't fail if save doesn't work - the question is still valid
      console.warn('[Review] Could not save to pool:', saveError);
    }

    return {
      id,
      question: `${parsed.vignette || ''}\n\n${parsed.question || ''}`.trim(),
      options: parsed.options,
      correctAnswerIndex: correctIndex,
      rationale: parsed.explanation || '',
      system: content.system,
      condition: content.condition,
      difficulty: parsed.difficulty || 'medium',
    };
  } catch (error) {
    console.error('[Review] Gemini generation failed:', error);
    return null;
  }
}

// Database Question shape
interface DBQuestion {
  id: string;
  vignette: string;
  options: JsonValue;
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition: string | null;
  conditionId: string | null;
  difficulty: string | null;
}

interface ReviewQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition?: string;
  conditionId?: string;
  difficulty?: string;
  reviewReason: 'srs_due' | 'flagged' | 'missed' | 'weak_area';
  priority: number;
  lastSeen?: Date;
  nextDue?: Date;
  accuracy?: number;
}

interface ReviewSummary {
  srsDue: number;
  flagged: number;
  missed: number;
  weakArea: number;
  total: number;
  urgentCount: number;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch questions needing review
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const url = new URL(context.request.url);
    const mode = url.searchParams.get('mode') || 'all'; // all, srs, flagged, missed, weak
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const system = url.searchParams.get('system');

    // Get internal user ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const userId = user.id;
    const reviewQuestions: ReviewQuestion[] = [];

    // 1. SRS Due Questions (Concept-based: fetches fresh questions for due conditions)
    if (mode === 'all' || mode === 'srs') {
      const srsQuestions = await getSRSDueQuestions(prisma, userId, system, limit, context.env);
      reviewQuestions.push(...srsQuestions);
    }

    // 2. Flagged Questions
    if (mode === 'all' || mode === 'flagged') {
      const flaggedQuestions = await getFlaggedQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...flaggedQuestions);
    }

    // 3. Missed Questions (recent incorrect answers)
    if (mode === 'all' || mode === 'missed') {
      const missedQuestions = await getMissedQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...missedQuestions);
    }

    // 4. Weak Area Questions (low accuracy systems/conditions)
    if (mode === 'all' || mode === 'weak') {
      const weakQuestions = await getWeakAreaQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...weakQuestions);
    }

    // Deduplicate by question ID and sort by priority
    const uniqueQuestions = deduplicateAndSort(reviewQuestions);

    // Generate summary
    const summary = generateSummary(reviewQuestions);

    return createSuccessResponse({
      questions: uniqueQuestions.slice(0, limit),
      summary,
      mode,
      userId: auth.userId,
    });
  } catch (error) {
    console.error('[ReviewAPI] Error:', error);
    return createErrorResponse('Failed to fetch review questions', 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST: Mark questions as reviewed
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await context.request.json() as {
      questionId: string;
      wasCorrect: boolean;
      timeSpentMs?: number;
      quality?: number;
      srsItemId?: string; // Optional: directly specify which SRS item to update (concept-based)
      conditionId?: string; // Optional: specify the condition being reviewed
    };

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const now = new Date();
    const quality = body.quality ?? (body.wasCorrect ? 4 : 1);

    // CONCEPT-BASED SRS: Update the SRS item for the CONDITION, not the specific question
    // This prevents rote memorization and strengthens the underlying concept
    
    let srsItem;
    
    // Priority 1: Use srsItemId if provided (from concept-based review)
    if (body.srsItemId) {
      srsItem = await prisma.sRSItem.findUnique({
        where: { id: body.srsItemId },
      });
    }
    
    // Priority 2: Find by conditionId (concept-based lookup)
    if (!srsItem && body.conditionId) {
      // Look for any SRS item for this condition (by finding questions with this conditionId)
      const questionsForCondition = await prisma.question.findMany({
        where: { conditionId: body.conditionId },
        select: { id: true },
        take: 100,
      });
      const questionIds = questionsForCondition.map(q => q.id);
      
      if (questionIds.length > 0) {
        srsItem = await prisma.sRSItem.findFirst({
          where: {
            userId: user.id,
            questionId: { in: questionIds },
          },
          orderBy: { dueDate: 'asc' }, // Get the most urgent one
        });
      }
    }
    
    // Priority 3: Fall back to specific questionId (legacy behavior)
    if (!srsItem) {
      srsItem = await prisma.sRSItem.findFirst({
        where: {
          userId: user.id,
          questionId: body.questionId,
        },
      });
    }

    if (srsItem) {
      // Update existing SRS item with FSRS v5 algorithm
      const newInterval = calculateNewInterval(srsItem, quality);
      const nextDue = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.update({
        where: { id: srsItem.id },
        data: {
          lastReviewed: now,
          dueDate: nextDue,
          interval: newInterval,
          repetition: srsItem.repetition + 1,
          easiness: adjustEasiness(srsItem.easiness, quality),
          quality,
        },
      });
    } else {
      // Create new SRS item for this question
      // For concept-based SRS, we link to the original question but track the condition
      const interval = body.wasCorrect ? 1 : 0;
      const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          questionId: body.questionId,
          lastReviewed: now,
          dueDate: nextDue,
          interval,
          repetition: 1,
          easiness: 2.5,
          quality,
          difficulty: 0.3,
          stabilityScore: 0,
        },
      });
    }

    // Record the attempt (always track the specific question answered)
    await prisma.questionAttempt.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        questionId: body.questionId,
        wasCorrect: body.wasCorrect,
        timeSpentMs: body.timeSpentMs,
        mode: 'review',
        conditionId: body.conditionId,
      },
    });

    // Record in user history
    await prisma.userQuestionHistory.upsert({
      where: {
        id: `${user.id}-${body.questionId}`,
      },
      update: {
        isCorrect: body.wasCorrect,
        seenAt: now,
      },
      create: {
        id: `${user.id}-${body.questionId}`,
        userId: user.id,
        questionId: body.questionId,
        isCorrect: body.wasCorrect,
        seenAt: now,
      },
    });

    return createSuccessResponse({
      success: true,
      message: 'Review recorded',
    });
  } catch (error) {
    console.error('[ReviewAPI] Error recording review:', error);
    return createErrorResponse('Failed to record review', 500);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper Functions

/**
 * CONCEPT-BASED SRS: Fetch fresh questions for due conditions
 * 
 * Instead of showing the exact same question again (rote memorization),
 * we fetch a FRESH question for the same condition (concept reinforcement).
 * 
 * Flow:
 * 1. Get SRS items due, grouped by conditionId
 * 2. For each condition, find a fresh question from the pool that the user hasn't seen
 * 3. If no fresh questions exist, generate one on-the-fly via Gemini
 */
async function getSRSDueQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number,
  env?: Env
): Promise<ReviewQuestion[]> {
  const now = new Date();

  // 1. Get all due SRS items
  const srsItems = await prisma.sRSItem.findMany({
    where: {
      userId,
      dueDate: { lte: now },
    },
    orderBy: [
      { dueDate: 'asc' },
      { easiness: 'asc' }, // Harder items first
    ],
    take: limit * 2, // Fetch extra since we'll group by condition
  });

  if (srsItems.length === 0) {
    return [];
  }

  // 2. Get the original questions to extract conditionIds
  const originalQuestionIds = srsItems.map(item => item.questionId);
  const originalQuestions = await prisma.question.findMany({
    where: { id: { in: originalQuestionIds } },
    select: { id: true, conditionId: true, condition: true, system: true },
  });

  interface QuestionConditionInfo {
    conditionId: string | null;
    condition: string | null;
    system: string;
  }
  
  const questionConditionMap = new Map<string, QuestionConditionInfo>(
    originalQuestions.map(q => [q.id, { conditionId: q.conditionId, condition: q.condition, system: q.system }])
  );

  // 3. Get questions user has already seen
  const seenHistory = await prisma.userQuestionHistory.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set(seenHistory.map(h => h.questionId));

  // 4. Group SRS items by conditionId to deduplicate
  const conditionGroups = new Map<string, typeof srsItems[0]>();
  for (const item of srsItems) {
    const questionInfo = questionConditionMap.get(item.questionId);
    if (!questionInfo?.conditionId) continue;
    if (system && questionInfo.system !== system) continue;
    
    // Keep the most urgent item per condition
    if (!conditionGroups.has(questionInfo.conditionId)) {
      conditionGroups.set(questionInfo.conditionId, item);
    }
  }

  // 5. For each due condition, find a fresh question
  const reviewQuestions: ReviewQuestion[] = [];
  const conditionIds = Array.from(conditionGroups.keys()).slice(0, limit);

  for (const conditionId of conditionIds) {
    const srsItem = conditionGroups.get(conditionId)!;
    const originalInfo = questionConditionMap.get(srsItem.questionId);

    // Try to find a fresh question from PreGeneratedQuestion pool
    const freshFromPool = await prisma.preGeneratedQuestion.findFirst({
      where: {
        conditionId,
        id: { notIn: Array.from(seenIds) },
        ...(system ? { system } : {}),
      },
      orderBy: { generatedAt: 'asc' }, // Use oldest first
    });

    if (freshFromPool) {
      const data = freshFromPool.questionData as Record<string, unknown>;
      const optionsData = data.options || data.answers || data.choices;
      const options = Array.isArray(optionsData) ? (optionsData as string[]) : [];
      
      const daysOverdue = Math.max(0, (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      reviewQuestions.push({
        id: freshFromPool.id,
        question: (data.question || data.vignette || '') as string,
        options,
        correctAnswerIndex: (data.correctAnswerIndex ?? 0) as number,
        rationale: (data.explanation || data.rationale || '') as string,
        system: freshFromPool.system || 'General',
        condition: (data.condition || originalInfo?.condition) as string | undefined,
        conditionId,
        difficulty: freshFromPool.difficulty,
        reviewReason: 'srs_due' as const,
        priority: Math.min(100, 50 + daysOverdue * 10),
        lastSeen: srsItem.lastReviewed,
        nextDue: srsItem.dueDate,
        // Track which SRS item this review is for (stored in metadata)
        srsItemId: srsItem.id,
      } as ReviewQuestion & { srsItemId: string });

      // Mark as seen (but don't mark globally used)
      seenIds.add(freshFromPool.id);
      continue;
    }

    // Try main Question table
    const freshFromMain = await prisma.question.findFirst({
      where: {
        conditionId,
        id: { notIn: Array.from(seenIds) },
        ...(system ? { system } : {}),
      },
      orderBy: { createdAt: 'asc' },
    }) as DBQuestion | null;

    if (freshFromMain) {
      const daysOverdue = Math.max(0, (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      reviewQuestions.push({
        id: freshFromMain.id,
        question: freshFromMain.vignette,
        options: freshFromMain.options as string[],
        correctAnswerIndex: freshFromMain.correctAnswerIndex,
        rationale: freshFromMain.rationale,
        system: freshFromMain.system,
        condition: freshFromMain.condition ?? undefined,
        conditionId,
        difficulty: freshFromMain.difficulty ?? undefined,
        reviewReason: 'srs_due' as const,
        priority: Math.min(100, 50 + daysOverdue * 10),
        lastSeen: srsItem.lastReviewed,
        nextDue: srsItem.dueDate,
        srsItemId: srsItem.id,
      } as ReviewQuestion & { srsItemId: string });

      seenIds.add(freshFromMain.id);
      continue;
    }

    // Gemini Fallback: Generate a fresh question on-the-fly
    // This ensures concept-based learning even when the pool is exhausted
    if (env?.GEMINI_API_KEY) {
      const generated = await generateReviewQuestion(prisma, conditionId, env);
      if (generated) {
        const daysOverdue = Math.max(0, (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        reviewQuestions.push({
          id: generated.id,
          question: generated.question,
          options: generated.options,
          correctAnswerIndex: generated.correctAnswerIndex,
          rationale: generated.rationale,
          system: generated.system,
          condition: generated.condition,
          conditionId,
          difficulty: generated.difficulty,
          reviewReason: 'srs_due' as const,
          priority: Math.min(100, 50 + daysOverdue * 10),
          lastSeen: srsItem.lastReviewed,
          nextDue: srsItem.dueDate,
          srsItemId: srsItem.id,
          isGenerated: true, // Flag that this was generated on-the-fly
        } as ReviewQuestion & { srsItemId: string; isGenerated: boolean });

        seenIds.add(generated.id);
        continue;
      }
    }

    // Last Resort Fallback: Use the original question
    // (Only when pool AND main table are exhausted AND Gemini generation failed)
    const fallbackQuestion = originalQuestions.find(q => q.id === srsItem.questionId);
    if (fallbackQuestion) {
      const fullQuestion = await prisma.question.findUnique({
        where: { id: fallbackQuestion.id },
      }) as DBQuestion | null;

      if (fullQuestion) {
        const daysOverdue = Math.max(0, (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        reviewQuestions.push({
          id: fullQuestion.id,
          question: fullQuestion.vignette,
          options: fullQuestion.options as string[],
          correctAnswerIndex: fullQuestion.correctAnswerIndex,
          rationale: fullQuestion.rationale,
          system: fullQuestion.system,
          condition: fullQuestion.condition ?? undefined,
          conditionId: fullQuestion.conditionId ?? undefined,
          difficulty: fullQuestion.difficulty ?? undefined,
          reviewReason: 'srs_due' as const,
          priority: Math.min(100, 50 + daysOverdue * 10),
          lastSeen: srsItem.lastReviewed,
          nextDue: srsItem.dueDate,
          srsItemId: srsItem.id,
          isRepeat: true, // Flag that this is the same question (pool exhausted)
        } as ReviewQuestion & { srsItemId: string; isRepeat: boolean });
      }
    }
  }

  return reviewQuestions;
}

async function getFlaggedQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Fetch saved questions of type 'flagged'
  const savedQuestions = await prisma.savedQuestion.findMany({
    where: {
      userId,
      type: 'flagged',
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const questionIds = savedQuestions.map(sq => sq.questionId);
  const questions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: {
          id: { in: questionIds },
          ...(system ? { system } : {}),
        },
      }) as DBQuestion[]
    : [];

  const questionMap = new Map(questions.map(q => [q.id, q as DBQuestion]));

  return savedQuestions
    .filter(sq => questionMap.has(sq.questionId))
    .map(sq => {
      const q = questionMap.get(sq.questionId)!;
      return {
        id: q.id,
        question: q.vignette,
        options: q.options as string[],
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'flagged' as const,
        priority: 80, // High priority for user-flagged
        lastSeen: sq.updatedAt,
      };
    });
}

async function getMissedQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Get recent incorrect attempts
  const recentMissed = await prisma.questionAttempt.findMany({
    where: {
      userId,
      wasCorrect: false,
      ...(system ? { system } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 2, // Fetch more to account for duplicates
  });

  // Get unique question IDs
  const seenIds = new Set<string>();
  const uniqueAttempts = recentMissed.filter(a => {
    if (seenIds.has(a.questionId)) return false;
    seenIds.add(a.questionId);
    return true;
  }).slice(0, limit);

  const questionIds = uniqueAttempts.map(a => a.questionId);
  const questions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: { id: { in: questionIds } },
      }) as DBQuestion[]
    : [];

  const questionMap = new Map(questions.map(q => [q.id, q as DBQuestion]));

  return uniqueAttempts
    .filter(a => questionMap.has(a.questionId))
    .map(a => {
      const q = questionMap.get(a.questionId)!;
      return {
        id: q.id,
        question: q.vignette,
        options: q.options as string[],
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'missed' as const,
        priority: 70, // Medium-high priority
        lastSeen: a.createdAt,
      };
    });
}

async function getWeakAreaQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Calculate weak systems/conditions from attempts
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    select: {
      system: true,
      conditionId: true,
      wasCorrect: true,
    },
  });

  // Group by system
  const systemStats = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (!a.system) continue;
    if (!systemStats.has(a.system)) {
      systemStats.set(a.system, { correct: 0, total: 0 });
    }
    const stats = systemStats.get(a.system)!;
    stats.total++;
    if (a.wasCorrect) stats.correct++;
  }

  // Find weak systems (< 60% accuracy with >= 5 attempts)
  const weakSystems: string[] = [];
  for (const [sys, stats] of systemStats) {
    if (stats.total >= 5 && (stats.correct / stats.total) < 0.6) {
      weakSystems.push(sys);
    }
  }

  if (weakSystems.length === 0) {
    return [];
  }

  // Get questions from weak systems that user hasn't mastered
  const questions = await prisma.question.findMany({
    where: {
      system: { in: weakSystems },
      ...(system ? { system } : {}),
    },
    take: limit,
    orderBy: { id: 'asc' },
  }) as DBQuestion[];

  return questions.map((q: DBQuestion) => {
    const stats = systemStats.get(q.system);
    const accuracy = stats ? (stats.correct / stats.total) * 100 : 50;

    return {
      id: q.id,
      question: q.vignette,
      options: q.options as string[],
      correctAnswerIndex: q.correctAnswerIndex,
      rationale: q.rationale,
      system: q.system,
      condition: q.condition ?? undefined,
      conditionId: q.conditionId ?? undefined,
      difficulty: q.difficulty ?? undefined,
      reviewReason: 'weak_area' as const,
      priority: Math.round(60 - accuracy * 0.5), // Lower accuracy = higher priority
      accuracy,
    };
  });
}

function deduplicateAndSort(questions: ReviewQuestion[]): ReviewQuestion[] {
  const seen = new Map<string, ReviewQuestion>();

  for (const q of questions) {
    if (!seen.has(q.id) || q.priority > seen.get(q.id)!.priority) {
      seen.set(q.id, q);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
}

function generateSummary(questions: ReviewQuestion[]): ReviewSummary {
  const srsDue = questions.filter(q => q.reviewReason === 'srs_due').length;
  const flagged = questions.filter(q => q.reviewReason === 'flagged').length;
  const missed = questions.filter(q => q.reviewReason === 'missed').length;
  const weakArea = questions.filter(q => q.reviewReason === 'weak_area').length;
  const urgentCount = questions.filter(q => q.priority >= 80).length;

  return {
    srsDue,
    flagged,
    missed,
    weakArea,
    total: questions.length,
    urgentCount,
  };
}

function calculateNewInterval(srsItem: { interval: number; easiness: number; repetition: number }, quality: number): number {
  // Simplified FSRS v5 interval calculation
  if (quality < 3) {
    return 0; // Reset on failure
  }

  const easiness = srsItem.easiness;
  const currentInterval = srsItem.interval;
  const repetition = srsItem.repetition;

  if (repetition === 0) {
    return 1;
  } else if (repetition === 1) {
    return 6;
  }

  return Math.round(currentInterval * easiness);
}

function adjustEasiness(currentEasiness: number, quality: number): number {
  // SM-2 easiness adjustment
  const newEasiness = currentEasiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, Math.min(2.5, newEasiness));
}
