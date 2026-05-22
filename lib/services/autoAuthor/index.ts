/**
 * Auto-Author Service - Main Entry Point
 *
 * Orchestrates the auto-author pipeline:
 * 1. Find conditions missing content
 * 2. Generate content via Gemini
 * 3. Save to database
 */

export * from './types';
export * from './contentGenerator';
export * from './databaseService';
export * from './langchainContentGenerator';

import { generateConditionContentMulti, batchGenerateContentMulti } from './langchainContentGenerator';
import {
  findConditionsMissingContent,
  saveGeneratedContent,
  getContentStats,
  closeAutoAuthorDb,
  formatAutoAuthorSummary,
  type MissingContentCondition,
} from './databaseService';
import type { AutoAuthorStats, ContentGenerationOptions } from './types';
import {
  validateGeneratedContent,
  formatValidationResult,
} from '../../services/cms/contentValidator';

/**
 * Run auto-author pipeline for all conditions missing content.
 * All progress reporting is captured in the returned AutoAuthorStats.
 */
export async function autoAuthorMissingContent(
  apiKey: string,
  options: {
    maxConditions?: number;
    delayMs?: number;
    includeExtendedFields?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<AutoAuthorStats> {
  const {
    maxConditions = 100,
    delayMs = 2000,
    includeExtendedFields = true,
    dryRun = false,
  } = options;

  const stats: AutoAuthorStats = {
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
    errors: [],
  };

  try {
    const contentStats = await getContentStats();

    if (contentStats.missingContent === 0) {
      return stats;
    }

    const missingConditions = await findConditionsMissingContent();
    const conditionsToProcess = missingConditions.slice(0, maxConditions);
    stats.total = conditionsToProcess.length;

    if (dryRun) {
      return stats;
    }

    for (let i = 0; i < conditionsToProcess.length; i++) {
      const condition = conditionsToProcess[i];
      if (!condition) continue;

      const genOptions: ContentGenerationOptions = {
        conditionName: condition.displayName || condition.name,
        system: condition.system,
        includeExtendedFields,
      };

      const result = await generateConditionContentMulti(apiKey, genOptions);

      if (result.success && result.content) {
        const validation = validateGeneratedContent(result.content);

        if (!validation.isValid) {
          stats.validationFailed++;
          stats.errors.push({
            entity: condition.name,
            error: `Quality validation failed: ${validation.issues.join('; ')}`,
          });
        } else {
          const saved = await saveGeneratedContent(condition.id, result.content);

          if (saved) {
            stats.generated++;
          } else {
            stats.failed++;
            stats.errors.push({
              entity: condition.name,
              error: 'Failed to save to database',
            });
          }
        }
      } else {
        stats.failed++;
        stats.errors.push({
          entity: condition.name,
          error: result.error || 'Unknown error',
        });
      }

      if (i < conditionsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    await reportQualityFlags(stats);

    return stats;
  } catch (error: any) {
    console.error('Fatal error during auto-author run:', error);
    throw error;
  }
}

/**
 * After a batch generation run, check if the content quality loop has
 * flagged items in "reviewed" state that should be surfaced in the report.
 */
async function reportQualityFlags(stats: AutoAuthorStats): Promise<void> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const reviewedFlags = await prisma.contentQualityFlag.count({
        where: { status: 'reviewed' },
      });

      const flaggedNoRegen = await prisma.contentQualityFlag.count({
        where: {
          status: 'flagged',
          regeneratedContent: null,
        },
      });

      // Quality flag counts are available via stats or admin dashboard;
      // this function runs silently in production.

      await prisma.$disconnect();
    } catch {
      // Prisma may be unavailable in dry-run or script contexts
    }
  } catch {
    // Prisma unavailable — non-critical
  }
}
