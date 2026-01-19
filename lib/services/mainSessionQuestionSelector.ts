/**
 * Main Session Question Selector v2.0 - Interleaved Assembler
 *
 * Implements a scientifically rigorous question selection algorithm that
 * strictly enforces Interleaving (never same system twice in a row) and
 * Desirable Difficulty (prioritizing hardest "safe" cards).
 *
 * Key Changes from Priority Waterfall v1:
 * - MAX_SINGLE_SYSTEM_CAP: Caps any system at 8 questions (40%) to ensure
 *   interleaving is mathematically possible
 * - Lowest-R Fallback: When no overdue cards exist, selects stable cards
 *   with lowest retrievability (closest to forgetting threshold)
 * - Constraint-Satisfaction Assembler: Largest-first greedy algorithm that
 *   guarantees no two adjacent questions share the same system
 *
 * @module mainSessionQuestionSelector
 * @version 2.0.0
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  Rolling360Service,
  Rolling360Stats,
  normalizeSystemName,
  BlueprintWeights,
} from './rolling360Service';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default session size */
export const DEFAULT_SESSION_SIZE = 20;

/**
 * Maximum questions from a single system (40% of session)
 * Mathematical rationale: For strict interleaving (no adjacent same-system),
 * max per system must be ≤ ceil(n/2). Using 40% provides safety buffer.
 */
export const MAX_SINGLE_SYSTEM_CAP = 8;

/** Deficit threshold (%) before prioritizing a system */
export const DEFICIT_THRESHOLD = 2.0;

/** Legacy constant for backwards compatibility - DEPRECATED */
export const MAX_CONSECUTIVE_SAME_SYSTEM = 1; // Now strictly 1 (never repeat)

/** Minimum questions before applying full interleaving */
export const COLD_START_THRESHOLD = 50;

// =============================================================================
// TYPES
// =============================================================================

export interface SystemDeficit {
  system: string;
  targetPercent: number;
  actualPercent: number;
  deficitPercent: number;
  deficitQuestions: number; // How many questions needed (capped at MAX_SINGLE_SYSTEM_CAP)
}

export interface SelectedQuestion {
  questionId: string;
  conditionId: string | null;
  system: string;
  priority: 'A' | 'B' | 'C';
  source: 'fsrs_overdue' | 'fsrs_due' | 'fsrs_stable_lowest_r' | 'new_question';
  retrievability?: number;
}

/**
 * Tracks forced violations of interleaving constraints
 * Used for telemetry - logged but not blocking (Permissive Mode)
 */
export interface InterleavingViolation {
  position: number;
  system: string;
  reason: 'only_system_remaining' | 'pool_exhausted' | 'cold_start';
}

export interface SessionGenerationResult {
  questionIds: string[];
  questions: SelectedQuestion[];
  deficitsAddressed: SystemDeficit[];
  priorityBreakdown: {
    A: number; // Fixer (overdue + stable low-R)
    B: number; // Maintainer (due soon)
    C: number; // Explorer (new questions)
  };
  interleavingEnforced: boolean;
  /** Tracks any forced violations of strict interleaving (Permissive Mode) */
  interleavingViolations: InterleavingViolation[];
  /** Debug: system distribution in final session */
  systemDistribution: Record<string, number>;
}

// =============================================================================
// MAIN SESSION QUESTION SELECTOR CLASS
// =============================================================================

export class MainSessionQuestionSelector {
  private rolling360Service: Rolling360Service;

  constructor(private prisma: PrismaClient) {
    this.rolling360Service = new Rolling360Service(prisma);
  }

