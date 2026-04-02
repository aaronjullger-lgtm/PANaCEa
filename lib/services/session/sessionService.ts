import { v4 as uuidv4 } from 'uuid';
import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { ContentService } from '../content/contentService';
import { logger } from '../../logger';

const LOG_SCOPE = 'SessionService';
import { normalizeOptionsToArray } from '../../utils/questionDataNormalizer';
import { withTimeout } from '../../timeout';
import type { Env } from '../../../functions/api/_shared/auth';
import type { Prisma } from '@prisma/client';
import {
  NCCPA_2025_BLUEPRINT_PERCENT,
  PANCE_TASK_CATEGORY_PERCENT,
  getSystemAbbreviation,
  normalizeSystemName,
  calculateSimulationTargetDistribution,
  PANCE_SIMULATION_TO_ABBREVIATION,
} from '../../constants/blueprint';

/** Pick a random task category per NCCPA Blueprint weights (Sprint 5). */
function pickRandomTask(): string {
  const tasks = Object.keys(PANCE_TASK_CATEGORY_PERCENT) as (keyof typeof PANCE_TASK_CATEGORY_PERCENT)[];
  const weights = tasks.map((t) => PANCE_TASK_CATEGORY_PERCENT[t] || 0);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < tasks.length; i++) {
    r -= weights[i];
    if (r <= 0) return tasks[i].replace(/_/g, ' ');
  }
  return 'diagnosis';
}

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
  /** EOR rotation mode: filter by due date and stability, clamp to deadline */
  eorMode?: boolean;
  eorDeadline?: string;
}

/** Structured rationale format (shared with src/types and ExplanationPanel). */
export interface EnrichedRationale {
  bottomLine?: string;
  whyCorrect: string;
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  whyIncorrectE?: string;
  clinicalPearl?: string;
  highYieldImageOrTable?: string;
  commonPitfalls?: string[];
}

