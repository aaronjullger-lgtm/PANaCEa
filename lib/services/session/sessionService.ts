import { v4 as uuidv4 } from 'uuid';
import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { ContentService } from '../content/contentService';
import { normalizeOptionsToArray } from '../../utils/questionDataNormalizer';
import type { Env } from '../../../functions/api/_shared/auth';
import type { Prisma } from '@prisma/client';
import {
  NCCPA_2025_BLUEPRINT_PERCENT,
  getSystemAbbreviation,
  normalizeSystemName,
  calculateSimulationTargetDistribution,
  PANCE_SIMULATION_TO_ABBREVIATION,
} from '../../constants/blueprint';

// Interfaces moved from session.ts to be used in the service
export interface SessionQuestionRequest {
  userId: string;
  count?: number;
  system?: string;
  conditionId?: string;
  mode?: 'standard' | 'review' | 'weakness' | 'random' | 'interleaved';
  excludeQuestionIds?: string[];
  minSystems?: number;
  /** Core PANCE Simulation: strict NCCIPA blueprint, no weak-area bias, PANCE-level difficulty only */
  simulationStrict?: boolean;
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

// Blueprint weights imported from lib/constants/blueprint.ts (single source of truth)
// Using NCCPA_2025_BLUEPRINT_PERCENT for integer percentages

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
    const {
      userId,
      count = 10,
      system,
      conditionId,
      mode,
      excludeQuestionIds = [],
      minSystems = 3,
      simulationStrict = false,
    } = params;

    // Core PANCE Simulation: ignore single-system/weakness — strict blueprint only
    const effectiveSystem = simulationStrict ? undefined : system;
    const effectiveConditionId = simulationStrict ? undefined : conditionId;
    const effectiveMode = simulationStrict ? 'standard' : mode;
    const panceLevelOnly = simulationStrict;

    // Fetch seen records and pool count in parallel
    let seenRecords: Array<{ questionId: string; questionType: string }> = [];
    let poolCount = 0;
    try {
      [seenRecords, poolCount] = await Promise.all([
        this.prisma.userQuestionSeen.findMany({
          where: { userId },
          select: { questionId: true, questionType: true },
        }),
        this.prisma.preGeneratedQuestion.count({
          where: { usedAt: null },
        }),
      ]);
    } catch (error) {
      console.error('[SessionService] Failed to fetch seen records or pool count:', error);
      // Continue with defaults (empty seen records, zero pool count)
    }
    
    const seenIds = new Set([...seenRecords.map((r) => r.questionId), ...excludeQuestionIds]);

    // If specific system or condition requested, use optimized simple fetch
    if (effectiveSystem || effectiveConditionId) {
      return this.fetchSimpleSession({
        userId,
        count,
        system: effectiveSystem,
        conditionId: effectiveConditionId,
        mode: effectiveMode,
        panceLevelOnly,
        seenIds,
        poolCount,
      });
    }

