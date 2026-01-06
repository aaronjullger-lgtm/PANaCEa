/**
 * Main Session Question API
 * 
 * Comprehensive endpoint for the main study session:
 * - Smart question fetching with no-repeat logic
 * - Automatic MedicalContent linking
 * - Question seeding and storage
 * - User progress tracking
 * - Performance analytics
 */

import { authenticateRequest, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

// Session question request body
interface SessionQuestionRequest {
  userId: string;
  count?: number;
  system?: string;
  conditionId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  mode?: 'standard' | 'review' | 'weakness' | 'random';
  excludeQuestionIds?: string[];
}

// Question with full context
interface EnrichedQuestion {
  id: string;
  question: string;
  vignette?: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  subcategory?: string;
  conditionId?: string;
  condition?: string;
  medicalContentId?: string;
  pearls: string[];
  difficulty: string;
  source: 'pool' | 'main' | 'generated' | 'seed';
  metadata?: Record<string, unknown>;
}

// Session analytics data
interface SessionAnalytics {
  questionsServed: number;
  fromPool: number;
  fromMain: number;
  generated: number;
  fromSeeds: number;
  avgDifficulty: number;
  systemDistribution: Record<string, number>;
}

/**
 * GET /api/questions/session
 * Fetch questions for a study session
 */
export async function onRequestGet(context: { request: Request; env: Env }) {

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return jsonResponse({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }, 404);
    }

    const url = new URL(context.request.url);
    const count = parseInt(url.searchParams.get('count') || '10', 10);
    const system = url.searchParams.get('system');
    const difficulty = url.searchParams.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const mode = url.searchParams.get('mode') || 'standard';

    const result = await fetchSessionQuestions(prisma, context.env, {
      userId: user.id,
      count: Math.min(count, 50),
      system: system || undefined,
      difficulty: difficulty || undefined,
      mode: mode as SessionQuestionRequest['mode'],
    });

    return jsonResponse(result);
  } catch (error) {
    console.error('[Session] Error:', error);
    return jsonResponse({ error: 'Failed to fetch session questions' }, 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/questions/session
 * Fetch questions with more complex filtering
 */
export async function onRequestPost(context: { request: Request; env: Env }) {

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return jsonResponse({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }, 404);
    }

    const body = await context.request.json() as SessionQuestionRequest;
    const result = await fetchSessionQuestions(prisma, context.env, {
      ...body,
      userId: user.id,
      count: Math.min(body.count || 10, 50),
    });

    return jsonResponse(result);
  } catch (error) {
    console.error('[Session] Error:', error);
    return jsonResponse({ error: 'Failed to fetch session questions' }, 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Core question fetching logic with smart sourcing
 */
async function fetchSessionQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  env: Env,
  params: SessionQuestionRequest
): Promise<{
  questions: EnrichedQuestion[];
  analytics: SessionAnalytics;
  poolStatus: { available: number; needsGeneration: boolean };
}> {
  const { userId, count = 10, system, conditionId, difficulty, mode, excludeQuestionIds = [] } = params;

  // Get user's seen questions
  const seenHistory = await prisma.userQuestionHistory.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set([...seenHistory.map(h => h.questionId), ...excludeQuestionIds]);

  const questions: EnrichedQuestion[] = [];
  const analytics: SessionAnalytics = {
    questionsServed: 0,
    fromPool: 0,
    fromMain: 0,
    generated: 0,
    fromSeeds: 0,
    avgDifficulty: 0,
    systemDistribution: {},
  };

  // 1. Try PreGeneratedQuestion pool first
  const poolQuestions = await fetchFromPool(prisma, userId, seenIds, {
    count,
    system,
    conditionId,
    difficulty,
  });
  questions.push(...poolQuestions.questions);
  analytics.fromPool = poolQuestions.questions.length;

  // 2. If need more, try QuestionSeed expansion
  if (questions.length < count && mode !== 'review') {
    const seedQuestions = await expandFromSeeds(prisma, env, userId, seenIds, {
      count: count - questions.length,
      system,
      conditionId,
      difficulty,
    });
    questions.push(...seedQuestions);
    analytics.fromSeeds = seedQuestions.length;
  }

  // 3. If still need more, try main Question table
  if (questions.length < count) {
    const mainQuestions = await fetchFromMain(prisma, userId, seenIds, {
      count: count - questions.length,
      system,
      conditionId,
      difficulty,
    });
    questions.push(...mainQuestions);
    analytics.fromMain = mainQuestions.length;
  }

  // 4. Last resort: Generate new questions using AI
  if (questions.length < count && env.GEMINI_API_KEY) {
    const generated = await generateNewQuestions(prisma, env, {
      count: Math.min(count - questions.length, 5), // Limit AI generation
      system,
      conditionId,
      difficulty,
    });
    questions.push(...generated);
    analytics.generated = generated.length;
  }

  // Enrich with MedicalContent data
  const enriched = await enrichWithMedicalContent(prisma, questions);

  // Record all questions as seen
  await recordQuestionHistory(prisma, userId, enriched);

  // Calculate analytics
  analytics.questionsServed = enriched.length;
  analytics.avgDifficulty = calculateAvgDifficulty(enriched);
  analytics.systemDistribution = calculateSystemDistribution(enriched);

  // Check pool status for frontend warning
  const poolCount = await prisma.preGeneratedQuestion.count({
    where: { usedAt: null },
  });

  return {
    questions: enriched,
    analytics,
    poolStatus: {
      available: poolCount,
      needsGeneration: poolCount < 50,
    },
  };
}

/**
 * Fetch from PreGeneratedQuestion pool
 */
async function fetchFromPool(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
  }
): Promise<{ questions: EnrichedQuestion[] }> {
  const { count, system, conditionId, difficulty } = options;

  // Do NOT filter by usedAt - questions remain available to all users
  // Per-user filtering happens via seenIds from UserQuestionHistory
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (conditionId) where.conditionId = conditionId;
  if (difficulty) where.difficulty = difficulty;

  const poolQuestions = await prisma.preGeneratedQuestion.findMany({
    where,
    take: count * 3,
    orderBy: { generatedAt: 'asc' },
  });

  const questions: EnrichedQuestion[] = [];
  const toMarkUsed: string[] = [];

  for (const q of poolQuestions) {
    if (questions.length >= count) break;
    if (seenIds.has(q.id)) continue;

    const data = q.questionData as Record<string, unknown>;
    // Handle different option field names (options, answers, choices)
    const optionsData = data.options || data.answers || data.choices;
    const options = Array.isArray(optionsData) ? (optionsData as string[]) : [];
    
    questions.push({
      id: q.id,
      question: (data.question || data.vignette || '') as string,
      vignette: data.vignette as string | undefined,
      options,
      correctAnswerIndex: (data.correctAnswerIndex ?? 0) as number,
      rationale: (data.rationale || data.explanation || '') as string,
      system: q.system || 'General',
      subcategory: data.subcategory as string | undefined,
      conditionId: q.conditionId || undefined,
      condition: data.condition as string | undefined,
      medicalContentId: q.medicalContentId || undefined,
      pearls: (data.pearls || []) as string[],
      difficulty: q.difficulty,
      source: 'pool',
      metadata: { generatedAt: q.generatedAt },
    });
    toMarkUsed.push(q.id);
    seenIds.add(q.id);
  }

  // Record in user's history - do NOT mark globally as used
  // This enables multi-tenant pooling
  // Note: The actual history record happens in the parent function

  return { questions };
}

/**
 * Expand questions from QuestionSeed templates
 */
async function expandFromSeeds(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  env: Env,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
  }
): Promise<EnrichedQuestion[]> {
  const { count, system, conditionId, difficulty } = options;

  // Get seeds matching criteria
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (conditionId) where.conditionId = conditionId;
  if (difficulty) where.difficulty = difficulty;

  const seeds = await prisma.questionSeed.findMany({
    where,
    orderBy: { usageCount: 'asc' }, // Prefer less-used seeds
    take: count,
    include: {
      Condition: {
        include: {
          MedicalContent: true,
        },
      },
    },
  });

  const questions: EnrichedQuestion[] = [];

  for (const seed of seeds) {
    if (questions.length >= count) break;

    // Generate a unique question from the seed template
    const expandedQuestion = await expandSeedToQuestion(seed, env);
    if (expandedQuestion && !seenIds.has(expandedQuestion.id)) {
      questions.push(expandedQuestion);
      seenIds.add(expandedQuestion.id);

      // Update seed usage
      await prisma.questionSeed.update({
        where: { id: seed.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }
  }

  return questions;
}

/**
 * Expand a single seed into a question
 */
async function expandSeedToQuestion(
  seed: any,
  env: Env
): Promise<EnrichedQuestion | null> {
  try {
    const variables = seed.variables as Record<string, string[]>;
    
    // Simple variable substitution
    let question = seed.template;
    for (const [key, values] of Object.entries(variables)) {
      const randomValue = values[Math.floor(Math.random() * values.length)];
      question = question.replace(new RegExp(`\\{${key}\\}`, 'g'), randomValue);
    }

    const distractors = seed.distractors as string[];
    const shuffledOptions = shuffleArray([seed.correctAnswer, ...distractors.slice(0, 3)]);
    const correctIndex = shuffledOptions.indexOf(seed.correctAnswer);

    const id = `seed-${seed.id}-${Date.now()}`;

    return {
      id,
      question,
      options: shuffledOptions,
      correctAnswerIndex: correctIndex,
      rationale: seed.explanation,
      system: seed.system || 'General',
      conditionId: seed.conditionId,
      condition: seed.Condition?.name,
      medicalContentId: seed.Condition?.MedicalContent?.id,
      pearls: [],
      difficulty: seed.difficulty,
      source: 'seed',
      metadata: { seedId: seed.id },
    };
  } catch (error) {
    console.error('[Session] Failed to expand seed:', error);
    return null;
  }
}

/**
 * Fetch from main Question table
 */
async function fetchFromMain(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
  }
): Promise<EnrichedQuestion[]> {
  const { count, system, conditionId, difficulty } = options;

  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (conditionId) where.conditionId = conditionId;
  if (difficulty) where.difficulty = difficulty;

  const dbQuestions = await prisma.question.findMany({
    where,
    take: count * 3,
    orderBy: { timesSeen: 'asc' }, // Prefer less-seen questions
    include: {
      Condition: {
        select: {
          name: true,
          MedicalContent: { select: { id: true } },
        },
      },
    },
  });

  const questions: EnrichedQuestion[] = [];
  const questionIdsToUpdate: string[] = [];

  for (const q of dbQuestions) {
    if (questions.length >= count) break;
    if (seenIds.has(q.id)) continue;

    const options = Array.isArray(q.options) ? q.options as string[] : [];
    const correctIndex = options.findIndex(opt => opt === q.correctAnswer);

    questions.push({
      id: q.id,
      question: q.question,
      vignette: q.vignette || undefined,
      options,
      correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
      rationale: q.explanation,
      system: q.system,
      conditionId: q.conditionId || undefined,
      condition: q.Condition?.name,
      medicalContentId: q.Condition?.MedicalContent?.id || q.medicalContentId || undefined,
      pearls: [],
      difficulty: q.difficulty || 'medium',
      source: 'main',
    });
    seenIds.add(q.id);
    questionIdsToUpdate.push(q.id);
  }

  // OPTIMIZATION: Batch update instead of N+1 individual updates
  if (questionIdsToUpdate.length > 0) {
    await prisma.question.updateMany({
      where: { id: { in: questionIdsToUpdate } },
      data: { timesSeen: { increment: 1 } },
    });
  }

  return questions;
}

/**
 * Generate new questions using AI (fallback)
 */
async function generateNewQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  env: Env,
  options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
  }
): Promise<EnrichedQuestion[]> {
  const { count, system, conditionId, difficulty } = options;

  // Get a random condition with MedicalContent
  const where: Record<string, unknown> = { status: 'published' };
  if (system) where.system = system;
  if (conditionId) where.conditionId = conditionId;

  const contentRecords = await prisma.medicalContent.findMany({
    where,
    take: count,
    orderBy: { updatedAt: 'desc' },
    include: {
      Condition: true,
    },
  });

  if (contentRecords.length === 0) {
    return [];
  }

  const questions: EnrichedQuestion[] = [];

  for (const content of contentRecords) {
    if (questions.length >= count) break;

    try {
      const generated = await generateQuestionFromContent(content, env, difficulty);
      if (generated) {
        questions.push(generated);

        // Save to PreGeneratedQuestion pool for future use
        await prisma.preGeneratedQuestion.create({
          data: {
            id: generated.id,
            questionType: 'mcq',
            system: generated.system,
            conditionId: content.conditionId,
            medicalContentId: content.id,
            difficulty: generated.difficulty,
            questionData: {
              question: generated.question,
              vignette: generated.vignette,
              options: generated.options,
              correctAnswerIndex: generated.correctAnswerIndex,
              rationale: generated.rationale,
              condition: generated.condition,
              pearls: generated.pearls,
            },
          },
        });
      }
    } catch (error) {
      console.error('[Session] Failed to generate question:', error);
    }
  }

  return questions;
}