export interface EnrichedQuestion {
  id: string;
  question: string;
  vignette?: string;
  options: string[];
  correctAnswerIndex: number;
  /** Structured (object) or legacy string. Preserve object when available. */
  rationale: string | EnrichedRationale;
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
      eorMode = false,
      eorDeadline,
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
      logger.error(`[${LOG_SCOPE}] Failed to fetch seen records or pool count`, { error });
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
      eorMode,
      eorDeadline,
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
    eorMode?: boolean;
    eorDeadline?: string;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, system, conditionId, mode, panceLevelOnly, seenIds, poolCount, eorMode = false, eorDeadline } = options;

    // Fetch from all sources in parallel with reasonable limits
    const [poolResult, seedQuestions, mainQuestions] = await Promise.all([
      this.fetchFromPool(userId, seenIds, {
        count: Math.min(count, 20), // Limit pool fetch
        system,
        conditionId,
        panceLevelOnly,
        eorMode,
        eorDeadline,
      }),
      mode !== 'review' ? this.expandFromSeeds(userId, seenIds, {
        count: Math.max(0, Math.min(count - 5, 10)), // Reserve some for pool
        system,
        conditionId,
        panceLevelOnly,
        eorMode,
        eorDeadline,
      }) : Promise.resolve([]),
      this.fetchFromMain(userId, seenIds, {
        count: Math.max(0, Math.min(count - 10, 10)), // Reserve for pool and seeds
        system,
        conditionId,
        panceLevelOnly,
        eorMode,
        eorDeadline,
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

    // Sprint 7: If still short and Gemini available, generate new questions (with userId for FSRS hint)
    if (allQuestions.length < count && this.env.GEMINI_API_KEY) {
      try {
        const needed = count - allQuestions.length;
        const generated = await this.generateNewQuestions({
          count: needed,
          system,
          conditionId,
          userId,
        });
        for (const q of generated) {
          if (allQuestions.length >= count) break;
          if (!usedIds.has(q.id)) {
            allQuestions.push(q);
            usedIds.add(q.id);
          }
        }
      } catch (err) {
        logger.error(`[${LOG_SCOPE}] generateNewQuestions fallback failed`, { error: err });
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
    eorMode?: boolean;
    eorDeadline?: string;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, simulationStrict, minSystems, panceLevelOnly, mode, seenIds, poolCount, eorMode = false, eorDeadline } = options;

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
          eorMode,
          eorDeadline,
        }),
        mode !== 'review' ? this.expandFromSeeds(userId, seenIds, {
          count: Math.max(0, Math.min(targetCount - 2, 8)), // Reserve some for pool
          system: systemAbbrev,
          panceLevelOnly,
          eorMode,
          eorDeadline,
        }) : Promise.resolve([]),
        this.fetchFromMain(userId, seenIds, {
          count: Math.max(0, Math.min(targetCount - 5, 5)), // Reserve for pool and seeds
          system: systemAbbrev,
          panceLevelOnly,
          eorMode,
          eorDeadline,
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
      eorMode?: boolean;
      eorDeadline?: string;
    }
  ): Promise<{ questions: EnrichedQuestion[] }> {
    const { count, system, conditionId, difficulty, panceLevelOnly, eorMode = false, eorDeadline } = options;

    const where: Prisma.PreGeneratedQuestionWhereInput = {};
    if (system) where.system = getSystemAbbreviation(system);
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

      // Preserve structured rationale when present; fallback to string
      const rationale =
        typeof data.rationale === 'object' &&
        data.rationale !== null &&
        'whyCorrect' in (data.rationale as object)
          ? (data.rationale as EnrichedRationale)
          : ((data.rationale || data.explanation || '') as string);

      questions.push({
        id: q.id,
        question: (data.question || data.vignette || '') as string,
        vignette: data.vignette as string | undefined,
        options,
        correctAnswerIndex,
        rationale,
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
      eorMode?: boolean;
      eorDeadline?: string;
    }
  ): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty, panceLevelOnly, eorMode = false, eorDeadline } = options;

    const where: Prisma.QuestionSeedWhereInput = {};
    if (system) where.system = getSystemAbbreviation(system);
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
        // Skip empty values arrays to avoid replacing with "undefined"
        if (!Array.isArray(values) || values.length === 0) {
          logger.warn(`[${LOG_SCOPE}] Seed ${seed.id} has empty values for variable ${key}`);
          continue;
        }
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
      logger.error(`[${LOG_SCOPE}] Failed to expand seed`, { error });
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
      eorMode?: boolean;
      eorDeadline?: string;
    }
  ): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty, panceLevelOnly, eorMode = false, eorDeadline } = options;

    const where: Prisma.QuestionWhereInput = {};
    if (system) where.system = getSystemAbbreviation(system);
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;
    if (panceLevelOnly) where.difficulty = { in: ['medium', 'hard'] };

    // EOR mode: filter by due date and stability
    if (eorMode && eorDeadline) {
      const deadlineDate = new Date(eorDeadline);
      const thresholdStability = 100; // days
      const progressEntries = await this.prisma.userProgress.findMany({
        where: {
          userId,
          ...(system ? { system } : {}),
          OR: [
            { nextReviewAt: { lte: deadlineDate } },
            { fsrsStability: { lt: thresholdStability } },
            { nextReviewAt: null },
          ],
        },
        select: { conditionId: true },
      });
      const dueConditionIds = progressEntries.map(p => p.conditionId).filter(Boolean);
      if (dueConditionIds.length > 0) {
        where.conditionId = { in: dueConditionIds };
      }
      // Note: ordering by nextReviewAt is not implemented due to complexity
    }

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
        logger.warn(`[${LOG_SCOPE}] Skipping question ${q.id} - no valid options`);
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

  /**
   * Generate new questions on-demand when pool is exhausted mid-session.
   * Caps at MAX_SESSION_GENERATION to bound latency. Each question gets an
   * independent timeout so one slow generation doesn't block the rest.
   */
  private static readonly MAX_SESSION_GENERATION = 5;

  private async generateNewQuestions(options: {
    count: number;
    system?: string;
    conditionId?: string;
    difficulty?: string;
    userId?: string;
  }): Promise<EnrichedQuestion[]> {
    const { count, system, conditionId, difficulty, userId } = options;
    const cappedCount = Math.min(count, (this.constructor as typeof SessionService).MAX_SESSION_GENERATION);

    const where: Prisma.MedicalContentWhereInput = { status: 'published' };
    if (system) where.system = system;
    if (conditionId) where.conditionId = conditionId;

    const contentRecords = await this.prisma.medicalContent.findMany({
      where,
      take: cappedCount,
      orderBy: { updatedAt: 'desc' },
    });

    if (contentRecords.length === 0) {
      return [];
    }

    const questions: EnrichedQuestion[] = [];
    const generationStartMs = Date.now();

    for (const content of contentRecords) {
      if (questions.length >= cappedCount) break;

      try {
        const fsrsHint = await this.getFSRSDifficultyHint(userId, content.conditionId);
        const generated = await this.generateQuestionFromContent(content, difficulty, fsrsHint);
        if (generated) {
          questions.push(generated);

          // Save to pool for future sessions (non-blocking)
          this.prisma.preGeneratedQuestion.create({
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
          }).catch((err: unknown) => {
            logger.warn(`[${LOG_SCOPE}] Non-blocking pool save failed`, { error: err });
          });
        }
      } catch (error) {
        logger.error(`[${LOG_SCOPE}] Failed to generate question`, { error });
      }
    }

    const generationTimeMs = Date.now() - generationStartMs;
    logger.info(`[${LOG_SCOPE}] Mid-session generation completed`, {
      requested: count,
      capped: cappedCount,
      generated: questions.length,
      generationTimeMs,
    });

    return questions;
  }

  /** FSRS-driven difficulty hint (Sprint 6): low stability → classic; high stability → atypical */
  private async getFSRSDifficultyHint(
    userId: string | undefined,
    conditionId: string | undefined
  ): Promise<string> {
    if (!userId || !conditionId) return '';
    try {
      const up = await this.prisma.userProgress.findFirst({
        where: { userId, conditionId },
        select: { stability: true, fsrsCard: true },
      });
      if (!up) return '';
      const stability =
        typeof up.stability === 'number'
          ? up.stability
          : (up.fsrsCard as { stability?: number })?.stability;
      if (typeof stability !== 'number') return '';
      if (stability < 2) return 'Use classic presentation, straightforward case (low mastery).';
      if (stability > 10) return 'Use atypical presentation, multiple comorbidities, or rare side effect (high mastery).';
      return '';
    } catch {
      return '';
    }
  }

  private async generateQuestionFromContent(
    content: any,
    difficulty?: string,
    fsrsHint?: string
  ): Promise<EnrichedQuestion | null> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY as string);
    // Use flash model for mid-session generation (speed > depth; pro for batch generation)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7 },
    });

    // Pass findings-only context for vignette-building; withhold diagnosis/overview from vignette
    const findingsContext = [
      content.symptoms ? `Symptoms/Clinical Presentation: ${String(content.symptoms).slice(0, 400)}` : '',
      content.physicalExam ? `Physical Exam Findings: ${String(content.physicalExam).slice(0, 300)}` : '',
      content.diagnostics ? `Lab/Imaging Patterns: ${String(content.diagnostics).slice(0, 400)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `Generate a PANCE-style multiple choice question based on these clinical findings. Use them to build a vignette that presents RAW PATIENT DATA ONLY.

${findingsContext || 'Use typical findings for a common condition in this system.'}

Context for answer accuracy (do NOT include in vignette text): Treatment: ${String(content.treatment || 'N/A').slice(0, 300)}
Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

Difficulty: ${difficulty || 'medium'}
${fsrsHint ? `FSRS HINT: ${fsrsHint}` : ''}

CRITICAL - RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals). Example: "A 45-year-old male with fatigue. Labs: Hgb 9.2 g/dL, MCV 72 fL, ferritin 10 ng/mL" — NOT "A patient with iron deficiency anemia."

