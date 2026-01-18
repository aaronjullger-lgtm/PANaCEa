import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { ContentService } from '../content/contentService';
import type { Env } from '../../../functions/api/_shared/auth';
import type { Prisma } from '@prisma/client';

// Interfaces moved from session.ts to be used in the service
export interface SessionQuestionRequest {
  userId: string;
  count?: number;
  system?: string;
  conditionId?: string;
  // Difficulty removed - all questions are now PANCE-level
  mode?: 'standard' | 'review' | 'weakness' | 'random' | 'interleaved';
  excludeQuestionIds?: string[];
  minSystems?: number;
}

export interface EnrichedQuestion {
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

export interface SessionAnalytics {
  questionsServed: number;
  fromPool: number;
  fromMain: number;
  generated: number;
  fromSeeds: number;
  avgDifficulty: number;
  systemDistribution: Record<string, number>;
}

const NCCPA_BLUEPRINT_WEIGHTS: Record<string, number> = {
  Cardiovascular: 11,
  Pulmonary: 9,
  Gastrointestinal: 9,
  Musculoskeletal: 9,
  HEENT: 8,
  Reproductive: 8,
  Neurological: 7,
  Psychiatry: 7,
  Endocrine: 6,
  Dermatology: 5,
  Genitourinary: 5,
  Hematology: 4,
  'Infectious Disease': 4,
  Nephrology: 4,
  'Emergency Medicine': 2,
  General: 2, // Fallback for uncategorized
};

const SYSTEM_ALIASES: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  MSK: 'Musculoskeletal',
  NEURO: 'Neurological',
  PSYCH: 'Psychiatry',
  ENDO: 'Endocrine',
  DERM: 'Dermatology',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  ID: 'Infectious Disease',
  RENAL: 'Nephrology',
  EM: 'Emergency Medicine',
};

export class SessionService {
  private prisma: ReturnType<typeof createEdgePrismaClient>;
  private contentService: ContentService;
  private env: Env;

  constructor(databaseUrl: string, env: Env) {
    this.prisma = createEdgePrismaClient(databaseUrl);
    this.contentService = new ContentService(databaseUrl);
    this.env = env;
  }

  public async getSessionQuestions(params: SessionQuestionRequest): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    // All questions are now PANCE-level - no difficulty filtering needed
    const {
      userId,
      count = 10,
      system,
      conditionId,
      mode,
      excludeQuestionIds = [],
      minSystems = 3,
    } = params;

    // Use UserQuestionSeen for comprehensive tracking (replaces UserQuestionHistory)
    const seenRecords = await this.prisma.userQuestionSeen.findMany({
      where: { userId },
      select: { questionId: true, questionType: true },
    });
    const seenIds = new Set([...seenRecords.map((r) => r.questionId), ...excludeQuestionIds]);

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

    // If no specific system requested, use NCCPA blueprint distribution
    // All questions are PANCE-level - no difficulty filtering
    if (!system && !conditionId) {
      const systemQuotas = this.calculateNCCPAQuotas(count, minSystems);

      for (const [targetSystem, targetCount] of Object.entries(systemQuotas)) {
        const poolQ = await this.fetchFromPool(userId, seenIds, {
          count: targetCount,
          system: targetSystem,
        });
        questions.push(...poolQ.questions);
        analytics.fromPool += poolQ.questions.length;

        // If not enough from pool, try seeds
        const remaining = targetCount - poolQ.questions.length;
        if (remaining > 0 && mode !== 'review') {
          const seedQ = await this.expandFromSeeds(userId, seenIds, {
            count: remaining,
            system: targetSystem,
          });
          questions.push(...seedQ);
          analytics.fromSeeds += seedQ.length;
        }

        // If still not enough, try main questions
        const stillRemaining = targetCount - poolQ.questions.length - (analytics.fromSeeds || 0);
        if (stillRemaining > 0) {
          const mainQ = await this.fetchFromMain(userId, seenIds, {
            count: Math.min(stillRemaining, 5),
            system: targetSystem,
          });
          questions.push(...mainQ);
          analytics.fromMain += mainQ.length;
        }
      }

      // Shuffle for true randomization (interleaving)
      this.shuffleArray(questions);
    } else {
      // Original logic for specific system or condition
      const poolQuestions = await this.fetchFromPool(userId, seenIds, {
        count,
        system,
        conditionId,
      });
      questions.push(...poolQuestions.questions);
      analytics.fromPool = poolQuestions.questions.length;

      if (questions.length < count && mode !== 'review') {
        const seedQuestions = await this.expandFromSeeds(userId, seenIds, {
          count: count - questions.length,
          system,
          conditionId,
        });
        questions.push(...seedQuestions);
        analytics.fromSeeds = seedQuestions.length;
      }

      if (questions.length < count) {
        const mainQuestions = await this.fetchFromMain(userId, seenIds, {
          count: count - questions.length,
          system,
          conditionId,
        });
        questions.push(...mainQuestions);
        analytics.fromMain = mainQuestions.length;
      }
    }

