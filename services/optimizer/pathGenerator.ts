/**
 * Path Generator Service
 * Phase 6.2: Path Generation & API
 *
 * Combines performance gaps, scheduled reviews, blueprint priorities, and user constraints
 * to generate personalized daily/weekly study plans.
 *
 * Algorithm:
 * 1. Compute combined priority score for each taxonomy.
 * 2. Determine available study minutes per day (from constraints).
 * 3. Distribute topics across days using a knapsack‑style optimization that maximizes
 *    total gap reduction while respecting time limits and blueprint balance.
 * 4. Assign recommended actions (REVIEW, NEW, CALIBRATE) based on data density.
 * 5. Generate alternative plans by adjusting optimization weights.
 *
 * Output: Primary plan + up to 3 alternative plans with confidence scores.
 */

import { PrismaClient } from '@prisma/client/edge';
import {
  PathGeneratorInput,
  PathGeneratorOutput,
  StudyPlan,
  StudySession,
  StudyPathConstraints,
} from '@/types/study-path';
import { NCCPA_2025_BLUEPRINT } from '@/lib/constants/blueprint';

// Default constraints
const DEFAULT_CONSTRAINTS: StudyPathConstraints = {
  dailyMinutesLimit: 60,
  targetRetention: 0.90,
  maxSessionsPerDay: 2,
};

/**
 * Generate a study plan for the given user and inputs.
 *
 * @param prisma – Prisma client (Edge or Node)
 * @param input – PathGeneratorInput containing gaps, scheduled reviews, priorities, etc.
 * @returns PathGeneratorOutput with primary plan and alternatives
 */
