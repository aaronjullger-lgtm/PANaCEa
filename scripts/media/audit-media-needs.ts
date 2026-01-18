/**
 * Step 8: Media Asset Linking Audit
 *
 * Audits which high-yield conditions need images and calculates
 * current media coverage by system.
 *
 * Priority Systems:
 * - Dermatology (clinical photos) - Highest
 * - Cardiology (ECG strips) - Highest
 * - Radiology (X-ray/CT/MRI) - High
 * - HEENT (fundoscopy, otoscopy) - High
 * - Orthopedics (X-ray, special tests) - Medium
 *
 * Run: npx tsx scripts/media/audit-media-needs.ts [--csv]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import * as fs from 'fs';
import * as path from 'path';

interface MediaCoverageStats {
  system: string;
  totalConditions: number;
  conditionsWithMedia: number;
  coveragePercent: number;
  highYieldConditions: number;
  highYieldWithMedia: number;
  highYieldCoveragePercent: number;
  avgPanceYield: number;
  priority: 'Highest' | 'High' | 'Medium' | 'Low';
}

interface ConditionMediaNeed {
  id: string;
  name: string;
  system: string;
  subcategory: string;
  panceYield: number;
  hasMedia: boolean;
  mediaCount: number;
  recommendedImageTypes: string[];
  priority: number;
}

const SYSTEM_PRIORITIES: Record<
  string,
  { priority: 'Highest' | 'High' | 'Medium' | 'Low'; imageTypes: string[] }
> = {
  Dermatology: {
    priority: 'Highest',
    imageTypes: ['Clinical photos', 'Rash patterns', 'Skin lesions'],
  },
  Cardiology: { priority: 'Highest', imageTypes: ['ECG strips', 'Echo images', 'Cardiac CT'] },
  Radiology: { priority: 'High', imageTypes: ['X-ray', 'CT', 'MRI', 'Ultrasound'] },
  HEENT: { priority: 'High', imageTypes: ['Fundoscopy', 'Otoscopy', 'Pharyngoscopy'] },
  Orthopedics: { priority: 'Medium', imageTypes: ['X-ray', 'Special tests', 'Joint images'] },
  Pulmonology: { priority: 'Medium', imageTypes: ['Chest X-ray', 'CT chest', 'PFT results'] },
  Gastroenterology: { priority: 'Medium', imageTypes: ['Endoscopy', 'CT abdomen', 'Colonoscopy'] },
  Neurology: { priority: 'High', imageTypes: ['CT head', 'MRI brain', 'EEG'] },
  Urology: { priority: 'Low', imageTypes: ['Ultrasound', 'CT urography', 'Cystoscopy'] },
  Nephrology: { priority: 'Low', imageTypes: ['Ultrasound kidney', 'Lab results'] },
  Endocrinology: { priority: 'Low', imageTypes: ['Lab results', 'Imaging studies'] },
  Rheumatology: { priority: 'Medium', imageTypes: ['X-ray joints', 'Lab results'] },
  Hematology: { priority: 'Low', imageTypes: ['Blood smear', 'Lab results'] },
  'Infectious Disease': { priority: 'Medium', imageTypes: ['Clinical photos', 'Cultures'] },
};

async function auditMediaNeeds(generateCsv: boolean = false) {
  console.log('\n🔍 Media Asset Linking Audit\n');
  console.log('Analyzing media coverage across all organ systems...\n');

  try {
    // Get all conditions with their media counts
    const conditions = await prisma.medicalContent.findMany({
      select: {
        id: true,
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        pance_yield: true,
      },
      orderBy: [{ pance_yield: 'desc' }, { condition: 'asc' }],
    });

    // Get media assets grouped by conditionId
    const mediaAssets = await prisma.mediaAsset.groupBy({
      by: ['conditionId'],
      where: {
        conditionId: { not: null },
        approvalStatus: 'approved',
      },
      _count: true,
    });

    // Create a map of conditionId to media count
    const mediaMap = new Map<string, number>();
    for (const asset of mediaAssets) {
      if (asset.conditionId) {
        mediaMap.set(asset.conditionId, asset._count);
      }
    }

    // Calculate system-level stats
    const systemStats = new Map<string, MediaCoverageStats>();
    const conditionNeeds: ConditionMediaNeed[] = [];

    for (const content of conditions) {
      const system = content.system || 'Unknown';
      const mediaCount = mediaMap.get(content.conditionId) || 0;
      const hasMedia = mediaCount > 0;
      const isHighYield = (content.pance_yield ?? 0) >= 4;

      // Initialize system stats if not exists
      if (!systemStats.has(system)) {
        systemStats.set(system, {
          system,
          totalConditions: 0,
          conditionsWithMedia: 0,
          coveragePercent: 0,
          highYieldConditions: 0,
          highYieldWithMedia: 0,
          highYieldCoveragePercent: 0,
          avgPanceYield: 0,
          priority: SYSTEM_PRIORITIES[system]?.priority || 'Low',
        });
      }

      const stats = systemStats.get(system)!;
      stats.totalConditions++;
      if (hasMedia) stats.conditionsWithMedia++;
      if (isHighYield) {
        stats.highYieldConditions++;
        if (hasMedia) stats.highYieldWithMedia++;
      }

      // Calculate priority score (panceYield * systemPriorityWeight)
      const priorityWeight = {
        Highest: 4,
        High: 3,
        Medium: 2,
        Low: 1,
      }[SYSTEM_PRIORITIES[system]?.priority || 'Low'];

      const priorityScore = (content.pance_yield ?? 0) * priorityWeight;

      // Add to needs list if no media
      if (!hasMedia && (content.pance_yield ?? 0) > 0) {
        conditionNeeds.push({
          id: content.id,
          name: content.condition,
          system,
          subcategory: content.subcategory || 'N/A',
          panceYield: content.pance_yield ?? 0,
          hasMedia,
          mediaCount,
          recommendedImageTypes: SYSTEM_PRIORITIES[system]?.imageTypes || [],
          priority: priorityScore,
        });
      }
    }

    // Calculate percentages
    systemStats.forEach((stats) => {
      stats.coveragePercent =
        stats.totalConditions > 0 ? (stats.conditionsWithMedia / stats.totalConditions) * 100 : 0;
      stats.highYieldCoveragePercent =
        stats.highYieldConditions > 0
          ? (stats.highYieldWithMedia / stats.highYieldConditions) * 100
          : 0;
    });

    // Sort by priority
    const sortedStats = Array.from(systemStats.values()).sort((a, b) => {
      const priorityOrder = { Highest: 0, High: 1, Medium: 2, Low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Calculate overall stats
    const totalConditions = conditions.length;
    const totalWithMedia = conditions.filter((c) => mediaMap.has(c.conditionId)).length;
    const overallCoverage = (totalWithMedia / totalConditions) * 100;

    // Display results
    console.log('='.repeat(80));
    console.log('📊 OVERALL MEDIA COVERAGE');
    console.log('='.repeat(80));
    console.log(`Total Conditions:           ${totalConditions}`);
    console.log(`Conditions with Media:      ${totalWithMedia}`);
    console.log(`Overall Coverage:           ${overallCoverage.toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');

    console.log('='.repeat(80));
    console.log('📋 SYSTEM-LEVEL MEDIA COVERAGE');
    console.log('='.repeat(80));
    console.log(
      'System                    Priority  Total  W/Media  Coverage  HY    HY+Media  HY%'
    );
    console.log('-'.repeat(80));

    for (const stats of sortedStats) {
      const priorityEmoji = {
        Highest: '🔴',
        High: '🟠',
        Medium: '🟡',
        Low: '⚪',
      }[stats.priority];

      console.log(
        `${stats.system.padEnd(25)} ${priorityEmoji} ${stats.priority.padEnd(7)} ` +
          `${stats.totalConditions.toString().padStart(5)}  ` +
          `${stats.conditionsWithMedia.toString().padStart(7)}  ` +
          `${stats.coveragePercent.toFixed(1).padStart(7)}%  ` +
          `${stats.highYieldConditions.toString().padStart(4)}  ` +
          `${stats.highYieldWithMedia.toString().padStart(8)}  ` +
          `${stats.highYieldCoveragePercent.toFixed(1).padStart(5)}%`
      );
    }
    console.log('='.repeat(80) + '\n');

    // Top 50 conditions needing media
    const topNeeds = conditionNeeds.sort((a, b) => b.priority - a.priority).slice(0, 50);

    console.log('='.repeat(80));
    console.log('🎯 TOP 50 CONDITIONS NEEDING MEDIA (by priority score)');
    console.log('='.repeat(80));
    console.log(
      'Rank  Condition                           System          Yield  Priority  Image Types'
    );
    console.log('-'.repeat(80));

    topNeeds.forEach((need, index) => {
      const imageTypes = need.recommendedImageTypes.slice(0, 2).join(', ');
      console.log(
        `${(index + 1).toString().padStart(4)}  ` +
          `${need.name.substring(0, 35).padEnd(35)} ` +
          `${need.system.substring(0, 14).padEnd(14)}  ` +
          `${need.panceYield.toString().padStart(4)}  ` +
          `${need.priority.toString().padStart(8)}  ` +
          `${imageTypes}`
      );
    });
    console.log('='.repeat(80) + '\n');

    // Generate CSV if requested
    if (generateCsv) {
      const timestamp = new Date().toISOString().split('T')[0];
      const csvPath = path.join(process.cwd(), `media-audit-${timestamp}.csv`);

      const csvLines = [
        'Rank,Condition,System,Subcategory,PANCE Yield,Priority Score,Has Media,Recommended Image Types',
      ];

      conditionNeeds
        .sort((a, b) => b.priority - a.priority)
        .forEach((need, index) => {
          csvLines.push(
            `${index + 1},"${need.name}","${need.system}","${need.subcategory}",` +
              `${need.panceYield},${need.priority},${need.hasMedia},"${need.recommendedImageTypes.join('; ')}"`
          );
        });

      fs.writeFileSync(csvPath, csvLines.join('\n'));
      console.log(`✅ CSV report saved to: ${csvPath}\n`);
    }

    console.log('💡 RECOMMENDATIONS:');
    console.log('   1. Focus on Dermatology and Cardiology (Highest priority)');
    console.log('   2. Target conditions with PANCE yield ≥4 first');
    console.log('   3. Use existing admin media upload workflow');
    console.log('   4. Tag images with usageType: "quiz" (clean) or "reference" (annotated)\n');

    return {
      overallCoverage,
      systemStats: sortedStats,
      topNeeds: topNeeds.slice(0, 20),
    };
  } catch (error) {
    console.error('❌ Error during media audit:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const generateCsv = args.includes('--csv');

  try {
    await auditMediaNeeds(generateCsv);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main();
