import { v4 as uuidv4 } from 'uuid';
import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { ContentService } from '../content/contentService';
import { logger } from '../../logger';

const LOG_SCOPE = 'SessionService';
const MAX_RECENT_SEEN_IDS = 5_000;
import { normalizeOptionsToArray } from '../../utils/questionDataNormalizer';
import { resolveCorrectAnswerIndex } from '../../answerLetterMap';
import type { Env } from '../../../functions/api/_shared/auth';
import type { Prisma } from '@prisma/client';
import {
  NCCPA_2025_BLUEPRINT_PERCENT,
  getSystemAbbreviation,
  normalizeSystemName,
  calculateSimulationTargetDistribution,
  PANCE_SIMULATION_TO_ABBREVIATION,
} from '../../constants/blueprint';
import {
  type LearnerPhase,
  calculateOrderDistribution,
  selectQuestionOrder,
} from '../../nccpa-question-weighting';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../questionServingSafety';

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
  /** Learner phase for question order distribution (didactic/clinical/pance_prep) */
  learnerPhase?: LearnerPhase;
  /**
   * Session lane determines blueprint enforcement behavior:
   *   - 'main': ALWAYS blueprint-distributed (system param ignored). Pure PANCE-readiness.
   *   - 'eor': Allows rotation/system filtering for EOR prep. Separate from main stats.
   *   - 'drill': Per-drill routing (unchanged legacy behavior).
   * When omitted, defaults to legacy behavior (respects system param).
   */
  sessionLane?: 'main' | 'eor' | 'drill';
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

/**
 * Parse a legacy explanation string into structured rationale if it's stored as JSON.
 * The question-generator V2+ stores rationale as JSON.stringify() in the explanation column.
 * Older generators store flat strings. This function detects both.
 * Falls back to the raw string if parsing fails or the result isn't structured.
 */
