/**
 * A/B Testing Service
 *
 * Manages experiment lifecycle, deterministic user assignment, exposure tracking,
 * conversion logging, and statistical analysis (Welch's t-test).
 *
 * Edge runtime compatible — no process.env usage.
 */

import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface ABVariant {
  name: string;
  weight: number;
  config?: Record<string, unknown>;
}

export interface ABExperimentConfig {
  id?: string;
  name: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  variants: ABVariant[];
  trafficPercentage?: number;
  targetLearnerStages?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface ABExperimentRecord extends ABExperimentConfig {
  id: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  trafficPercentage: number;
  targetLearnerStages: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ABExposureRecord {
  id: string;
  userId: string;
  experimentId: string;
  variantName: string;
  createdAt: Date;
}

export interface ABConversionRecord {
  id: string;
  userId: string;
  experimentId: string;
  variantName: string;
  eventName: string;
  value?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface VariantMetrics {
  variantName: string;
  n: number;
  mean: number;
  std: number;
  sum: number;
}

export interface ABAnalysisResult {
  experimentId: string;
  eventName: string;
  variants: VariantMetrics[];
  /** Difference in means: control (first variant) vs treatment */
  meanDifference: number | null;
  /** Welch's t-statistic */
  tStatistic: number | null;
  /** Degrees of freedom (Welch–Satterthwaite) */
  degreesOfFreedom: number | null;
  /** Two-tailed p-value */
  pValue: number | null;
  /** Significant at α = 0.05? */
  isSignificant: boolean;
}

// ============================================================================
// Deterministic Assignment
// ============================================================================

/**
 * Simple deterministic hash for (userId + experimentId).
 * Uses FNV-1a — fast, uniform, no dependencies.
 * Returns a float in [0, 1).
 */
export function hashUserToBucket(userId: string, experimentId: string): number {
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0x01000193; // FNV prime
  const combined = `${experimentId}:${userId}`;

  for (let i = 0; i < combined.length; i++) {
    h1 ^= combined.charCodeAt(i);
    h1 = Math.imul(h1, h2);
    h2 ^= combined.charCodeAt(i);
    h2 = Math.imul(h2, 0x811c9dc5);
  }

  // Combine the two hashes and normalize to [0, 1)
  const combinedHash = ((h1 >>> 0) ^ (h2 >>> 0)) >>> 0;
  return combinedHash / 0x100000000;
}

/**
 * Deterministically assign a user to a variant based on weighted distribution.
 * Returns the variant name. Guaranteed stable: same (userId, experimentId)
 * always returns the same variant as long as the variant list and weights don't change.
 */
export function assignVariant(
  userId: string,
  experimentId: string,
  variants: ABVariant[],
  trafficPercentage: number = 100
): string | null {
  if (!variants.length) return null;

  // Traffic gate: users outside the traffic bucket are not assigned
  const bucket = hashUserToBucket(userId, experimentId);
  if (bucket >= trafficPercentage / 100) {
    return null;
  }

  // Normalize weights (handles floating-point drift)
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) return null;

  // Find which variant this bucket falls into
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight / totalWeight;
    if (bucket < cumulative) {
      return variant.name;
    }
  }

  // Fallback: return last variant (handles floating-point edge case)
  return variants[variants.length - 1]!.name;
}

// ============================================================================
// Statistical Analysis
// ============================================================================

/**
 * Welch's t-test (two-sample, unequal variance).
 * Returns t-statistic and degrees of freedom (Welch–Satterthwaite approximation).
 */
function welchTTest(a: number[], b: number[]): { t: number; df: number } {
  const n1 = a.length;
  const n2 = b.length;

  if (n1 < 2 || n2 < 2) {
    return { t: 0, df: 0 };
  }

  const mean1 = a.reduce((s, x) => s + x, 0) / n1;
  const mean2 = b.reduce((s, x) => s + x, 0) / n2;

  const var1 = a.reduce((s, x) => s + (x - mean1) ** 2, 0) / (n1 - 1);
  const var2 = b.reduce((s, x) => s + (x - mean2) ** 2, 0) / (n2 - 1);

  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return { t: 0, df: 0 };

  const t = (mean1 - mean2) / se;

  // Welch–Satterthwaite degrees of freedom
  const numerator = (var1 / n1 + var2 / n2) ** 2;
  const denominator =
    (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1);

  const df = denominator === 0 ? 0 : numerator / denominator;

  return { t, df };
}

/**
 * Approximate two-tailed p-value using the normal distribution (z → p).
 * For large df (>30) this is a good approximation of the t-distribution p-value.
 * Uses the error function approximation (Abramowitz and Stegun).
 */
function twoTailedPValue(t: number, df: number): number {
  if (df === 0) return 1;

  // For large df, use normal approximation
  const z = t; // approximately normal for df > 30

  // Approximate the cumulative normal distribution
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);