  /**
   * Main entry point - generates a session of questions using the Interleaved Assembler
   *
   * Algorithm:
   * 1. GATHERING PHASE: Select questions per system based on deficits, capped at 8/system
   * 2. ORDERING PHASE: Assemble using largest-first greedy to ensure strict interleaving
   */
  async generateSession(
    userId: string,
    sessionSize: number = DEFAULT_SESSION_SIZE
  ): Promise<SessionGenerationResult> {
    // Step 1: Get user's Rolling 360 stats and blueprint
    const stats = await this.rolling360Service.getRolling360Stats(userId);
    const blueprint = await this.getActiveBlueprint();

    // Step 2: Calculate system deficits (with cap applied)
    const deficits = this.calculateSystemDeficits(stats, blueprint, sessionSize);

    // Step 3: GATHERING PHASE - Build pools per system
    const systemPools = new Map<string, SelectedQuestion[]>();
    const deficitsAddressed: SystemDeficit[] = [];
    const priorityBreakdown = { A: 0, B: 0, C: 0 };

    // Track all selected question IDs to avoid duplicates
    const selectedIds = new Set<string>();

    // Priority A: Fill deficits with overdue FSRS cards OR stable lowest-R cards
    for (const deficit of deficits) {
      const quota = deficit.deficitQuestions;
      if (quota <= 0) continue;

      // Try overdue cards first
      const overdueQuestions = await this.selectOverdueCards(
        userId,
        deficit.system,
        quota,
        selectedIds
      );

      let collected = overdueQuestions.length;

      // Add to pool
      const pool = systemPools.get(deficit.system) || [];
      for (const q of overdueQuestions) {
        pool.push(q);
        selectedIds.add(q.questionId);
        priorityBreakdown.A++;
      }

      // If quota not met, fallback to stable cards with lowest retrievability
      if (collected < quota) {
        const stableQuestions = await this.selectStableCardsByLowestRetrievability(
          userId,
          deficit.system,
          quota - collected,
          selectedIds
        );

        for (const q of stableQuestions) {
          pool.push(q);
          selectedIds.add(q.questionId);
          priorityBreakdown.A++;
          collected++;
        }
      }

      if (pool.length > 0) {
        systemPools.set(deficit.system, pool);
        deficitsAddressed.push(deficit);
      }
    }

    // Calculate remaining slots after Priority A
    const priorityATotal = Array.from(systemPools.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    const remainingSlots = sessionSize - priorityATotal;

    // Priority B: Most urgent FSRS cards with interleaving consideration
    if (remainingSlots > 0) {
      const priorityBQuestions = await this.selectPriorityB(userId, selectedIds, remainingSlots);

      for (const q of priorityBQuestions) {
        const pool = systemPools.get(q.system) || [];
        // Enforce per-system cap
        if (pool.length < MAX_SINGLE_SYSTEM_CAP) {
          pool.push(q);
          systemPools.set(q.system, pool);
          selectedIds.add(q.questionId);
          priorityBreakdown.B++;
        }
      }
    }

    // Priority C: New/unseen questions to fill remaining slots
    const currentTotal = Array.from(systemPools.values()).reduce((sum, arr) => sum + arr.length, 0);
    const exploreSlotsNeeded = sessionSize - currentTotal;

    if (exploreSlotsNeeded > 0) {
      const priorityCQuestions = await this.selectPriorityC(
        userId,
        stats,
        selectedIds,
        exploreSlotsNeeded
      );

      for (const q of priorityCQuestions) {
        const pool = systemPools.get(q.system) || [];
        // Enforce per-system cap
        if (pool.length < MAX_SINGLE_SYSTEM_CAP) {
          pool.push(q);
          systemPools.set(q.system, pool);
          selectedIds.add(q.questionId);
          priorityBreakdown.C++;
        }
      }
    }

    // Step 4: ORDERING PHASE - Assemble with strict interleaving
    const { questions: assembled, violations } = this.assembleInterleavedSession(systemPools);

    // Calculate system distribution for telemetry
    const systemDistribution: Record<string, number> = {};
    for (const q of assembled) {
      systemDistribution[q.system] = (systemDistribution[q.system] || 0) + 1;
    }

    return {
      questionIds: assembled.map((q) => q.questionId),
      questions: assembled,
      deficitsAddressed,
      priorityBreakdown,
      interleavingEnforced: violations.length === 0,
      interleavingViolations: violations,
      systemDistribution,
    };
  }

  /**
   * Get active PANCE blueprint weights
   * Uses raw query to avoid Prisma client regeneration issues
   */
  private async getActiveBlueprint(): Promise<BlueprintWeights> {
    try {
      const results = await this.prisma.$queryRaw<Array<{ weights: any }>>`
        SELECT weights FROM "NCCPABlueprintConfig" 
        WHERE "isActive" = true 
        LIMIT 1
      `;

      if (results.length > 0 && results[0].weights) {
        return results[0].weights as BlueprintWeights;
      }
    } catch (error) {
      // Table may not exist yet or other error - use defaults
      console.warn('[MainSessionSelector] Blueprint query failed, using defaults:', error);
    }

    // Fallback to default 2024 PANCE weights (Official NCCPA)
    return {
      Cardiovascular: 0.13,
      Pulmonary: 0.1,
      Gastrointestinal: 0.1,
      Musculoskeletal: 0.1,
      HEENT: 0.09,
      Reproductive: 0.08,
      Neurological: 0.07,
      Psychiatry: 0.06,
      Endocrine: 0.06,
      Dermatology: 0.05,
      Genitourinary: 0.05,
      Hematology: 0.03,
      'Infectious Disease': 0.03,
      Renal: 0.05,
    };
  }

  /**
   * Calculate system deficits based on Rolling 360 stats vs blueprint
   * IMPORTANT: Applies MAX_SINGLE_SYSTEM_CAP to ensure interleaving is possible
   */
  private calculateSystemDeficits(
    stats: Rolling360Stats | null,
    blueprint: BlueprintWeights,
    sessionSize: number
  ): SystemDeficit[] {
    const deficits: SystemDeficit[] = [];

    if (!stats || stats.totalInWindow < COLD_START_THRESHOLD) {
      // Cold start - return all systems weighted by blueprint, capped
      for (const [system, weight] of Object.entries(blueprint)) {
        const idealQuestions = Math.ceil(weight * sessionSize);
        deficits.push({
          system,
          targetPercent: weight * 100,
          actualPercent: 0,
          deficitPercent: weight * 100,
          // CONSTRAINT 1: Cap at MAX_SINGLE_SYSTEM_CAP
          deficitQuestions: Math.min(idealQuestions, MAX_SINGLE_SYSTEM_CAP),
        });
      }
      return deficits.sort((a, b) => b.deficitPercent - a.deficitPercent);
    }

    // Calculate actual distribution from Rolling 360
    const total = stats.totalInWindow;

    for (const [system, targetWeight] of Object.entries(blueprint)) {
      const systemStats = stats.systemStats[system];
      const actualCount = systemStats?.total || 0;
      const actualPercent = (actualCount / total) * 100;
      const targetPercent = targetWeight * 100;
      const deficitPercent = targetPercent - actualPercent;

      if (deficitPercent > DEFICIT_THRESHOLD) {
        const idealQuestions = Math.ceil((deficitPercent / 100) * sessionSize);
        deficits.push({
          system,
          targetPercent,
          actualPercent,
          deficitPercent,
          // CONSTRAINT 1: Cap at MAX_SINGLE_SYSTEM_CAP
          deficitQuestions: Math.min(idealQuestions, MAX_SINGLE_SYSTEM_CAP),
        });
      }
    }

    // Sort by deficit (most deficit first)
    return deficits.sort((a, b) => b.deficitPercent - a.deficitPercent);
  }

  /**
   * Select overdue FSRS cards for a specific system
   */
  private async selectOverdueCards(
    userId: string,
    system: string,
    limit: number,
    excludeIds: Set<string>
  ): Promise<SelectedQuestion[]> {
    const now = new Date();

    const overdueCards = await this.prisma.userProgress.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now },
        MedicalContent: {
          system: system,
        },
      },
      include: {
        MedicalContent: {
          select: {
            id: true,
            system: true,
            conditionId: true,
          },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: limit * 2, // Fetch extra for filtering
    });