KAPLAN-LEVEL RULES:
- Third-order / "Double Jump" (STRICT): Prefer a stem that requires a chain (Vignette → Diagnosis → Complication/next step → Answer). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible. Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S).
- Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient. No obviously wrong options.
- Gold standard vs. initial: For "best initial step" or "next test" questions, include the gold standard as a distractor; rationale must clarify why wrong for this step.
- Next best step: For "next step in management," state what has already been done first, then ask for the immediate next action.
- Pertinent negatives: Include at least 2 pertinent negatives that rule out top differentials (e.g. "No JVD rules out tamponade; no pain on inspiration rules out pleuritis").
    - Pharmacological contraindications: For therapeutics questions, include a comorbid condition that contraindicates first-line when appropriate (e.g. HTN + gout → avoid thiazides; otitis + penicillin allergy → use macrolide).
- Task: This question should test ${pickRandomTask()} (per NCCPA task distribution).
- Red flag (optional): Occasionally include a subtle red flag that changes management (e.g. back pain + urinary incontinence → cauda equina). Do not make it obvious.

STANDARDIZED RATIONALE (5-section object, NCCPA-style): The "rationale" MUST be an object: bottomLine (one sentence: diagnosis + treatment), whyCorrect (walk through vignette findings → diagnosis → answer), whyIncorrectA/B/C/D/E (why a student might choose it; why wrong for THIS patient; when it WOULD be correct for another scenario), clinicalPearl (memorable hook), highYieldImageOrTable ("N/A" or brief description).