export function parseRationaleFromExplanation(
  raw: unknown
): string | EnrichedRationale {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const trimmed = raw.trim();
  // Fast check: only attempt JSON parse if it looks like a JSON object
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'whyCorrect' in parsed
    ) {
      return parsed as EnrichedRationale;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
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
  /**
   * Review-pipeline identity. `questionSource` tells the submit-review resolver
   * which table `sourceQuestionId` belongs to; without it the client infers
   * 'question' from any non-derived id, which mis-routes pool/seed submissions.
   */
  questionSource: 'question' | 'pre_generated' | 'seed' | 'generated';
  canonicalQuestionId: string | null;
  sourceQuestionId: string;
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
      learnerPhase,
      sessionLane,
    } = params;

    // ── Blueprint enforcement for main sessions (Sprint 3) ──
    // When sessionLane is 'main', the session MUST be blueprint-distributed.
    // System/condition params are ignored so main sessions are a pure
    // representation of PANCE-readiness, never biased by current study focus.
    const isMainLane = sessionLane === 'main';
    const isEorLane = sessionLane === 'eor';

    // Core PANCE Simulation OR main lane: ignore single-system/weakness
    const forceBlueprint = simulationStrict || isMainLane;
    const effectiveSystem = forceBlueprint ? undefined : system;
    const effectiveConditionId = forceBlueprint ? undefined : conditionId;
    const effectiveMode = forceBlueprint ? 'standard' : mode;
    const panceLevelOnly = simulationStrict; // Only simulation restricts difficulty

    // Fetch seen records and pool count in parallel
    let seenRecords: Array<{ questionId: string; questionType: string }> = [];
    let poolCount = 0;
    try {
      [seenRecords, poolCount] = await Promise.all([
        this.prisma.userQuestionSeen.findMany({
          where: { userId },
          select: { questionId: true, questionType: true },
          orderBy: { lastSeenAt: 'desc' },
          take: MAX_RECENT_SEEN_IDS,
        }),
        this.prisma.preGeneratedQuestion.count({
          where: withProductionPregeneratedSafety({ usedAt: null }),
        }),
      ]);
    } catch (error) {
      logger.error(`[${LOG_SCOPE}] Failed to fetch seen records or pool count`, { error });
      // Continue with defaults (empty seen records, zero pool count)
    }

    const seenIds = new Set([...seenRecords.map((r) => r.questionId), ...excludeQuestionIds]);

    // EOR lane: always uses simple session with rotation-specific filtering
    if (isEorLane) {
      return this.fetchSimpleSession({
        userId,
        count,
        system,        // EOR keeps the original system param (rotation-specific)
        conditionId,   // EOR keeps condition filtering
        mode,
        panceLevelOnly: false,
        seenIds,
        poolCount,
        eorMode: true,
        eorDeadline,
        learnerPhase,
      });
    }

    // If specific system or condition requested (and NOT main lane), use simple fetch
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
        learnerPhase,
      });
    }

    // Main lane / simulation / multi-system: blueprint-distributed session
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
      learnerPhase,
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
    learnerPhase?: LearnerPhase;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, system, conditionId, mode, panceLevelOnly, seenIds, poolCount, eorMode = false, eorDeadline, learnerPhase } = options;

    // Use learner phase to prefer questions at the right Bloom's level.
    // selectQuestionOrder picks a weighted random order per the phase distribution.
    const preferredOrder = learnerPhase ? selectQuestionOrder(learnerPhase) : undefined;

    // Fetch from all sources in parallel with reasonable limits
    const [poolResult, seedQuestions, mainQuestions] = await Promise.all([
      this.fetchFromPool(userId, seenIds, {
        count: Math.min(count, 20), // Limit pool fetch
        system,
        conditionId,
        panceLevelOnly,
        eorMode,
        eorDeadline,
        questionOrder: preferredOrder,
      }),
      Promise.resolve([]),
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

    // Legacy /api/questions/session must fail closed to persisted, submit-safe
    // question identities. Mid-session generated and seed-expanded questions are
    // not served here because they do not carry a canonical persisted identity
    // that the review submission pipeline can reliably resolve.
    if (allQuestions.length < count && this.env.GEMINI_API_KEY) {
      logger.warn(`[${LOG_SCOPE}] Session shortfall left unfilled because learner hot-path generation is disabled`, {
        requested: count,
        available: allQuestions.length,
        system,
        conditionId,
      });
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
    learnerPhase?: LearnerPhase;
  }): Promise<{
    questions: EnrichedQuestion[];
    analytics: SessionAnalytics;
    poolStatus: { available: number; needsGeneration: boolean };
  }> {
    const { userId, count, simulationStrict, minSystems, panceLevelOnly, mode, seenIds, poolCount, eorMode = false, eorDeadline, learnerPhase } = options;

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

      // Pick a Bloom's level per system based on learner phase distribution
      const systemOrder = learnerPhase ? selectQuestionOrder(learnerPhase) : undefined;

      // Fetch from all sources in parallel for this system
      const [poolResult, seedQuestions, mainQuestions] = await Promise.all([
        this.fetchFromPool(userId, seenIds, {
          count: Math.min(targetCount, 10), // Limit per system
          system: systemAbbrev,
          panceLevelOnly,
          eorMode,
          eorDeadline,
          questionOrder: systemOrder,
        }),
        Promise.resolve([]),
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
      /** Filter by Bloom's taxonomy question order */
      questionOrder?: 'first' | 'second' | 'third';
      /** Filter by PANCE task category */
      taskCategory?: string;
    }
  ): Promise<{ questions: EnrichedQuestion[] }> {
    const { count, system, conditionId, difficulty, panceLevelOnly, eorMode = false, eorDeadline, questionOrder, taskCategory } = options;

    const where = withProductionPregeneratedSafety({}) as Prisma.PreGeneratedQuestionWhereInput;
    if (system) where.system = getSystemAbbreviation(system);
    if (conditionId) where.conditionId = conditionId;
    if (difficulty) where.difficulty = difficulty;
    if (panceLevelOnly) where.difficulty = { in: ['medium', 'hard'] };
    if (questionOrder) where.questionOrder = questionOrder;
    if (taskCategory) where.taskCategory = taskCategory;

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
      // Uses canonical converter — never silently falls back to 0
      let correctAnswerIndex: number;
      if (typeof data.correctAnswerIndex === 'number') {
        correctAnswerIndex = data.correctAnswerIndex;
      } else if (typeof data.correctAnswer === 'string') {
        const resolved = resolveCorrectAnswerIndex(data.correctAnswer as string, options);
        if (resolved === null) {
          // Skip this question — corrupt correctAnswer would silently mark the wrong option
          continue;
        }
        correctAnswerIndex = resolved;
      } else {
        // No correctAnswer at all — skip rather than silently defaulting to 0
        continue;
      }

      // Preserve structured rationale when present; fallback to string
      // parseRationaleFromExplanation handles JSON-stored structured rationales
      const rawRationale = data.rationale || data.explanation;
      const rationale =
        typeof rawRationale === 'object' &&
        rawRationale !== null &&
        !Array.isArray(rawRationale) &&
        'whyCorrect' in rawRationale
          ? (rawRationale as EnrichedRationale)
          : parseRationaleFromExplanation(rawRationale);

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
        questionSource: 'pre_generated',
        canonicalQuestionId: null,
        sourceQuestionId: q.id,
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
        rationale: parseRationaleFromExplanation(seed.explanation),
        system: seed.system || 'General',
        conditionId: seed.conditionId,
        condition: seed.Condition?.name,
        medicalContentId: undefined,
        pearls: [],
        difficulty: seed.difficulty,
        source: 'seed',
        questionSource: 'seed',
        canonicalQuestionId: null,
        sourceQuestionId: id,
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

    const where = withProductionQuestionSafety({}) as Prisma.QuestionWhereInput;
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

      // Canonical resolver — handles letter ("A"), numeric ("0"), and full-text formats.
      // Skip rows where correctAnswer cannot be resolved; silently falling back to
      // index 0 would mark option A as correct regardless of truth.
      if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) {
        logger.warn(`[${LOG_SCOPE}] Skipping question ${q.id} - missing correctAnswer`);
        continue;
      }
      const correctIndex = resolveCorrectAnswerIndex(q.correctAnswer, options);
      if (correctIndex === null) {
        logger.warn(
          `[${LOG_SCOPE}] Skipping question ${q.id} - correctAnswer "${q.correctAnswer}" does not match any option`
        );
        continue;
      }

      questions.push({
        id: q.id,
        question: q.question,
        vignette: q.vignette || undefined,
        options,
        correctAnswerIndex: correctIndex,
        rationale: parseRationaleFromExplanation(q.explanation),
        system: q.system,
        conditionId: q.conditionId || undefined,
        condition: q.Condition?.name,
        medicalContentId: q.medicalContentId ?? undefined,
        pearls: [],
        difficulty: q.difficulty || 'medium',
        source: 'main',
        questionSource: 'question',
        canonicalQuestionId: q.id,
        sourceQuestionId: q.id,
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

  private async enrichWithMedicalContent(
    questions: EnrichedQuestion[]
  ): Promise<EnrichedQuestion[]> {
    const conditionIds = questions
      .map((q) => q.conditionId)
      .filter((id): id is string => Boolean(id));

    if (conditionIds.length === 0) return questions;

    let contentMap: Map<string, any>;
    try {
      contentMap = await this.contentService?.getConditionsContent(conditionIds) ?? new Map();
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
        subcategory: q.subcategory || content.subcategory,
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