    const questions: SelectedQuestion[] = [];

    for (const card of overdueCards) {
      if (questions.length >= limit) break;

      const question = await this.prisma.preGeneratedQuestion.findFirst({
        where: {
          conditionId: card.conditionId,
          validationStatus: { in: ['approved', 'pending'] },
        },
        select: { id: true, system: true, conditionId: true },
      });

      if (
        question &&
        !excludeIds.has(question.id) &&
        !questions.some((q) => q.questionId === question.id)
      ) {
        const retrievability = this.calculateRetrievability(card.fsrsCard as any);
        questions.push({
          questionId: question.id,
          conditionId: question.conditionId,
          system: normalizeSystemName(question.system),
          priority: 'A',
          source: 'fsrs_overdue',
          retrievability,
        });
      }
    }

    return questions;
  }

  /**
   * CONSTRAINT 2: Select stable (non-overdue) cards sorted by lowest retrievability
   * Uses raw SQL for performance - computes R in database, not TypeScript
   *
   * FSRS v5 formula: R = (1 + elapsed_days / stability)^-1
   */
  private async selectStableCardsByLowestRetrievability(
    userId: string,
    system: string,
    limit: number,
    excludeIds: Set<string>
  ): Promise<SelectedQuestion[]> {
    if (limit <= 0) return [];

    const excludeArray = Array.from(excludeIds);

    try {
      // Raw SQL query with FSRS retrievability calculation in database
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          conditionId: string;
          system: string;
          current_r: number;
        }>
      >`
        SELECT 
          up.id,
          up."conditionId",
          mc.system,
          -- FSRS v5: R = (1 + elapsed_days / stability)^-1
          POWER(
            1.0 + (
              EXTRACT(EPOCH FROM (NOW() - (up."fsrsCard"->>'last_review')::timestamp)) 
              / 86400.0
            ) / GREATEST(COALESCE((up."fsrsCard"->>'stability')::float, 1.0), 0.1),
            -1
          )::float as current_r
        FROM "UserProgress" up
        JOIN "MedicalContent" mc ON up."conditionId" = mc."conditionId"
        WHERE up."userId" = ${userId}
          AND mc.system = ${system}
          AND up."nextReviewAt" > NOW()
          ${
            excludeArray.length > 0
              ? Prisma.sql`AND up.id NOT IN (${Prisma.join(excludeArray)})`
              : Prisma.empty
          }
          AND up."fsrsCard" IS NOT NULL
          AND (up."fsrsCard"->>'last_review') IS NOT NULL
        ORDER BY current_r ASC
        LIMIT ${limit * 2}
      `;

      // Map to questions
      const questions: SelectedQuestion[] = [];

      for (const r of results) {
        if (questions.length >= limit) break;

        const question = await this.prisma.preGeneratedQuestion.findFirst({
          where: {
            conditionId: r.conditionId,
            validationStatus: { in: ['approved', 'pending'] },
          },
          select: { id: true, system: true, conditionId: true },
        });

        if (
          question &&
          !excludeIds.has(question.id) &&
          !questions.some((q) => q.questionId === question.id)
        ) {
          questions.push({
            questionId: question.id,
            conditionId: question.conditionId,
            system: normalizeSystemName(r.system),
            priority: 'A',
            source: 'fsrs_stable_lowest_r',
            retrievability: r.current_r,
          });
        }
      }

      return questions;
    } catch (error) {
      // Fallback if raw query fails (e.g., missing fsrsCard data)
      console.warn('[MainSessionSelector] Raw query failed, using fallback:', error);
      return [];
    }
  }

  /**
   * Priority B: The Maintainer
   * Select most urgent FSRS cards (due within 24 hours)
   */
  private async selectPriorityB(
    userId: string,
    excludeIds: Set<string>,
    maxQuestions: number
  ): Promise<SelectedQuestion[]> {
    if (maxQuestions <= 0) return [];

    const now = new Date();
    const futureWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

    const dueCards = await this.prisma.userProgress.findMany({
      where: {
        userId,
        nextReviewAt: { lte: futureWindow, gt: now },
      },
      include: {
        MedicalContent: {
          select: {
            id: true,
            system: true,
            conditionId: true,
          },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: maxQuestions * 3,
    });

    const questions: SelectedQuestion[] = [];
    const excludeArray = Array.from(excludeIds);

    for (const card of dueCards) {
      if (questions.length >= maxQuestions) break;

      const question = await this.prisma.preGeneratedQuestion.findFirst({
        where: {
          conditionId: card.conditionId,
          validationStatus: { in: ['approved', 'pending'] },
          id: { notIn: excludeArray },
        },
        select: { id: true, system: true, conditionId: true },
      });

      if (
        question &&
        !excludeIds.has(question.id) &&
        !questions.some((q) => q.questionId === question.id)
      ) {
        const retrievability = this.calculateRetrievability(card.fsrsCard as any);
        questions.push({
          questionId: question.id,
          conditionId: question.conditionId,
          system: normalizeSystemName(question.system),
          priority: 'B',
          source: 'fsrs_due',
          retrievability,
        });
      }
    }

    return questions;
  }

  /**
   * Priority C: The Explorer
   * Select new/unseen questions from data-sparse systems
   */
  private async selectPriorityC(
    userId: string,
    stats: Rolling360Stats | null,
    excludeIds: Set<string>,
    maxQuestions: number
  ): Promise<SelectedQuestion[]> {
    if (maxQuestions <= 0) return [];

    const seenQuestionIds = await this.prisma.userQuestionSeen.findMany({
      where: { userId },
      select: { questionId: true },
    });
    const seenIds = new Set(seenQuestionIds.map((s) => s.questionId));

    const blueprint = await this.getActiveBlueprint();
    const systemPriority: { system: string; dataPoints: number }[] = [];

    for (const system of Object.keys(blueprint)) {
      const dataPoints = stats?.systemStats[system]?.total || 0;
      systemPriority.push({ system, dataPoints });
    }

    // Sort by least data first
    systemPriority.sort((a, b) => a.dataPoints - b.dataPoints);

    const questions: SelectedQuestion[] = [];
    const excludeArray = Array.from(excludeIds);
    const allExcluded = [...excludeArray, ...seenIds];

    for (const { system } of systemPriority) {
      if (questions.length >= maxQuestions) break;

      const newQuestions = await this.prisma.preGeneratedQuestion.findMany({
        where: {
          system,
          validationStatus: { in: ['approved', 'pending'] },
          id: { notIn: allExcluded },
        },
        select: { id: true, system: true, conditionId: true },
        take: Math.ceil(maxQuestions / systemPriority.length) + 1,
      });

      for (const q of newQuestions) {
        if (questions.length >= maxQuestions) break;
        if (!excludeIds.has(q.id) && !questions.some((existing) => existing.questionId === q.id)) {
          questions.push({
            questionId: q.id,
            conditionId: q.conditionId,
            system: normalizeSystemName(q.system),
            priority: 'C',
            source: 'new_question',
          });
        }
      }
    }

    return questions;
  }

  /**
   * ORDERING PHASE: Assemble questions ensuring no two adjacent have the same system
   * Uses "Largest-First Greedy" algorithm to handle hardest constraints first
   *
   * @param pools - Map of system name to array of questions
   * @returns Assembled questions and any forced violations
   */
  private assembleInterleavedSession(pools: Map<string, SelectedQuestion[]>): {
    questions: SelectedQuestion[];
    violations: InterleavingViolation[];
  } {
    const result: SelectedQuestion[] = [];
    const violations: InterleavingViolation[] = [];

    // Create working copy to avoid mutating input
    const workingPools = new Map<string, SelectedQuestion[]>();
    for (const [system, questions] of pools) {
      workingPools.set(system, [...questions]);
    }

    // Track which system was placed last
    let lastPlacedSystem: string | null = null;

    // Helper to check if any questions remain
    const hasQuestionsRemaining = (): boolean => {
      return Array.from(workingPools.values()).some((arr) => arr.length > 0);
    };

    // Iteratively pick questions
    while (hasQuestionsRemaining()) {
      // Sort systems by remaining pool size (LARGEST FIRST)
      // This ensures we handle the hardest constraints first
      const currentOrder = Array.from(workingPools.entries())
        .filter(([_, questions]) => questions.length > 0)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([system]) => system);

      let placed = false;

      for (const system of currentOrder) {
        // STRICT RULE: Cannot pick same system as last placed
        if (system !== lastPlacedSystem) {
          const pool = workingPools.get(system)!;
          const question = pool.shift()!;
          result.push(question);
          lastPlacedSystem = system;
          placed = true;
          break;
        }
      }

      // CORNER CASE: Forced to repeat (only one system has questions left)
      if (!placed && currentOrder.length > 0) {
        const forcedSystem = currentOrder[0];
        const pool = workingPools.get(forcedSystem)!;
        const question = pool.shift()!;
        result.push(question);
        lastPlacedSystem = forcedSystem;

        // LOG WARNING (Permissive Mode - don't crash)
        const violation: InterleavingViolation = {
          position: result.length - 1,
          system: forcedSystem,
          reason: 'only_system_remaining',
        };
        violations.push(violation);

        console.warn(
          `[Interleaver] FORCED REPEAT: ${forcedSystem} at position ${result.length}`,
          `- this indicates a selection phase issue or cold start scenario`
        );
      }
    }

    return { questions: result, violations };
  }

  /**
   * Calculate retrievability from FSRS card state
   * FSRS v5 formula: R = (1 + t/S)^-1
   */
  private calculateRetrievability(fsrsCard: any): number {
    if (!fsrsCard || !fsrsCard.stability || !fsrsCard.last_review) {
      return 0.9; // Default for new cards
    }

    const now = Date.now();
    const lastReview = new Date(fsrsCard.last_review).getTime();
    const elapsedDays = (now - lastReview) / (1000 * 60 * 60 * 24);

    const stability = Math.max(fsrsCard.stability || 1, 0.1);
    const retrievability = Math.pow(1 + elapsedDays / stability, -1);

    return Math.max(0, Math.min(1, retrievability));
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let selectorInstance: MainSessionQuestionSelector | null = null;

export function getMainSessionSelector(prisma: PrismaClient): MainSessionQuestionSelector {
  if (!selectorInstance) {
    selectorInstance = new MainSessionQuestionSelector(prisma);
  }
  return selectorInstance;
}

export default MainSessionQuestionSelector;