Return ONLY valid JSON (PANCE uses 5 options):
{
  "question": "Clinical vignette ending with a question (prefer third-order: mechanism, next step, or complication management)",
  "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
  "correctAnswerIndex": 0,
  "rationale": {
    "bottomLine": "The diagnosis is X, and the treatment is Y.",
    "whyCorrect": "Walk through vignette steps: findings → diagnosis → answer.",
    "whyIncorrectA": "Option A (Name): Incorrect because... Correct for [different scenario].",
    "whyIncorrectB": "Option B (Name): Incorrect because... Correct for [different scenario].",
    "whyIncorrectC": "Option C (Name): Incorrect because... Correct for [different scenario].",
    "whyIncorrectD": "Option D (Name): Incorrect because... Correct for [different scenario].",
    "whyIncorrectE": "Option E (Name): Incorrect because... Correct for [different scenario].",
    "clinicalPearl": "Remember: [pattern] = [condition] until proven otherwise.",
    "highYieldImageOrTable": "N/A"
  },
  "pearls": ["Pearl 1", "Pearl 2", "Pearl 3"]
}`;

    try {
      const result = await withTimeout(
        model.generateContent(prompt).then((r) => r.response.text()),
        8000,
        'Gemini generateContent timed out (8s mid-session)'
      );
      const text = result;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const data = JSON.parse(jsonMatch[0]);
      const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Accept rationale as object (structured) or string (legacy fallback)
      const rationale =
        typeof data.rationale === 'object' && data.rationale !== null && 'whyCorrect' in data.rationale
          ? data.rationale
          : (data.rationale as string) || '';

      return {
        id,
        question: data.question,
        options: data.options,
        correctAnswerIndex: data.correctAnswerIndex,
        rationale,
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
      logger.error(`[${LOG_SCOPE}] AI generation failed`, { error });
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
      logger.error(`[${LOG_SCOPE}] Failed to enrich with medical content`, { error });
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
      logger.error(`[${LOG_SCOPE}] Failed to record seen questions`, { error });
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
