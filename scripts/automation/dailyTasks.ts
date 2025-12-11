#!/usr/bin/env tsx
/**
 * Daily Automation Tasks
 * 
 * Runs daily to ensure content accuracy and system health:
 * - Content accuracy validation against medical standards
 * - Automated content gap identification
 * - Media asset quality checks
 * - Performance metrics aggregation
 * - Database optimization and cleanup
 * 
 * Usage: tsx scripts/automation/dailyTasks.ts
 * Schedule: 0 3 * * * (3 AM daily)
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const prisma = new PrismaClient();

interface DailyReport {
  timestamp: Date;
  tasks: {
    name: string;
    status: 'completed' | 'failed' | 'skipped';
    message: string;
    details?: any;
    duration?: number;
  }[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

const report: DailyReport = {
  timestamp: new Date(),
  tasks: [],
  summary: { total: 0, completed: 0, failed: 0, skipped: 0 },
};

/**
 * Validate content accuracy
 */
async function validateContentAccuracy(): Promise<void> {
  const start = Date.now();
  console.log('🔍 Validating content accuracy...');
  
  try {
    const content = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: { conditionId: true, condition: true, content: true },
    });

    const issues: string[] = [];
    
    for (const item of content) {
      const contentObj = item.content as any;
      
      // Check for placeholder content
      if (contentObj?.overview && /\[NO CONTENT PROVIDED\]/i.test(contentObj.overview)) {
        issues.push(`${item.condition}: Contains placeholder in overview`);
      }
      
      // Check for empty critical sections
      if (!contentObj?.treatment && !contentObj?.management) {
        issues.push(`${item.condition}: Missing treatment information`);
      }
    }

    report.tasks.push({
      name: 'Content Accuracy Validation',
      status: 'completed',
      message: `Validated ${content.length} conditions, found ${issues.length} issues`,
      details: { totalConditions: content.length, issuesFound: issues.length, issues: issues.slice(0, 10) },
      duration: Date.now() - start,
    });
    report.summary.completed++;
  } catch (error: any) {
    report.tasks.push({
      name: 'Content Accuracy Validation',
      status: 'failed',
      message: `Failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Identify content gaps
 */
async function identifyContentGaps(): Promise<void> {
  const start = Date.now();
  console.log('🔍 Identifying content gaps...');
  
  try {
    // Count conditions by system
    const systemCounts = await prisma.medicalContent.groupBy({
      by: ['system'],
      where: { status: 'published' },
      _count: { system: true },
    });

    const gaps = systemCounts.filter(s => s._count.system < 10);

    report.tasks.push({
      name: 'Content Gap Identification',
      status: 'completed',
      message: `Found ${gaps.length} systems with < 10 conditions`,
      details: { systemCounts, gapSystems: gaps.map(g => g.system) },
      duration: Date.now() - start,
    });
    report.summary.completed++;
  } catch (error: any) {
    report.tasks.push({
      name: 'Content Gap Identification',
      status: 'failed',
      message: `Failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check media asset quality
 */
async function checkMediaAssetQuality(): Promise<void> {
  const start = Date.now();
  console.log('📸 Checking media asset quality...');
  
  try {
    const mediaAssets = await prisma.mediaAsset.findMany({
      where: {
        OR: [
          { qualityScore: null },
          { qualityScore: { lt: 50 } },
          { originalUrl: null },
        ],
      },
      select: { id: true, filename: true, qualityScore: true, originalUrl: true },
    });

    const missingQuality = mediaAssets.filter(m => m.qualityScore === null).length;
    const lowQuality = mediaAssets.filter(m => m.qualityScore !== null && m.qualityScore < 50).length;
    const missingUrl = mediaAssets.filter(m => !m.originalUrl).length;

    report.tasks.push({
      name: 'Media Asset Quality Check',
      status: 'completed',
      message: `Checked media assets: ${missingQuality} missing quality score, ${lowQuality} low quality, ${missingUrl} missing URLs`,
      details: { missingQuality, lowQuality, missingUrl, totalChecked: mediaAssets.length },
      duration: Date.now() - start,
    });
    report.summary.completed++;
  } catch (error: any) {
    report.tasks.push({
      name: 'Media Asset Quality Check',
      status: 'failed',
      message: `Failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Aggregate performance metrics
 */
async function aggregatePerformanceMetrics(): Promise<void> {
  const start = Date.now();
  console.log('📊 Aggregating performance metrics...');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const perfRecords = await prisma.performanceRecord.count({
      where: {
        timestamp: {
          gte: BigInt(yesterday.getTime()),
          lt: BigInt(today.getTime()),
        },
      },
    });

    const correctAnswers = await prisma.performanceRecord.count({
      where: {
        timestamp: {
          gte: BigInt(yesterday.getTime()),
          lt: BigInt(today.getTime()),
        },
        isCorrect: true,
      },
    });

    const accuracy = perfRecords > 0 ? (correctAnswers / perfRecords * 100).toFixed(2) : 'N/A';

    report.tasks.push({
      name: 'Performance Metrics Aggregation',
      status: 'completed',
      message: `Yesterday: ${perfRecords} questions answered, ${accuracy}% accuracy`,
      details: { totalAnswers: perfRecords, correctAnswers, accuracy },
      duration: Date.now() - start,
    });
    report.summary.completed++;
  } catch (error: any) {
    report.tasks.push({
      name: 'Performance Metrics Aggregation',
      status: 'failed',
      message: `Failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Database cleanup and optimization
 */
async function databaseCleanup(): Promise<void> {
  const start = Date.now();
  console.log('🧹 Running database cleanup...');
  
  try {
    // Clean up old failed jobs (> 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.backgroundJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed'] },
        completedAt: { lt: thirtyDaysAgo },
      },
    });

    report.tasks.push({
      name: 'Database Cleanup',
      status: 'completed',
      message: `Cleaned up ${deleted.count} old background jobs`,
      details: { deletedJobs: deleted.count },
      duration: Date.now() - start,
    });
    report.summary.completed++;
  } catch (error: any) {
    report.tasks.push({
      name: 'Database Cleanup',
      status: 'failed',
      message: `Failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Print report to console
 */
function printReport(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Daily Automation Report                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📅 Date: ${report.timestamp.toISOString()}`);
  console.log(`📊 Summary: ${report.summary.completed} completed, ${report.summary.failed} failed, ${report.summary.skipped} skipped\n`);

  report.tasks.forEach((task) => {
    const icon = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏭️';
    const duration = task.duration ? ` (${task.duration}ms)` : '';
    console.log(`${icon} ${task.name}${duration}`);
    console.log(`   ${task.message}\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Save report to file
 */
function saveReport(): void {
  const reportDir = path.join(process.cwd(), 'logs', 'daily');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const dateStr = report.timestamp.toISOString().split('T')[0];
  const filepath = path.join(reportDir, `daily-${dateStr}.json`);
  
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`💾 Daily report saved to: ${filepath}\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🌅 Starting daily automation tasks...\n');

  report.summary.total = 5;

  try {
    await validateContentAccuracy();
    await identifyContentGaps();
    await checkMediaAssetQuality();
    await aggregatePerformanceMetrics();
    await databaseCleanup();

    printReport();
    saveReport();

    if (report.summary.failed > 0) {
      console.log('⚠️  Some tasks failed. Review the report above.');
      process.exit(1);
    } else {
      console.log('✅ All daily tasks completed successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during daily tasks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runDailyTasks };