/**
 * Generate a single question from MedicalContent
 */
async function generateQuestionFromContent(
  content: any,
  env: Env,
  difficulty?: string
): Promise<EnrichedQuestion | null> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Generate a PANCE-style multiple choice question about ${content.condition}.

Condition Overview: ${content.overview || 'N/A'}
Key Diagnostics: ${content.diagnostics || 'N/A'}
Treatment: ${content.treatment || 'N/A'}
Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

Difficulty: ${difficulty || 'medium'}

Return ONLY valid JSON:
{
  "question": "Clinical vignette ending with a question",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswerIndex": 0,
  "rationale": "Why the correct answer is correct",
  "pearls": ["Pearl 1", "Pearl 2", "Pearl 3"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id,
      question: data.question,
      options: data.options,
      correctAnswerIndex: data.correctAnswerIndex,
      rationale: data.rationale,
      system: content.system,
      subcategory: content.subcategory,
      conditionId: content.conditionId,
      condition: content.condition,
      medicalContentId: content.id,
      pearls: data.pearls || [],
      difficulty: difficulty || 'medium',
      source: 'generated',
    };
  } catch (error) {
    console.error('[Session] AI generation failed:', error);
    return null;
  }
}

/**
 * Enrich questions with MedicalContent data
 */
async function enrichWithMedicalContent(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questions: EnrichedQuestion[]
): Promise<EnrichedQuestion[]> {
  const conditionIds = questions
    .map(q => q.conditionId)
    .filter((id): id is string => Boolean(id));

  if (conditionIds.length === 0) return questions;

  const contentMap = new Map<string, any>();
  const contentRecords = await prisma.medicalContent.findMany({
    where: { conditionId: { in: conditionIds } },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      subcategory: true,
      buzzwords: true,
      clinical_pearls: true,
    },
  });

  for (const content of contentRecords) {
    contentMap.set(content.conditionId, content);
  }

  return questions.map(q => {
    if (!q.conditionId) return q;
    
    const content = contentMap.get(q.conditionId);
    if (!content) return q;

    return {
      ...q,
      medicalContentId: content.id,
      condition: q.condition || content.condition,
      subcategory: q.subcategory || content.subcategory,
      pearls: q.pearls.length > 0 ? q.pearls : (content.clinical_pearls || []),
    };
  });
}

/**
 * Record question history for no-repeat logic
 */
async function recordQuestionHistory(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  questions: EnrichedQuestion[]
): Promise<void> {
  const historyRecords = questions.map(q => ({
    id: `${userId}-${q.id}`,
    userId,
    questionId: q.id,
    isCorrect: false,
    seenAt: new Date(),
  }));

  await prisma.userQuestionHistory.createMany({
    data: historyRecords,
    skipDuplicates: true,
  });
}

// Helper functions
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function calculateAvgDifficulty(questions: EnrichedQuestion[]): number {
  const difficultyMap: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
  const total = questions.reduce((sum, q) => sum + (difficultyMap[q.difficulty] || 2), 0);
  return questions.length > 0 ? total / questions.length : 2;
}

function calculateSystemDistribution(questions: EnrichedQuestion[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const q of questions) {
    dist[q.system] = (dist[q.system] || 0) + 1;
  }
  return dist;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
