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

import { generateConditionContent, batchGenerateContent } from './contentGenerator';
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
 * Run auto-author pipeline for all conditions missing content
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

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Auto-Author: AI Content Generation Pipeline       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: AutoAuthorStats = {
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
    errors: [],
  };

  try {
    // 1. Get current stats
    console.log('📊 Analyzing database...\n');
    const contentStats = await getContentStats();
    console.log(`   Total Conditions: ${contentStats.total}`);
    console.log(`   ✅ With Content: ${contentStats.withContent}`);
    console.log(`   ❌ Missing Content: ${contentStats.missingContent}\n`);

    if (contentStats.missingContent === 0) {
      console.log('✅ All conditions already have content! Nothing to do.\n');
      return stats;
    }

    // 2. Find conditions missing content
    console.log('🔍 Finding conditions missing content...\n');
    const missingConditions = await findConditionsMissingContent();

    // Limit to maxConditions
    const conditionsToProcess = missingConditions.slice(0, maxConditions);
    stats.total = conditionsToProcess.length;

    console.log(`   Found ${missingConditions.length} conditions missing content`);
    console.log(
      `   Will process ${conditionsToProcess.length} conditions (max: ${maxConditions})\n`
    );

    if (dryRun) {
      console.log('🔎 DRY RUN MODE - Listing conditions that would be processed:\n');
      conditionsToProcess.forEach((cond, idx) => {
        console.log(`   ${idx + 1}. ${cond.name} (${cond.system})`);
      });
      console.log('\n✅ Dry run complete. No changes made.\n');
      return stats;
    }

    // 3. Generate content for each condition
    console.log('🤖 Generating content with Gemini AI...\n');
    console.log('━'.repeat(60));

    for (let i = 0; i < conditionsToProcess.length; i++) {
      const condition = conditionsToProcess[i];
      const progress = `[${i + 1}/${conditionsToProcess.length}]`;

      console.log(`\n${progress} ${condition.name} (${condition.system})`);

      // Build options for content generation
      const genOptions: ContentGenerationOptions = {
        conditionName: condition.displayName || condition.name,
        system: condition.system,
        includeExtendedFields,
      };

      // Generate content
      const result = await generateConditionContent(apiKey, genOptions);

      if (result.success && result.content) {
        // Validate content quality before saving
        const validation = validateGeneratedContent(result.content);

        if (!validation.isValid) {
          // Content failed quality gate
          stats.validationFailed++;
          stats.errors.push({
            entity: condition.name,
            error: `Quality validation failed: ${validation.issues.join('; ')}`,
          });
          console.log(`   ❌ Content failed quality validation`);
          validation.issues.forEach((issue) => {
            console.log(`      - ${issue}`);
          });
        } else {
          // Content passed validation - save to database
          if (validation.warnings && validation.warnings.length > 0) {
            console.log(`   ⚠️  Content has ${validation.warnings.length} warning(s)`);
          }

          const saved = await saveGeneratedContent(condition.id, result.content);

          if (saved) {
            stats.generated++;
            console.log(`   ✅ Generated and saved successfully`);
          } else {
            stats.failed++;
            stats.errors.push({
              entity: condition.name,
              error: 'Failed to save to database',
            });
            console.log(`   ❌ Generated but failed to save`);
          }
        }
      } else {
        stats.failed++;
        stats.errors.push({
          entity: condition.name,
          error: result.error || 'Unknown error',
        });
        console.log(`   ❌ Generation failed: ${result.error}`);
      }

      // Rate limiting (except for last item)
      if (i < conditionsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log('\n' + '━'.repeat(60));

    // 4. Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Auto-Author Summary                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Conditions Processed: ${stats.total}`);
    console.log(`✅ Successfully Generated: ${stats.generated}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`🚫 Quality Validation Failed: ${stats.validationFailed}`);
    console.log(`❌ Generation Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.entity}: ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    // Get updated stats
    const finalStats = await getContentStats();
    const percentComplete = ((finalStats.withContent / finalStats.total) * 100).toFixed(1);

    console.log(`\n📈 Database Status:`);
    console.log(
      `   ${finalStats.withContent}/${finalStats.total} conditions have content (${percentComplete}%)`
    );
    console.log(`   ${finalStats.missingContent} conditions still need content\n`);

    if (finalStats.missingContent > 0) {
      console.log('💡 Next Steps:');
      console.log(
        `   Run this script again to process the remaining ${finalStats.missingContent} conditions`
      );
      console.log(`   Or increase --max-conditions to process more at once\n`);
    } else {
      console.log('🎉 All conditions now have content!\n');
    }

    console.log('━'.repeat(60) + '\n');

    return stats;
  } catch (error: any) {
    console.error('\n❌ Fatal error during auto-author run:', error);
    throw error;
  }
}