    // Generate new questions if needed (only if we have less than requested)
    if (questions.length < count && this.env.GEMINI_API_KEY) {
      const generated = await this.generateNewQuestions({
        count: Math.min(count - questions.length, 5), // Limit AI generation
        system,
        conditionId,
      });
      questions.push(...generated);
      analytics.generated = generated.length;
    }

    const enriched = await this.enrichWithMedicalContent(questions);

    await this.recordQuestionSeen(userId, enriched);

    analytics.questionsServed = enriched.length;
    analytics.avgDifficulty = this.calculateAvgDifficulty(enriched);
    analytics.systemDistribution = this.calculateSystemDistribution(enriched);

    const poolCount = await this.prisma.preGeneratedQuestion.count({
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
   * Calculate NCCPA-weighted system quotas for a session
   * Ensures minimum system diversity while following blueprint percentages
   */
  private calculateNCCPAQuotas(totalCount: number, minSystems: number = 3): Record<string, number> {
    const systems = Object.keys(NCCPA_BLUEPRINT_WEIGHTS);
    const totalWeight = Object.values(NCCPA_BLUEPRINT_WEIGHTS).reduce((a, b) => a + b, 0);

    // Calculate proportional quotas
    const quotas: Record<string, number> = {};
    let remaining = totalCount;

    // Shuffle systems to add randomness in which systems get included
    const shuffledSystems = this.shuffleArray([...systems]);

    // Ensure minimum diversity: pick at least minSystems
    const selectedSystems = shuffledSystems.slice(
      0,
      Math.max(minSystems, Math.min(totalCount, systems.length))
    );

    for (const system of selectedSystems) {
      const weight = NCCPA_BLUEPRINT_WEIGHTS[system] || 2;
      // Calculate weighted portion, but ensure at least 1 question per selected system
      const portion = Math.max(1, Math.round((weight / totalWeight) * totalCount));
      quotas[system] = Math.min(portion, remaining);
      remaining -= quotas[system];

      if (remaining <= 0) break;
    }

    // Distribute any remaining to highest-weight systems
    if (remaining > 0) {
      const sortedByWeight = Object.entries(NCCPA_BLUEPRINT_WEIGHTS)
        .sort(([, a], [, b]) => b - a)
        .map(([s]) => s);

      for (const system of sortedByWeight) {
        if (remaining <= 0) break;
        quotas[system] = (quotas[system] || 0) + 1;
        remaining--;
      }
    }

    return quotas;
  }

  private async fetchFromPool(
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

    const where: Prisma.PreGeneratedQuestionWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;

    const poolQuestions = await this.prisma.preGeneratedQuestion.findMany({
      where,
      take: count * 3,
      orderBy: { generatedAt: 'asc' },
    });

    const questions: EnrichedQuestion[] = [];

    for (const q of poolQuestions) {
      if (questions.length >= count) break;
      if (seenIds.has(q.id)) continue;

      const data = q.questionData as Record<string, unknown>;
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
      seenIds.add(q.id);
    }
    return { questions };
  }

  private async expandFromSeeds(
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

    const where: Prisma.QuestionSeedWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;

    const seeds = await this.prisma.questionSeed.findMany({
      where,
      orderBy: { usageCount: 'asc' },
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

      const expandedQuestion = await this.expandSeedToQuestion(seed);
      if (expandedQuestion && !seenIds.has(expandedQuestion.id)) {
        questions.push(expandedQuestion);
        seenIds.add(expandedQuestion.id);

        await this.prisma.questionSeed.update({
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

  private async expandSeedToQuestion(seed: any): Promise<EnrichedQuestion | null> {
    try {
      const variables = seed.variables as Record<string, string[]>;

      let question = seed.template;
      for (const [key, values] of Object.entries(variables)) {
        const randomValue = values[Math.floor(Math.random() * values.length)];
        question = question.replace(new RegExp(`\\{${key}\\}`, 'g'), randomValue);
      }

      const distractors = seed.distractors as string[];
      const shuffledOptions = this.shuffleArray([seed.correctAnswer, ...distractors.slice(0, 3)]);
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

  private async fetchFromMain(
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

    const where: Prisma.QuestionWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;

    const dbQuestions = await this.prisma.question.findMany({
      where,
      take: count * 3,
      orderBy: { timesSeen: 'asc' },
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

      const options = Array.isArray(q.options) ? (q.options as string[]) : [];
      const correctIndex = options.findIndex((opt) => opt === q.correctAnswer);

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

    if (questionIdsToUpdate.length > 0) {
      await this.prisma.question.updateMany({
        where: { id: { in: questionIdsToUpdate } },
        data: { timesSeen: { increment: 1 } },
      });
    }

    return questions;
  }

  private async generateNewQuestions(options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
  }): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty } = options;

    const where: Prisma.MedicalContentWhereInput = { status: 'published' };
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;

    const contentRecords = await this.prisma.medicalContent.findMany({
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
        const generated = await this.generateQuestionFromContent(content, difficulty);
        if (generated) {
          questions.push(generated);

          await this.prisma.preGeneratedQuestion.create({
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

  private async generateQuestionFromContent(
    content: any,
    difficulty?: string
  ): Promise<EnrichedQuestion | null> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY as string);
    // Using gemini-2.5-pro for higher quality PANCE-style questions
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });

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

  private async enrichWithMedicalContent(
    questions: EnrichedQuestion[]
  ): Promise<EnrichedQuestion[]> {
    const conditionIds = questions
      .map((q) => q.conditionId)
      .filter((id): id is string => Boolean(id));

    if (conditionIds.length === 0) return questions;

    const contentMap = await this.contentService.getConditionsContent(conditionIds);

    return questions.map((q) => {
      if (!q.conditionId) return q;

      const content = contentMap.get(q.conditionId);
      if (!content) return q;

      return {
        ...q,
        condition: q.condition || content.condition,
        subcategory: q.subcategory || (content as any).subcategory,
        pearls: q.pearls.length > 0 ? q.pearls : content.clinical_pearls || [],
      };
    });
  }

  /**
   * Record questions as seen in UserQuestionSeen table
   * Uses upsert to increment timesShown for repeat views
   */
  private async recordQuestionSeen(userId: string, questions: EnrichedQuestion[]): Promise<void> {
    const now = new Date();

    // Map source to questionType enum value
    const sourceToType: Record<string, string> = {
      pool: 'pre_generated',
      main: 'question',
      seed: 'seed',
      generated: 'pre_generated',
    };

    // Use transactions for bulk upsert
    const upsertPromises = questions.map((q) =>
      this.prisma.userQuestionSeen.upsert({
        where: {
          userId_questionId_questionType: {
            userId,
            questionId: q.id,
            questionType: sourceToType[q.source] || 'question',
          },
        },
        update: {
          timesShown: { increment: 1 },
          lastSeenAt: now,
        },
        create: {
          userId,
          questionId: q.id,
          questionType: sourceToType[q.source] || 'question',
          firstSeenAt: now,
          lastSeenAt: now,
          timesShown: 1,
          timesCorrect: 0,
          timesIncorrect: 0,
        },
      })
    );

    await Promise.all(upsertPromises);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private calculateAvgDifficulty(questions: EnrichedQuestion[]): number {
    const difficultyMap: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
    const total = questions.reduce((sum, q) => sum + (difficultyMap[q.difficulty] || 2), 0);
    return questions.length > 0 ? total / questions.length : 2;
  }

  private calculateSystemDistribution(questions: EnrichedQuestion[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const q of questions) {
      dist[q.system] = (dist[q.system] || 0) + 1;
    }
    return dist;
  }

  public async disconnect() {
    await this.prisma.$disconnect();
    await this.contentService.disconnect();
  }
}