  const t2 = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t2 + a4) * t2 + a3) * t2 + a2) * t2 + a1) * t2 * Math.exp(-x * x);

  const cdf = 0.5 * (1.0 + sign * y);

  // Two-tailed p-value
  return Math.min(1, 2 * Math.min(cdf, 1 - cdf));
}

/**
 * Compute per-variant metrics and statistical significance.
 */
export function analyzeExperiment(
  experimentId: string,
  eventName: string,
  conversions: ABConversionRecord[]
): ABAnalysisResult {
  // Group by variant
  const variantValues = new Map<string, number[]>();
  for (const c of conversions) {
    if (c.experimentId !== experimentId || c.eventName !== eventName) continue;
    const val = c.value ?? 1; // Default to 1 (count-based) if no value
    const existing = variantValues.get(c.variantName) ?? [];
    existing.push(val);
    variantValues.set(c.variantName, existing);
  }

  const variantNames = [...variantValues.keys()].sort();
  const variants: VariantMetrics[] = variantNames.map((name) => {
    const values = variantValues.get(name)!;
    const n = values.length;
    const sum = values.reduce((s, x) => s + x, 0);
    const mean = n > 0 ? sum / n : 0;
    const std =
      n > 1
        ? Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
        : 0;

    return { variantName: name, n, mean, std, sum };
  });

  if (variants.length < 2) {
    return {
      experimentId,
      eventName,
      variants,
      meanDifference: null,
      tStatistic: null,
      degreesOfFreedom: null,
      pValue: null,
      isSignificant: false,
    };
  }

  // Compare first two variants (control vs treatment)
  const control = variantValues.get(variantNames[0]!) ?? [];
  const treatment = variantValues.get(variantNames[1]!) ?? [];

  if (control.length < 2 || treatment.length < 2) {
    return {
      experimentId,
      eventName,
      variants,
      meanDifference: variants[1]!.mean - variants[0]!.mean,
      tStatistic: null,
      degreesOfFreedom: null,
      pValue: null,
      isSignificant: false,
    };
  }

  const { t, df } = welchTTest(control, treatment);
  const pValue = twoTailedPValue(t, df);

  return {
    experimentId,
    eventName,
    variants,
    meanDifference: variants[1]!.mean - variants[0]!.mean,
    tStatistic: t,
    degreesOfFreedom: df,
    pValue,
    isSignificant: pValue < 0.05,
  };
}

// ============================================================================
// Prisma Integration Helpers
// ============================================================================

/** Type for a Prisma client (or the Edge proxy) used by the service. */
export interface ABPrismaClient {
  aBExperiment: {
    findMany: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
  };
  aBExposure: {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
  };
  aBConversion: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    groupBy: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
  };
}

/**
 * Get or create an exposure record for a user in an experiment.
 * Idempotent — if the user was already exposed, returns the existing record.
 */
export async function ensureExposure(
  db: ABPrismaClient,
  userId: string,
  experimentId: string,
  variantName: string
): Promise<ABExposureRecord> {
  // Check for existing exposure (deduped)
  const existing = await db.aBExposure.findUnique({
    where: {
      userId_experimentId: { userId, experimentId },
    },
  });

  if (existing) {
    return existing as ABExposureRecord;
  }

  // Create new exposure
  const exposure = await db.aBExposure.create({
    data: { userId, experimentId, variantName },
  });

  logger.info('A/B exposure recorded', { userId, experimentId, variantName });

  return exposure as ABExposureRecord;
}

/**
 * Log a conversion event for a user in an experiment.
 */
export async function logConversion(
  db: ABPrismaClient,
  userId: string,
  experimentId: string,
  variantName: string,
  eventName: string,
  value?: number,
  metadata?: Record<string, unknown>
): Promise<ABConversionRecord> {
  const conversion = await db.aBConversion.create({
    data: {
      userId,
      experimentId,
      variantName,
      eventName,
      value,
      metadata,
    },
  });

  logger.debug('A/B conversion logged', {
    userId,
    experimentId,
    variantName,
    eventName,
    value,
  });

  return conversion as ABConversionRecord;
}

/**
 * Check if a user should be included in an experiment based on traffic percentage.
 */
export function isUserInTraffic(
  userId: string,
  experimentId: string,
  trafficPercentage: number
): boolean {
  const bucket = hashUserToBucket(userId, experimentId);
  return bucket < trafficPercentage / 100;
}

/**
 * Check if a user matches the experiment's learner stage targeting.
 * Empty targetLearnerStages = include everyone.
 */
export function matchesLearnerStageTarget(
  userStage: string | undefined,
  targetStages: string[]
): boolean {
  if (!targetStages.length) return true;
  if (!userStage) return false;
  return targetStages.map((s) => s.toUpperCase()).includes(userStage.toUpperCase());
}