    // Multi-system session with blueprint distribution - use parallel execution
    return this.fetchMultiSystemSession({
      userId,
      count,
      simulationStrict,
      minSystems,
      panceLevelOnly,
      mode: effectiveMode,
      seenIds,
      poolCount,
    });
  }

  private async fetchSimpleSession(options: {
    userId: string;
    count: number;
    system?: string;
    conditionId?: string;
    mode?: string;
    panceLevelOnly: boolean;
    seenIds: Set<string>;
    poolCount: number;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, system, conditionId, mode, panceLevelOnly, seenIds, poolCount } = options;

    // Fetch from all sources in parallel with reasonable limits
    const [poolResult, seedQuestions, mainQuestions] = await Promise.all([
      this.fetchFromPool(userId, seenIds, {
        count: Math.min(count, 20), // Limit pool fetch
        system,
        conditionId,
        panceLevelOnly,
      }),
      mode !== 'review' ? this.expandFromSeeds(userId, seenIds, {
        count: Math.max(0, Math.min(count - 5, 10)), // Reserve some for pool
        system,
        conditionId,
        panceLevelOnly,
      }) : Promise.resolve([]),
      this.fetchFromMain(userId, seenIds, {
        count: Math.max(0, Math.min(count - 10, 10)), // Reserve for pool and seeds
        system,
        conditionId,
        panceLevelOnly,
      }),
    ]);

    // Combine results, avoiding duplicates
    const allQuestions: EnrichedQuestion[] = [];
    const usedIds = new Set<string>();

    // Add pool questions first (highest quality)
    for (const q of poolResult.questions) {
      if (allQuestions.length >= count) break;
      if (!usedIds.has(q.id)) {
        allQuestions.push(q);
        usedIds.add(q.id);
      }
    }

    // Add seed questions
    for (const q of seedQuestions) {
      if (allQuestions.length >= count) break;
      if (!usedIds.has(q.id)) {
        allQuestions.push(q);
        usedIds.add(q.id);
      }
    }

    // Add main questions
    for (const q of mainQuestions) {
      if (allQuestions.length >= count) break;
      if (!usedIds.has(q.id)) {
        allQuestions.push(q);
        usedIds.add(q.id);
      }
    }

    // Trim to exact count
    const questions = allQuestions.slice(0, count);

    // Enrich and record
    const enriched = await this.enrichWithMedicalContent(questions);
    await this.recordQuestionSeen(userId, enriched);

    const analytics = this.calculateAnalytics(enriched);

    return {
      questions: enriched,
      analytics,
      poolStatus: {
        available: poolCount,
        needsGeneration: poolCount < 50,
      },
    };
  }

  private async fetchMultiSystemSession(options: {
    userId: string;
    count: number;
    simulationStrict: boolean;
    minSystems: number;
    panceLevelOnly: boolean;
    mode?: string;
    seenIds: Set<string>;
    poolCount: number;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, simulationStrict, minSystems, panceLevelOnly, mode, seenIds, poolCount } = options;

    // Calculate system distribution
    const systemQuotas = simulationStrict
      ? calculateSimulationTargetDistribution(count)
      : this.calculateNCCPAQuotas(count, minSystems);

    // Prepare fetch tasks for all systems (functions that return promises)
    const systemFetchTasks = Object.entries(systemQuotas).map(([targetSystem, targetCount]) => async () => {
      if (targetCount <= 0) return [];

      const systemAbbrev = simulationStrict
        ? (PANCE_SIMULATION_TO_ABBREVIATION[targetSystem] ?? targetSystem)
        : getSystemAbbreviation(targetSystem);

      // Fetch from all sources in parallel for this system
      const [poolResult, seedQuestions, mainQuestions] = await Promise.all([
        this.fetchFromPool(userId, seenIds, {
          count: Math.min(targetCount, 10), // Limit per system
          system: systemAbbrev,
          panceLevelOnly,
        }),
        mode !== 'review' ? this.expandFromSeeds(userId, seenIds, {
          count: Math.max(0, Math.min(targetCount - 2, 8)), // Reserve some for pool
          system: systemAbbrev,
          panceLevelOnly,
        }) : Promise.resolve([]),
        this.fetchFromMain(userId, seenIds, {
          count: Math.max(0, Math.min(targetCount - 5, 5)), // Reserve for pool and seeds
          system: systemAbbrev,
          panceLevelOnly,
        }),
      ]);

      // Combine results for this system
      const systemQuestions: EnrichedQuestion[] = [];
      const usedIds = new Set<string>();

      // Add pool questions
      for (const q of poolResult.questions) {
        if (systemQuestions.length >= targetCount) break;
        if (!usedIds.has(q.id)) {
          systemQuestions.push(q);
          usedIds.add(q.id);
        }
      }

      // Add seed questions
      for (const q of seedQuestions) {
        if (systemQuestions.length >= targetCount) break;
        if (!usedIds.has(q.id)) {
          systemQuestions.push(q);
          usedIds.add(q.id);
        }
      }

      // Add main questions
      for (const q of mainQuestions) {
        if (systemQuestions.length >= targetCount) break;
        if (!usedIds.has(q.id)) {
          systemQuestions.push(q);
          usedIds.add(q.id);
        }
      }

      return systemQuestions.slice(0, targetCount);
    });

    // Execute system fetches in batches to avoid overwhelming the database
    const concurrencyLimit = 3;
    const systemResults = [];
    for (let i = 0; i < systemFetchTasks.length; i += concurrencyLimit) {
      const batch = systemFetchTasks.slice(i, i + concurrencyLimit).map(task => task());
      const batchResults = await Promise.all(batch);
      systemResults.push(...batchResults);
    }
    const allQuestions = systemResults.flat();

    // Shuffle the combined questions
    this.shuffleArray(allQuestions);

    // Trim to exact count (in case of rounding issues)
    const questions = allQuestions.slice(0, count);

    // Enrich and record
    const enriched = await this.enrichWithMedicalContent(questions);
    await this.recordQuestionSeen(userId, enriched);

    const analytics = this.calculateAnalytics(enriched);

    return {
      questions: enriched,
      analytics,
      poolStatus: {
        available: poolCount,
        needsGeneration: poolCount < 50,
      },
    };
  }

  private calculateAnalytics(questions: EnrichedQuestion[]): SessionAnalytics {
    const difficultyMap: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
    const totalDifficulty = questions.reduce((sum, q) => sum + (difficultyMap[q.difficulty] || 2), 0);
    const avgDifficulty = questions.length > 0 ? totalDifficulty / questions.length : 2;

    const systemDistribution: Record<string, number> = {};
    for (const q of questions) {
      systemDistribution[q.system] = (systemDistribution[q.system] || 0) + 1;
    }

    return {
      questionsServed: questions.length,
      fromPool: questions.filter(q => q.source === 'pool').length,
      fromMain: questions.filter(q => q.source === 'main').length,
      generated: questions.filter(q => q.source === 'generated').length,
      fromSeeds: questions.filter(q => q.source === 'seed').length,
      avgDifficulty,
      systemDistribution,
    };
  }

  /**
   * Calculate NCCPA-weighted system quotas for a session
   * Ensures minimum system diversity while following blueprint percentages
   * Uses NCCPA_2025_BLUEPRINT_PERCENT from lib/constants/blueprint.ts (single source of truth)
   */
  private calculateNCCPAQuotas(totalCount: number, minSystems: number = 3): Record<string, number> {
    const systems = Object.keys(NCCPA_2025_BLUEPRINT_PERCENT);
    const totalWeight = Object.values(NCCPA_2025_BLUEPRINT_PERCENT).reduce((a, b) => a + b, 0);

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
      const weight = NCCPA_2025_BLUEPRINT_PERCENT[system] || 2;
      // Calculate weighted portion, but ensure at least 1 question per selected system
      const portion = Math.max(1, Math.round((weight / totalWeight) * totalCount));
      quotas[system] = Math.min(portion, remaining);
      remaining -= quotas[system];

      if (remaining <= 0) break;
    }

    // Distribute any remaining to highest-weight systems
    if (remaining > 0) {
      const sortedByWeight = Object.entries(NCCPA_2025_BLUEPRINT_PERCENT)
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
      /** Exclude easy; only medium/hard (PANCE-level) */
      panceLevelOnly?: boolean;
    }
  ): Promise<{ questions: EnrichedQuestion[] }> {
    const { count, system, conditionId, difficulty, panceLevelOnly } = options;

    const where: Prisma.PreGeneratedQuestionWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;
    if (panceLevelOnly) where.difficulty = { in: ['medium', 'hard'] };

    // Optimize: fetch only what we need plus a small buffer, not count * 3
    // For large counts, limit to reasonable size to prevent timeouts
    const fetchLimit = Math.min(count + 20, 50); // Max 50 questions per fetch
    const poolQuestions = await this.prisma.preGeneratedQuestion.findMany({
      where,
      take: fetchLimit,
      orderBy: { generatedAt: 'desc' }, // Prefer newer questions
    });

    // Filter out seen questions efficiently
    const unseenQuestions = poolQuestions.filter(q => !seenIds.has(q.id));
    
    // Shuffle for randomness
    const shuffledPool = this.shuffleArray(unseenQuestions);

    const questions: EnrichedQuestion[] = [];

    for (const q of shuffledPool) {
      if (questions.length >= count) break;

      const data = q.questionData as Record<string, unknown>;
      const optionsData = data.options || data.answers || data.choices;
      const options = Array.isArray(optionsData) ? (optionsData as string[]) : [];

      // Handle both correctAnswerIndex (number) and correctAnswer (letter) formats
      let correctAnswerIndex: number;
      if (typeof data.correctAnswerIndex === 'number') {
        correctAnswerIndex = data.correctAnswerIndex;
      } else if (typeof data.correctAnswer === 'string') {
        // Convert letter ("A", "B", "C", "D") to index (0, 1, 2, 3)
        const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
        correctAnswerIndex = letterToIndex[data.correctAnswer.toUpperCase()] ?? 0;
      } else {
        correctAnswerIndex = 0;
      }

      questions.push({
        id: q.id,
        question: (data.question || data.vignette || '') as string,
        vignette: data.vignette as string | undefined,
        options,
        correctAnswerIndex,
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
      panceLevelOnly?: boolean;
    }
  ): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty, panceLevelOnly } = options;

    const where: Prisma.QuestionSeedWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;
    if (panceLevelOnly) where.difficulty = { in: ['medium', 'hard'] };

    const seeds = await this.prisma.questionSeed.findMany({
      where,
      orderBy: { usageCount: 'asc' },
      take: count,
      include: {
        Condition: { select: { name: true } },
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
        medicalContentId: undefined,
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
      panceLevelOnly?: boolean;
    }
  ): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty, panceLevelOnly } = options;

    const where: Prisma.QuestionWhereInput = {};
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;
    if (panceLevelOnly) where.difficulty = { in: ['medium', 'hard'] };

    // Optimize: fetch only what we need plus a small buffer, not count * 3
    const fetchLimit = Math.min(count + 15, 30); // Max 30 questions per fetch
    const dbQuestions = await this.prisma.question.findMany({
      where,
      take: fetchLimit,
      orderBy: { timesSeen: 'asc' },
      include: {
        Condition: { select: { name: true } },
      },
    });

    const questions: EnrichedQuestion[] = [];
    const questionIdsToUpdate: string[] = [];

    for (const q of dbQuestions) {
      if (questions.length >= count) break;
      if (seenIds.has(q.id)) continue;

      const options = normalizeOptionsToArray(q.options);
      if (options.length === 0) {
        console.warn(`[SessionService] Skipping question ${q.id} - no valid options`);
        continue;
      }
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
        medicalContentId: q.medicalContentId ?? undefined,
        pearls: [],
        difficulty: q.difficulty || 'medium',
        source: 'main',
      });
      seenIds.add(q.id);
      questionIdsToUpdate.push(q.id);
    }

    // Batch update timesSeen if we have questions
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
    // Stable model for PANCE-style question generation (preview IDs change; use stable)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = `Generate a PANCE-style multiple choice question about ${content.condition}.

