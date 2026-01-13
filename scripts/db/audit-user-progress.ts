/**
 * Step 9: UserProgress & FSRS Consistency Audit
 * 
 * Audits UserProgress table for:
 * 1. Orphaned records (conditionId not in MedicalContent)
 * 2. Missing progress (QuestionAttempts without UserProgress)
 * 3. Stale records (no review in 90+ days with low stability)
 * 
 * Run: npx tsx scripts/db/audit-user-progress.ts [--csv] [--fix-orphaned]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import * as fs from 'fs';
import * as path from 'path';

interface AuditResults {
  orphanedProgress: Array<{
    id: string;
    userId: string;
    conditionId: string;
    lastReviewAt: Date | null;
  }>;
  missingProgress: Array<{
    userId: string;
    conditionId: string;
    attemptCount: number;
  }>;
  staleProgress: Array<{
    id: string;
    userId: string;
    conditionId: string;
    condition: string | null;
    lastReviewAt: Date | null;
    daysSinceReview: number;
    stability: number | null;
  }>;
  summary: {
    totalUserProgress: number;
    orphanedCount: number;
    missingProgressCount: number;
    staleCount: number;
    healthyCount: number;
  };
}

async function auditUserProgress(generateCsv: boolean = false, fixOrphaned: boolean = false): Promise<AuditResults> {
  console.log('\n🔍 UserProgress & FSRS Consistency Audit\n');
  
  const results: AuditResults = {
    orphanedProgress: [],
    missingProgress: [],
    staleProgress: [],
    summary: {
      totalUserProgress: 0,
      orphanedCount: 0,
      missingProgressCount: 0,
      staleCount: 0,
      healthyCount: 0
    }
  };

  try {
    // 1. Check for orphaned UserProgress (condition doesn't exist)
    console.log('1️⃣  Checking for orphaned UserProgress records...');
    
    const orphanedProgress = await prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      conditionId: string;
      lastReviewAt: Date | null;
    }>>`
      SELECT up.id, up."userId", up."conditionId", up."lastReviewAt"
      FROM "UserProgress" up
      LEFT JOIN "MedicalContent" mc ON up."conditionId" = mc."conditionId"
      WHERE mc."conditionId" IS NULL
      LIMIT 100
    `;

    results.orphanedProgress = orphanedProgress;
    results.summary.orphanedCount = orphanedProgress.length;

    if (orphanedProgress.length > 0) {
      console.log(`   ⚠️  Found ${orphanedProgress.length} orphaned UserProgress records`);
      
      if (fixOrphaned) {
        console.log('   🔧 Deleting orphaned records...');
        const ids = orphanedProgress.map(p => p.id);
        const deleted = await prisma.userProgress.deleteMany({
          where: { id: { in: ids } }
        });
        console.log(`   ✅ Deleted ${deleted.count} orphaned records`);
      } else {
        console.log('   💡 Run with --fix-orphaned to delete these records\n');
      }
    } else {
      console.log('   ✅ No orphaned UserProgress records found\n');
    }

    // 2. Check for missing UserProgress (QuestionAttempts without UserProgress)
    console.log('2️⃣  Checking for QuestionAttempts without UserProgress...');
    
    const missingProgress = await prisma.$queryRaw<Array<{
      userId: string;
      conditionId: string;
      attemptCount: bigint;
    }>>`
      SELECT qa."userId", qa."conditionId", COUNT(*)::bigint as "attemptCount"
      FROM "QuestionAttempt" qa
      LEFT JOIN "UserProgress" up 
        ON qa."userId" = up."userId" 
        AND qa."conditionId" = up."conditionId"
      WHERE up.id IS NULL 
        AND qa."conditionId" IS NOT NULL
      GROUP BY qa."userId", qa."conditionId"
      ORDER BY COUNT(*) DESC
      LIMIT 100
    `;

    results.missingProgress = missingProgress.map(m => ({
      userId: m.userId,
      conditionId: m.conditionId,
      attemptCount: Number(m.attemptCount)
    }));
    results.summary.missingProgressCount = missingProgress.length;

    if (missingProgress.length > 0) {
      console.log(`   ⚠️  Found ${missingProgress.length} user-condition pairs with attempts but no UserProgress`);
      console.log(`   📊 Total orphaned attempts: ${missingProgress.reduce((sum, m) => sum + Number(m.attemptCount), 0)}`);
      console.log('   💡 These will be auto-created on next question attempt\n');
    } else {
      console.log('   ✅ All QuestionAttempts have corresponding UserProgress\n');
    }

    // 3. Check for stale UserProgress (90+ days, low stability)
    console.log('3️⃣  Checking for stale UserProgress records...');
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const allOldProgress = await prisma.userProgress.findMany({
      where: {
        lastReviewAt: {
          lt: ninetyDaysAgo
        }
      },
      select: {
        id: true,
        userId: true,
        conditionId: true,
        lastReviewAt: true,
        fsrsCard: true
      },
      take: 1000,
      orderBy: {
        lastReviewAt: 'asc'
      }
    });

    // Filter for low stability in JavaScript
    const staleProgress = allOldProgress.filter(sp => {
      if (!sp.fsrsCard || typeof sp.fsrsCard !== 'object') return true;
      const card = sp.fsrsCard as any;
      const stability = card.stability ? Number(card.stability) : 0;
      return stability < 5;
    });

    results.staleProgress = staleProgress.map(sp => {
      const daysSinceReview = sp.lastReviewAt 
        ? Math.floor((Date.now() - sp.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const stability = sp.fsrsCard && typeof sp.fsrsCard === 'object' && 'stability' in sp.fsrsCard
        ? Number(sp.fsrsCard.stability)
        : null;

      return {
        id: sp.id,
        userId: sp.userId,
        conditionId: sp.conditionId,
        condition: null, // Will lookup separately if needed
        lastReviewAt: sp.lastReviewAt,
        daysSinceReview,
        stability
      };
    });

    results.summary.staleCount = staleProgress.length;

    if (staleProgress.length > 0) {
      console.log(`   ⚠️  Found ${staleProgress.length} stale UserProgress records (>90 days, stability <5)`);
      const avgDays = staleProgress.reduce((sum, sp) => {
        const days = sp.lastReviewAt 
          ? Math.floor((Date.now() - sp.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return sum + days;
      }, 0) / staleProgress.length;
      console.log(`   📊 Average days since last review: ${Math.round(avgDays)}`);
      console.log('   💡 Consider archiving or prompting users to review\n');
    } else {
      console.log('   ✅ No stale UserProgress records found\n');
    }

    // Get total UserProgress count
    results.summary.totalUserProgress = await prisma.userProgress.count();
    results.summary.healthyCount = results.summary.totalUserProgress - 
      results.summary.orphanedCount - 
      results.summary.staleCount;

    // Display summary
    console.log('='.repeat(80));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total UserProgress Records:        ${results.summary.totalUserProgress}`);
    console.log(`Orphaned (no MedicalContent):      ${results.summary.orphanedCount}`);
    console.log(`Missing Progress (have attempts):  ${results.summary.missingProgressCount}`);
    console.log(`Stale (>90 days, low stability):   ${results.summary.staleCount}`);
    console.log(`Healthy Records:                   ${results.summary.healthyCount}`);
    console.log('='.repeat(80) + '\n');

    // Generate CSV if requested
    if (generateCsv && (orphanedProgress.length > 0 || missingProgress.length > 0 || staleProgress.length > 0)) {
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Orphaned CSV
      if (orphanedProgress.length > 0) {
        const orphanedCsvPath = path.join(process.cwd(), `orphaned-progress-${timestamp}.csv`);
        const orphanedLines = [
          'ID,User ID,Condition ID,Last Review At'
        ];
        orphanedProgress.forEach(op => {
          orphanedLines.push(
            `"${op.id}","${op.userId}","${op.conditionId}","${op.lastReviewAt || 'Never'}"`
          );
        });
        fs.writeFileSync(orphanedCsvPath, orphanedLines.join('\n'));
        console.log(`✅ Orphaned records CSV: ${orphanedCsvPath}`);
      }

      // Missing progress CSV
      if (missingProgress.length > 0) {
        const missingCsvPath = path.join(process.cwd(), `missing-progress-${timestamp}.csv`);
        const missingLines = [
          'User ID,Condition ID,Attempt Count'
        ];
        missingProgress.forEach(mp => {
          missingLines.push(
            `"${mp.userId}","${mp.conditionId}",${Number(mp.attemptCount)}`
          );
        });
        fs.writeFileSync(missingCsvPath, missingLines.join('\n'));
        console.log(`✅ Missing progress CSV: ${missingCsvPath}`);
      }

      // Stale progress CSV
      if (staleProgress.length > 0) {
        const staleCsvPath = path.join(process.cwd(), `stale-progress-${timestamp}.csv`);
        const staleLines = [
          'ID,User ID,Condition ID,Last Review,Days Since Review,Stability'
        ];
        staleProgress.forEach(sp => {
          const days = sp.lastReviewAt 
            ? Math.floor((Date.now() - sp.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          const stability = sp.fsrsCard && typeof sp.fsrsCard === 'object' && 'stability' in sp.fsrsCard
            ? Number(sp.fsrsCard.stability)
            : 'N/A';
          staleLines.push(
            `"${sp.id}","${sp.userId}","${sp.conditionId}","${sp.lastReviewAt || 'Never'}",${days},"${stability}"`
          );
        });
        fs.writeFileSync(staleCsvPath, staleLines.join('\n'));
        console.log(`✅ Stale progress CSV: ${staleCsvPath}`);
      }
      console.log('');
    }

    const isHealthy = results.summary.orphanedCount === 0 && 
                      results.summary.missingProgressCount === 0;

    if (isHealthy) {
      console.log('🎉 UserProgress table is HEALTHY!');
      console.log('   All records are valid and consistent.\n');
    } else {
      console.log('⚠️  Issues detected. Review the audit results above.\n');
    }

    return results;

  } catch (error) {
    console.error('❌ Error during UserProgress audit:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const generateCsv = args.includes('--csv');
  const fixOrphaned = args.includes('--fix-orphaned');

  try {
    await auditUserProgress(generateCsv, fixOrphaned);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main();
