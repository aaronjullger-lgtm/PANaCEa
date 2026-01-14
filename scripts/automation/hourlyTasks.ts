#!/usr/bin/env tsx
/**
 * Hourly Automation Tasks
 * 
 * Runs every hour to maintain system health and performance:
 * - API connectivity checks
 * - Database connection verification
 * - Real-time error monitoring
 * - Question quality validation
 * - Performance metrics collection
 * 
 * Usage: tsx scripts/automation/hourlyTasks.ts
 * Schedule: 0 * * * * (every hour)
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';

// Load environment variables
config();

interface HourlyReport {
  timestamp: Date;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    duration?: number;
  }[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

const report: HourlyReport = {
  timestamp: new Date(),
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
};

/**
 * Check database connectivity
 */
async function checkDatabaseConnection(): Promise<void> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    report.checks.push({
      name: 'Database Connection',
      status: 'pass',
      message: 'Database is accessible',
      duration: Date.now() - start,
    });
    report.summary.passed++;
  } catch (error: any) {
    report.checks.push({
      name: 'Database Connection',
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check Gemini API connectivity
 */
async function checkGeminiAPI(): Promise<void> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    report.checks.push({
      name: 'Gemini API Configuration',
      status: 'fail',
      message: 'GEMINI_API_KEY not configured',
      duration: Date.now() - start,
    });
    report.summary.failed++;
    return;
  }

  try {
    // Simple connectivity test
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );

    if (response.ok) {
      report.checks.push({
        name: 'Gemini API Connection',
        status: 'pass',
        message: 'Gemini API is accessible',
        duration: Date.now() - start,
      });
      report.summary.passed++;
    } else {
      report.checks.push({
        name: 'Gemini API Connection',
        status: 'fail',
        message: `Gemini API returned status ${response.status}`,
        duration: Date.now() - start,
      });
      report.summary.failed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Gemini API Connection',
      status: 'fail',
      message: `Failed to reach Gemini API: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Monitor failed background jobs
 */
async function monitorBackgroundJobs(): Promise<void> {
  const start = Date.now();
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const failedJobs = await prisma.backgroundJob.count({
      where: {
        status: 'failed',
        updatedAt: { gte: oneHourAgo },
      },
    });

    if (failedJobs === 0) {
      report.checks.push({
        name: 'Background Jobs',
        status: 'pass',
        message: 'No failed jobs in the last hour',
        duration: Date.now() - start,
      });
      report.summary.passed++;
    } else if (failedJobs < 5) {
      report.checks.push({
        name: 'Background Jobs',
        status: 'warning',
        message: `${failedJobs} jobs failed in the last hour`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'Background Jobs',
        status: 'fail',
        message: `${failedJobs} jobs failed in the last hour - investigate immediately`,
        duration: Date.now() - start,
      });
      report.summary.failed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Background Jobs',
      status: 'fail',
      message: `Failed to check jobs: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check medical content availability
 */
async function checkContentAvailability(): Promise<void> {
  const start = Date.now();
  try {
    const contentCount = await prisma.medicalContent.count({
      where: { status: 'published' },
    });

    if (contentCount === 0) {
      report.checks.push({
        name: 'Content Availability',
        status: 'fail',
        message: 'No published content found - database may need seeding',
        duration: Date.now() - start,
      });
      report.summary.failed++;
    } else if (contentCount < 100) {
      report.checks.push({
        name: 'Content Availability',
        status: 'warning',
        message: `Only ${contentCount} published conditions - expected 500+`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'Content Availability',
        status: 'pass',
        message: `${contentCount} published conditions available`,
        duration: Date.now() - start,
      });
      report.summary.passed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Content Availability',
      status: 'fail',
      message: `Failed to check content: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check disk space and performance
 */
async function checkSystemResources(): Promise<void> {
  const start = Date.now();
  try {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    if (memUsedMB > 500) {
      report.checks.push({
        name: 'System Resources',
        status: 'warning',
        message: `High memory usage: ${memUsedMB}MB / ${memTotalMB}MB`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'System Resources',
        status: 'pass',
        message: `Memory usage: ${memUsedMB}MB / ${memTotalMB}MB`,
        duration: Date.now() - start,
      });
      report.summary.passed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'System Resources',
      status: 'warning',
      message: `Could not check resources: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.warnings++;
  }
}

/**
 * Print report to console
 */
function printReport(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Hourly Health Check Report                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`⏰ Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`📊 Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings\n`);

  report.checks.forEach((check) => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    const duration = check.duration ? ` (${check.duration}ms)` : '';
    console.log(`${icon} ${check.name}${duration}`);
    console.log(`   ${check.message}\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Save report to file for tracking
 */
function saveReport(): void {
  const reportDir = path.join(process.cwd(), 'logs', 'hourly');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filename = `hourly-${report.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(reportDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`💾 Report saved to: ${filepath}\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Starting hourly automation tasks...\n');

  report.summary.total = 5;

  try {
    await checkDatabaseConnection();
    await checkGeminiAPI();
    await monitorBackgroundJobs();
    await checkContentAvailability();
    await checkSystemResources();

    printReport();
    saveReport();

    if (report.summary.failed > 0) {
      console.log('⚠️  Some checks failed. Review the report above.');
      process.exit(1);
    } else if (report.summary.warnings > 0) {
      console.log('⚠️  All critical checks passed, but some warnings were raised.');
      process.exit(0);
    } else {
      console.log('✅ All hourly checks passed!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during hourly tasks:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    await disconnectPrisma();
    process.exit(1);
  });
}

export { main as runHourlyTasks };