Condition Overview: ${content.overview || 'N/A'}
Key Diagnostics: ${content.diagnostics || 'N/A'}
Treatment: ${content.treatment || 'N/A'}
Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

Difficulty: ${difficulty || 'medium'}

KAPLAN-LEVEL RULES:
- Third-order / "Double Jump": Prefer a stem that requires a chain (Vignette → Diagnosis → Complication/next step → Answer). Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible.
- Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient (e.g. otitis: viral vs bacterial vs recurrent vs penicillin-allergic). No obviously wrong options.

Return ONLY valid JSON:
{
  "question": "Clinical vignette ending with a question (prefer third-order: mechanism, next step, or complication management)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswerIndex": 0,
  "rationale": "Why the correct answer is correct; briefly why each wrong answer is wrong for this patient",
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

    let contentMap: Map<string, any>;
    try {
      contentMap = await this.contentService.getConditionsContent(conditionIds);
    } catch (error) {
      console.error('[SessionService] Failed to enrich with medical content:', error);
      // Return original questions without enrichment
      return questions;
    }

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
          id: uuidv4(),
          userId,
          questionId: q.id,
          questionType: sourceToType[q.source] || 'question',
          firstSeenAt: now,
          lastSeenAt: now,
          timesShown: 1,
          timesCorrect: 0,
          timesIncorrect: 0,
          updatedAt: now,
        },
      })
    );

    try {
      await Promise.all(upsertPromises);
    } catch (error) {
      // Log error but do not fail the session
      console.error('[SessionService] Failed to record seen questions:', error);
      // Continue without throwing
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = result[i]!;
      const b = result[j]!;
      result[i] = b;
      result[j] = a;
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