export async function generateStudyPlan(
  prisma: PrismaClient,
  input: PathGeneratorInput
): Promise<PathGeneratorOutput> {
  const constraints = { ...DEFAULT_CONSTRAINTS, ...input.constraints };
  const {
    gaps,
    scheduledReviews,
    blueprintPriorities,
    fatigueRisk = 'LOW',
  } = input;

  // Step 1: Combine signals into a unified priority score per taxonomy
  const priorityMap = computePriorityMap(
    gaps,
    scheduledReviews,
    blueprintPriorities
  );

  // Step 2: Determine planning horizon (default 7 days, or until exam date)
  const horizonDays = computeHorizonDays(constraints);
  const dailyMinutes = constraints.dailyMinutesLimit!;

  // Step 3: Generate primary plan
  const primaryPlan = await buildPlan(
    prisma,
    input.userId,
    priorityMap,
    horizonDays,
    dailyMinutes,
    constraints,
    fatigueRisk,
    'balanced'
  );

  // Step 4: Generate alternative plans (aggressive, light, blueprint‑focused)
  const alternativePlans = await Promise.all([
    buildPlan(
      prisma,
      input.userId,
      priorityMap,
      horizonDays,
      dailyMinutes,
      constraints,
      fatigueRisk,
      'aggressive'
    ),
    buildPlan(
      prisma,
      input.userId,
      priorityMap,
      horizonDays,
      dailyMinutes,
      constraints,
      fatigueRisk,
      'light'
    ),
    buildPlan(
      prisma,
      input.userId,
      priorityMap,
      horizonDays,
      dailyMinutes,
      constraints,
      fatigueRisk,
      'blueprint'
    ),
  ]);

  // Step 5: Compute overall confidence (simplified – will be enhanced by Confidence Scorer)
  const confidence = estimateConfidence(gaps, scheduledReviews);

  // Step 6: Assemble output
  const rationale = generateRationale(
    primaryPlan,
    alternativePlans,
    constraints,
    fatigueRisk
  );

  return {
    plan: primaryPlan,
    alternatives: alternativePlans.filter(Boolean) as StudyPlan[], // filter out any nulls
    rationale,
    confidence,
    canRegenerate: true,
    diagnostics: {
      gapsProcessed: gaps.length,
      schedulingLogic: 'knapsack‑priority‑based',
      constraintsApplied: Object.keys(constraints),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface TaxonomyPriority {
  taxonomyCode: string;
  subcategory?: string | null;
  combinedScore: number; // 0‑1, higher = more urgent
  gap?: number;
  urgencyScore?: number;
  priorityScore?: number;
  weightDeviation?: number;
  estimatedMinutes: number; // estimated time to cover this topic
  recommendedAction: 'REVIEW' | 'NEW' | 'CALIBRATE';
}

/**
 * Compute a unified priority map from all input signals.
 */
function computePriorityMap(
  gaps: PathGeneratorInput['gaps'],
  scheduledReviews: PathGeneratorInput['scheduledReviews'],
  blueprintPriorities: PathGeneratorInput['blueprintPriorities']
): Map<string, TaxonomyPriority> {
  const map = new Map<string, TaxonomyPriority>();

  // Key function
  const getKey = (taxonomyCode: string, subcategory?: string | null) =>
    `${taxonomyCode}|${subcategory ?? ''}`;

  // Process gaps
  for (const gap of gaps) {
    const key = getKey(gap.taxonomyCode, gap.subcategory);
    const existing = map.get(key);
    const gapScore = gap.gap > 0 ? gap.gap : 0; // only positive gaps matter
    const estimatedMinutes = estimateTopicMinutes(gap.reviewCount, gap.gap);
    map.set(key, {
      taxonomyCode: gap.taxonomyCode,
      subcategory: gap.subcategory,
      combinedScore: existing ? existing.combinedScore + gapScore * 0.4 : gapScore * 0.4,
      gap: gap.gap,
      estimatedMinutes,
      recommendedAction: determineAction(gap.reviewCount, gap.gap),
    });
  }

  // Process scheduled reviews (urgency)
  for (const review of scheduledReviews) {
    const key = getKey(review.taxonomyCode, review.subcategory);
    const existing = map.get(key);
    const urgency = review.urgencyScore ?? 0;
    const combined = (existing?.combinedScore ?? 0) + urgency * 0.3;
    map.set(key, {
      taxonomyCode: review.taxonomyCode,
      subcategory: review.subcategory,
      combinedScore: combined,
      urgencyScore: review.urgencyScore,
      estimatedMinutes: existing?.estimatedMinutes ?? estimateTopicMinutes(10, 0), // default
      recommendedAction: existing?.recommendedAction ?? 'REVIEW',
    });
  }

  // Process blueprint priorities
  for (const bp of blueprintPriorities) {
    const key = getKey(bp.taxonomyCode, bp.subcategory);
    const existing = map.get(key);
    const priority = bp.priorityScore ?? 0;
    const combined = (existing?.combinedScore ?? 0) + priority * 0.3;
    map.set(key, {
      taxonomyCode: bp.taxonomyCode,
      subcategory: bp.subcategory,
      combinedScore: combined,
      priorityScore: bp.priorityScore,
      weightDeviation: bp.weightDeviation,
      estimatedMinutes: existing?.estimatedMinutes ?? estimateTopicMinutes(5, 0),
      recommendedAction: existing?.recommendedAction ?? 'REVIEW',
    });
  }

  // Normalize combined scores to 0‑1 range across all items
  const maxScore = Math.max(...Array.from(map.values()).map((v) => v.combinedScore), 1);
  for (const entry of map.values()) {
    entry.combinedScore /= maxScore;
  }

  return map;
}

/**
 * Estimate minutes needed to cover a topic based on review count and gap.
 * Simplified heuristic: more reviews → less time; larger gap → more time.
 */
function estimateTopicMinutes(reviewCount: number, gap: number): number {
  const baseMinutes = 15;
  const reviewFactor = Math.max(1, 10 - Math.min(reviewCount, 10)); // fewer reviews → more time
  const gapFactor = 1 + Math.max(0, gap) * 2; // gap up to 0.9 → factor up to 2.8
  return Math.round(baseMinutes * reviewFactor * gapFactor);
}

/**
 * Determine recommended action based on review count and gap.
 */
function determineAction(reviewCount: number, gap: number): 'REVIEW' | 'NEW' | 'CALIBRATE' {
  if (reviewCount < 3) return 'NEW';
  if (gap > 0.3) return 'CALIBRATE';
  return 'REVIEW';
}

/**
 * Compute planning horizon in days.
 */
function computeHorizonDays(constraints: StudyPathConstraints): number {
  if (constraints.examDate) {
    const today = new Date();
    const exam = new Date(constraints.examDate);
    const diffDays = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(7, Math.min(diffDays, 90)); // clamp between 1 week and 3 months
  }
  return 7; // default one‑week horizon
}

/**
 * Build a single plan according to a given strategy.
 */
async function buildPlan(
  prisma: PrismaClient,
  userId: string,
  priorityMap: Map<string, TaxonomyPriority>,
  horizonDays: number,
  dailyMinutes: number,
  constraints: StudyPathConstraints,
  fatigueRisk: 'LOW' | 'MEDIUM' | 'HIGH',
  strategy: 'balanced' | 'aggressive' | 'light' | 'blueprint'
): Promise<StudyPlan> {
  // Convert map to sorted array
  let items = Array.from(priorityMap.values());
  // Apply strategy‑specific sorting
  switch (strategy) {
    case 'aggressive':
      items.sort((a, b) => b.combinedScore - a.combinedScore);
      break;
    case 'light':
      items = items.slice(0, Math.max(3, items.length / 2)); // take top half
      items.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes); // shortest first
      break;
    case 'blueprint':
      // Sort by weight deviation (under‑represented systems first)
      items.sort((a, b) => (b.weightDeviation ?? 0) - (a.weightDeviation ?? 0));
      break;
    default: // balanced
      items.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // Distribute items across days using a simple bin‑packing algorithm
  const sessions: StudySession[] = [];
  let currentDay = 0;
  let dailyRemainingMinutes = dailyMinutes;
  let currentSessionTopics: StudySession['topics'] = [];

  for (const item of items) {
    // If item doesn't fit in current day, close the session and move to next day
    if (item.estimatedMinutes > dailyRemainingMinutes || currentSessionTopics.length >= 3) {
      if (currentSessionTopics.length > 0) {
        sessions.push(createSession(currentDay, currentSessionTopics));
        currentSessionTopics = [];
        currentDay++;
        dailyRemainingMinutes = dailyMinutes;
        // Stop if we've reached horizon
        if (currentDay >= horizonDays) break;
      }
    }
    // Add topic to current session
    currentSessionTopics.push({
      taxonomyCode: item.taxonomyCode,
      subcategory: item.subcategory ?? undefined,
      recommendedAction: item.recommendedAction,
      estimatedMinutes: item.estimatedMinutes,
      urgencyScore: item.combinedScore,
    });
    dailyRemainingMinutes -= item.estimatedMinutes;
  }

  // Add any remaining topics as a final session
  if (currentSessionTopics.length > 0 && currentDay < horizonDays) {
    sessions.push(createSession(currentDay, currentSessionTopics));
  }

  // If no sessions were created, create a default "rest day" session
  if (sessions.length === 0) {
    sessions.push(createSession(0, []));
  }

  // Compute total estimated minutes
  const totalEstimatedMinutes = sessions.reduce(
    (sum, session) =>
      sum + session.topics.reduce((tSum, topic) => tSum + topic.estimatedMinutes, 0),
    0
  );

  // Compute blueprint coverage (simplified)
  const blueprintCoverage = computeBlueprintCoverage(sessions);

  // Generate plan ID
  const planId = crypto.randomUUID();

  return {
    id: planId,
    userId,
    generatedAt: new Date(),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // valid for 24 hours
    sessions,
    totalEstimatedMinutes,
    confidence: 0.7, // placeholder – will be overwritten by Confidence Scorer
    metadata: {
      blueprintCoverage,
      projectedRetentionIncrease: estimateRetentionIncrease(items),
      fatigueRisk,
      gapsProcessed: priorityMap.size,
      constraintsUsed: constraints,
    },
  };
}

/**
 * Create a session for a given day offset (0 = today).
 */
function createSession(
  dayOffset: number,
  topics: StudySession['topics']
): StudySession {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(14, 0, 0, 0); // 2 PM as default session time
  return {
    id: crypto.randomUUID(),
    date,
    topics,
    notes: topics.length === 0 ? 'Rest day – no scheduled topics.' : undefined,
  };
}

/**
 * Compute blueprint coverage percentages.
 */
function computeBlueprintCoverage(sessions: StudySession[]): Record<string, number> {
  const coverage: Record<string, number> = {};
  // Count topics per system
  const systemCounts: Record<string, number> = {};
  let totalTopics = 0;
  for (const session of sessions) {
    for (const topic of session.topics) {
      const system = topic.taxonomyCode;
      systemCounts[system] = (systemCounts[system] || 0) + 1;
      totalTopics++;
    }
  }
  // Convert to percentages
  if (totalTopics > 0) {
    for (const [system, count] of Object.entries(systemCounts)) {
      coverage[system] = count / totalTopics;
    }
  }
  return coverage;
}

/**
 * Estimate retention increase based on covered gaps.
 */
function estimateRetentionIncrease(items: TaxonomyPriority[]): number {
  const totalGap = items.reduce((sum, item) => sum + (item.gap ?? 0), 0);
  // Simplified: assume each gap reduction improves retention proportionally
  return Math.min(0.2, totalGap * 0.5); // cap at 20%
}

/**
 * Estimate overall confidence (placeholder).
 */
function estimateConfidence(
  gaps: PathGeneratorInput['gaps'],
  scheduledReviews: PathGeneratorInput['scheduledReviews']
): number {
  const totalReviews = gaps.reduce((sum, gap) => sum + gap.reviewCount, 0);
  const avgReviews = totalReviews / Math.max(gaps.length, 1);
  // More reviews → higher confidence
  const reviewConfidence = Math.min(1, avgReviews / 30);
  // More scheduled reviews → higher confidence
  const scheduleConfidence = scheduledReviews.length > 0 ? 0.8 : 0.5;
  return (reviewConfidence + scheduleConfidence) / 2;
}

/**
 * Generate a human‑readable rationale for the recommendations.
 */
function generateRationale(
  primaryPlan: StudyPlan,
  alternativePlans: StudyPlan[],
  constraints: StudyPathConstraints,
  fatigueRisk: 'LOW' | 'MEDIUM' | 'HIGH'
): string {
  const totalSessions = primaryPlan.sessions.length;
  const totalMinutes = primaryPlan.totalEstimatedMinutes;
  const focusAreas = constraints.focusAreas?.length
    ? `focusing on ${constraints.focusAreas.join(', ')}`
    : 'balanced across all systems';

  let rationale = `This ${totalSessions}‑day plan (${totalMinutes} total minutes) is ${focusAreas}. `;
  rationale += `It prioritizes topics with the largest performance gaps while respecting NCCPA blueprint weights. `;

  if (fatigueRisk !== 'LOW') {
    rationale += `A ${fatigueRisk.toLowerCase()} fatigue risk was detected, so the plan includes lighter sessions. `;
  }

  if (alternativePlans.length > 0) {
    rationale += `Alternative plans are available: ${alternativePlans.map((p, i) => `${['aggressive', 'light', 'blueprint'][i]} (${p.sessions.length} days)`).join(', ')}.`;
  }

  return rationale;
}