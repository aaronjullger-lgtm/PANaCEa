/**
 * Content Audit API - Admin-only endpoint to find incomplete MedicalContent entries
 *
 * GET /api/admin/content-audit
 * Returns statistics on content completeness and lists incomplete conditions
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Required fields that MUST have content (not empty/null)
const REQUIRED_FIELDS = ['overview', 'symptoms', 'treatment', 'diagnostics'] as const;

// High-yield fields that should have content or explicit N/A
const HIGH_YIELD_FIELDS = [
  'gold_standard_dx',
  'first_line_rx',
  'buzzwords',
  'classic_patient',
  'clinical_pearls',
  'best_initial_test',
  'classic_triad',
  'pathophysiology',
  'etiology',
  'epidemiology',
  'physicalExam',
  'riskFactors',
  'complications',
  'prognosis',
  'differentialDiagnosis',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];
type HighYieldField = (typeof HIGH_YIELD_FIELDS)[number];

interface FieldStats {
  total: number;
  filled: number;
  missing: number;
  explicitNA: number;
  percentComplete: number;
}

interface AuditResult {
  timestamp: string;
  totalConditions: number;
  fullyComplete: number;
  partiallyComplete: number;
  criticalMissing: number;
  byField: Record<string, FieldStats>;
  incompleteConditions: Array<{
    id: string;
    conditionId: string;
    condition: string;
    system: string;
    subcategory: string;
    pance_yield: number | null;
    missingRequired: string[];
    missingHighYield: string[];
    completenessScore: number;
  }>;
  topPriorityToFix: Array<{
    conditionId: string;
    condition: string;
    system: string;
    pance_yield: number | null;
    missingCount: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
}

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;
    // Check for placeholder content
    if (trimmed.includes('to be generated') || trimmed.includes('content needed')) return false;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function isExplicitNA(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const lower = value.toLowerCase().trim();
  return lower.startsWith('n/a') || lower === 'not applicable' || lower === 'na';
}

function calculateCompleteness(content: Record<string, unknown>): {
  score: number;
  missingRequired: string[];
  missingHighYield: string[];
} {
  const missingRequired: string[] = [];
  const missingHighYield: string[] = [];

  let filledRequired = 0;
  let filledHighYield = 0;

  for (const field of REQUIRED_FIELDS) {
    const value = content[field];
    if (isFieldFilled(value) || isExplicitNA(value)) {
      filledRequired++;
    } else {
      missingRequired.push(field);
    }
  }

  for (const field of HIGH_YIELD_FIELDS) {
    const value = content[field];
    if (isFieldFilled(value) || isExplicitNA(value)) {
      filledHighYield++;
    } else {
      missingHighYield.push(field);
    }
  }

  // Score: 60% weight on required fields, 40% on high-yield
  const requiredScore = (filledRequired / REQUIRED_FIELDS.length) * 60;
  const highYieldScore = (filledHighYield / HIGH_YIELD_FIELDS.length) * 40;

  return {
    score: Math.round(requiredScore + highYieldScore),
    missingRequired,
    missingHighYield,
  };
}

function getPriority(
  panceYield: number | null,
  missingRequiredCount: number,
  missingHighYieldCount: number
): 'critical' | 'high' | 'medium' | 'low' {
  const yieldScore = panceYield ?? 1;
  const totalMissing = missingRequiredCount * 2 + missingHighYieldCount;

  // Critical: High-yield conditions missing required fields
  if (yieldScore >= 4 && missingRequiredCount > 0) return 'critical';

  // High: Either high-yield with many missing OR any condition missing required
  if (yieldScore >= 3 && totalMissing > 5) return 'high';
  if (missingRequiredCount >= 2) return 'high';

  // Medium: Missing several high-yield fields
  if (totalMissing > 8) return 'medium';

  return 'low';
}

const ContentAuditSchema = z.object({
  query: z
    .object({
      system: z.string().optional(),
      limit: z.string().optional(),
      includeComplete: z.string().optional(),
    })
    .optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ContentAuditSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/content-audit');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check admin role from database
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    if (
      !user ||
      (user.role !== 'ADMIN' &&
        user.role !== 'SUPERADMIN' &&
        user.role !== 'admin' &&
        user.role !== 'superadmin')
    ) {
      logger.warn('Non-admin attempted content audit', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    // Parse query params
    const systemFilter = validated.query?.system;
    const limit = parseInt(validated.query?.limit || '100');
    const includeComplete = validated.query?.includeComplete === 'true';

    // Fetch all MedicalContent
    const whereClause: Record<string, unknown> = {};
    if (systemFilter) {
      whereClause.system = systemFilter;
    }

    const allContent = await prisma.medicalContent.findMany({
      where: whereClause,
      select: {
        id: true,
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        pance_yield: true,
        overview: true,
        symptoms: true,
        treatment: true,
        diagnostics: true,
        gold_standard_dx: true,
        first_line_rx: true,
        buzzwords: true,
        classic_patient: true,
        clinical_pearls: true,
        best_initial_test: true,
        classic_triad: true,
        pathophysiology: true,
        etiology: true,
        epidemiology: true,
        physicalExam: true,
        riskFactors: true,
        complications: true,
        prognosis: true,
        differentialDiagnosis: true,
        content: true, // JSONB for display_priority
      },
    });

    // Initialize field stats
    const fieldStats: Record<string, FieldStats> = {};
    const allFields = [...REQUIRED_FIELDS, ...HIGH_YIELD_FIELDS];
    for (const field of allFields) {
      fieldStats[field] = {
        total: allContent.length,
        filled: 0,
        missing: 0,
        explicitNA: 0,
        percentComplete: 0,
      };
    }

    // Analyze each condition
    const incompleteConditions: AuditResult['incompleteConditions'] = [];
    let fullyComplete = 0;
    let partiallyComplete = 0;
    let criticalMissing = 0;

    for (const content of allContent) {
      // Calculate completeness
      const { score, missingRequired, missingHighYield } = calculateCompleteness(
        content as Record<string, unknown>
      );

      // Update field stats
      for (const field of allFields) {
        const value = (content as Record<string, unknown>)[field];
        const stats = fieldStats[field];
        if (!stats) continue; // TypeScript guard - stats always exists since we initialized all fields
        if (isFieldFilled(value)) {
          stats.filled++;
        } else if (isExplicitNA(value)) {
          stats.explicitNA++;
        } else {
          stats.missing++;
        }
      }

      // Categorize
      if (score === 100) {
        fullyComplete++;
        if (includeComplete) {
          incompleteConditions.push({
            id: content.id,
            conditionId: content.conditionId,
            condition: content.condition,
            system: content.system,
            subcategory: content.subcategory,
            pance_yield: content.pance_yield,
            missingRequired: [],
            missingHighYield: [],
            completenessScore: score,
          });
        }
      } else {
        if (missingRequired.length > 0) {
          criticalMissing++;
        } else {
          partiallyComplete++;
        }

        incompleteConditions.push({
          id: content.id,
          conditionId: content.conditionId,
          condition: content.condition,
          system: content.system,
          subcategory: content.subcategory,
          pance_yield: content.pance_yield,
          missingRequired,
          missingHighYield,
          completenessScore: score,
        });
      }
    }

    // Calculate percentages for field stats
    for (const field of allFields) {
      const stats = fieldStats[field];
      if (!stats) continue; // TypeScript guard - stats always exists since we initialized all fields
      stats.percentComplete = Math.round(((stats.filled + stats.explicitNA) / stats.total) * 100);
    }

    // Sort incomplete by priority (high-yield + most missing first)
    incompleteConditions.sort((a, b) => {
      // First by PANCE yield (higher first)
      const yieldDiff = (b.pance_yield ?? 0) - (a.pance_yield ?? 0);
      if (yieldDiff !== 0) return yieldDiff;

      // Then by completeness (lower score = more incomplete = higher priority)
      return a.completenessScore - b.completenessScore;
    });

    // Create top priority list
    const topPriorityToFix = incompleteConditions
      .filter((c) => c.completenessScore < 100)
      .slice(0, 50)
      .map((c) => ({
        conditionId: c.conditionId,
        condition: c.condition,
        system: c.system,
        pance_yield: c.pance_yield,
        missingCount: c.missingRequired.length + c.missingHighYield.length,
        priority: getPriority(c.pance_yield, c.missingRequired.length, c.missingHighYield.length),
      }));

    const result: AuditResult = {
      timestamp: new Date().toISOString(),
      totalConditions: allContent.length,
      fullyComplete,
      partiallyComplete,
      criticalMissing,
      byField: fieldStats,
      incompleteConditions: incompleteConditions.slice(0, limit),
      topPriorityToFix,
    };

    logger.info('Content audit completed', {
      userId: user.id,
      totalConditions: allContent.length,
      fullyComplete,
      criticalMissing,
    });

    return {
      data: result,
    };
  } catch (error) {
    logger.error('Content audit error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to audit content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
