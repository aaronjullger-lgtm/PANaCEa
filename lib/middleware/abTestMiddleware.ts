/**
 * A/B Test Middleware
 *
 * Resolves active experiments for a user, assigns variants deterministically,
 * and logs exposures. Returns a typed map of experimentId → variant info.
 *
 * Edge runtime compatible — no process.env usage.
 */

import {
  assignVariant,
  ensureExposure,
  type ABPrismaClient,
  type ABVariant,
} from '../services/abTestService';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

/** Resolved variant assignment for a single experiment */
export interface ABVariantAssignment {
  variantName: string;
  config: Record<string, unknown>;
}

/** Map of experimentId → resolved assignment */
export type ABAssignmentMap = Record<string, ABVariantAssignment>;

/** A single active experiment row from the database */
interface RawExperiment {
  id: string;
  name: string;
  status: string;
  variants: unknown; // JSON — parsed to ABVariant[]
  trafficPercentage: number;
  targetLearnerStages: unknown; // JSON — parsed to string[]
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Parse the JSON `variants` column into a typed array.
 * Schema: `[{ name: string, weight: number, config?: object }]`
 */
function parseVariants(raw: unknown): ABVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is ABVariant =>
      typeof v === 'object' && v !== null &&
      typeof v.name === 'string' && typeof v.weight === 'number'
  );
}

/**
 * Parse the JSON `targetLearnerStages` column into a string array.
 */
function parseTargetStages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string');
}

/**
 * Resolve all active experiments for a user.
 *
 * 1. Fetches ACTIVE experiments from DB
 * 2. Filters by traffic % and learner stage (optional)
 * 3. Deterministically assigns each variant via FNV-1a hash
 * 4. Logs first exposure (idempotent)
 *
 * @param db         - Prisma client (or Edge proxy)
 * @param userId     - Internal user ID
 * @param experimentIds - If provided, only resolve these experiments. If omitted, resolves all ACTIVE.
 * @param userStage  - Optional learner stage for stage-targeted experiments
 */
export async function resolveAssignments(
  db: ABPrismaClient,
  userId: string,
  experimentIds?: string[],
  userStage?: string
): Promise<ABAssignmentMap> {
  const assignments: ABAssignmentMap = {};

  const whereClause: any = { status: 'ACTIVE' };
  if (experimentIds && experimentIds.length > 0) {
    whereClause.id = { in: experimentIds };
  }

  let experiments: RawExperiment[];
  try {
    experiments = await db.aBExperiment.findMany({ where: whereClause });
  } catch (err) {
    logger.warn('AB: failed to fetch experiments', { error: String(err) });
    return assignments;
  }

  for (const exp of experiments) {
    const variants = parseVariants(exp.variants);
    if (variants.length === 0) continue;

    const targetStages = parseTargetStages(exp.targetLearnerStages);

    // Learner stage filter: skip if user doesn't match (empty = all stages)
    if (targetStages.length > 0 && userStage) {
      const stageMatch = targetStages
        .map((s) => s.toUpperCase())
        .includes(userStage.toUpperCase());
      if (!stageMatch) continue;
    }

    const variantName = assignVariant(
      userId,
      exp.id,
      variants,
      exp.trafficPercentage
    );
    if (!variantName) continue; // User is outside the traffic bucket

    // Find the variant config
    const matchedVariant = variants.find((v) => v.name === variantName);
    const config = (matchedVariant?.config as Record<string, unknown>) ?? {};

    assignments[exp.id] = { variantName, config };

    // Log exposure (idempotent — deduped by unique constraint)
    try {
      await ensureExposure(db, userId, exp.id, variantName);
    } catch (err) {
      logger.warn('AB: failed to log exposure', {
        experimentId: exp.id,
        variantName,
        error: String(err),
      });
    }
  }

  return assignments;
}

/**
 * Log a conversion event for an experiment variant.
 * Non-fatal — logs a warning on failure but never throws.
 */
export async function logABConversion(
  db: ABPrismaClient,
  userId: string,
  experimentId: string,
  variantName: string,
  eventName: string,
  value?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.aBConversion.create({
      data: { userId, experimentId, variantName, eventName, value, metadata },
    });
  } catch (err) {
    logger.warn('AB: failed to log conversion', {
      experimentId,
      variantName,
      eventName,
      error: String(err),
    });
  }
}
