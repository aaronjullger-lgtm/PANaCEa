#!/usr/bin/env tsx
/**
 * Background Worker Process
 *
 * Processes queued jobs for:
 * - Pre-generating AI questions
 * - Running health checks
 * - Processing media
 * - Other async operations
 *
 * Usage:
 *   tsx scripts/backgroundWorker.ts
 *
 * Production deployment:
 *   - Run as a daemon/service
 *   - Use PM2, systemd, or container orchestration
 *   - Configure multiple workers for high availability
 */

import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { getNextJob, completeJob, failJob, type JobType } from '../lib/services/queue/jobQueue';
import { generateSingleQuestion } from '../lib/questionGenerator';
import * as fs from 'fs';
import * as path from 'path';
import { prisma, disconnectPrisma } from './helpers/prisma-client';

// Load environment variables
config();

const POLL_INTERVAL = 5000; // 5 seconds
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

let isShuttingDown = false;
let activeJobs = 0;

/**
 * Main worker loop
 */
async function runWorker() {
  console.log('[Worker] Background worker started');
  console.log(`[Worker] Polling every ${POLL_INTERVAL}ms`);

  while (!isShuttingDown) {
    try {
      const job = await getNextJob(prisma);

      if (job) {
        activeJobs++;
        console.log(`[Worker] Processing job ${job.id} (${job.jobType})`);

        try {
          await processJob(job);
          await completeJob(prisma, job.id, { success: true });
          console.log(`[Worker] Job ${job.id} completed`);
        } catch (error: any) {
          console.error(`[Worker] Job ${job.id} failed:`, error.message);
          await failJob(prisma, job.id, error.message);
        } finally {
          activeJobs--;
        }
      } else {
        // No jobs available, wait before polling again
        await sleep(POLL_INTERVAL);
      }
    } catch (error: any) {
      console.error('[Worker] Error in worker loop:', error);
      await sleep(POLL_INTERVAL);
    }
  }

  console.log('[Worker] Shutting down...');
}

/**
 * Process a job based on its type
 */
async function processJob(job: any): Promise<void> {
  switch (job.jobType as JobType) {
    case 'generate_questions':
      await processQuestionGeneration(job);
      break;

    case 'health_check':
      await processHealthCheck(job);
      break;

    case 'media_processing':
      await processMedia(job);
      break;

    case 'sync_operation':
      await processSyncOperation(job);
      break;

    case 'ai_quality_check':
      await processAIQualityCheck(job);
      break;

    case 'duplicate_detection':
      await processDuplicateDetection(job);
      break;

    case 'fsrs_optimization':
      await processFSRSOptimization(job);
      break;

    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}

/**
 * Generate pre-made questions for instant delivery
 */
async function processQuestionGeneration(job: any): Promise<void> {
  const { system, difficulty, count } = job.payload;

  console.log(`[Worker] Generating ${count} questions for ${system || 'all systems'}`);

  let generatedCount = 0;

  // Note: Actual question generation would use the existing questionGenerator
  // This is a simplified version to demonstrate the pattern
  for (let i = 0; i < count; i++) {
    try {
      // Generate a single question (placeholder - would use actual generator)
      const questionData = {
        type: 'vignette',
        system: system,
        difficulty: difficulty,
        // ... question content
      };

      // Store in PreGeneratedQuestion table
      await prisma.preGeneratedQuestion.create({
        data: {
          id: uuidv4(),

          questionType: 'vignette',
          system: system,
          difficulty: difficulty,
          questionData: questionData,
        },
      });

      generatedCount++;
    } catch (error: any) {
      console.error(`[Worker] Failed to generate question ${i + 1}:`, error.message);
    }
  }

  console.log(`[Worker] Generated ${generatedCount} questions`);
}

/**
 * Run content health check
 */
async function processHealthCheck(job: any): Promise<void> {
  console.log('[Worker] Running content health check');

  // Import and run the health checker
  const contentPath = path.join(__dirname, '../conditionContent.generated.json');

  if (!fs.existsSync(contentPath)) {
    throw new Error('Content file not found');
  }

  const rawContent = fs.readFileSync(contentPath, 'utf-8');
  const content = JSON.parse(rawContent);

  let issueCount = 0;
  const issues: any[] = [];

  // Run basic checks
  for (const [conditionId, condition] of Object.entries(content as Record<string, any>)) {
    if (!condition.overview || condition.overview.includes('[NO CONTENT PROVIDED]')) {
      issues.push({
        contentId: conditionId,
        issueType: 'missing_explanation',
        description: 'Missing or placeholder overview',
        severity: 'high',
      });
      issueCount++;
    }

    if (!condition.treatment || condition.treatment.length === 0) {
      issues.push({
        contentId: conditionId,
        issueType: 'invalid_field',
        description: 'Missing treatment information',
        severity: 'high',
      });
      issueCount++;
    }
  }

  // Store health report
  await prisma.contentHealthReport.create({
    data: {
      id: uuidv4(),

      totalContent: Object.keys(content).length,
      missingExplanations: issues.filter((i) => i.issueType === 'missing_explanation').length,
      brokenMediaLinks: 0, // Would check media links in full implementation
      invalidFields: issues.filter((i) => i.issueType === 'invalid_field').length,
      outdatedContent: 0,
      reportData: {
        issues: issues.slice(0, 100), // Store first 100 issues
        summary: `Found ${issueCount} issues`,
      },
    },
  });

  console.log(`[Worker] Health check completed: ${issueCount} issues found`);
}

/**
 * Process media uploads (placeholder)
 */
async function processMedia(job: any): Promise<void> {
  console.log('[Worker] Processing media');
  // Placeholder for media processing
}

/**
 * Process sync operations (placeholder)
 */
async function processSyncOperation(job: any): Promise<void> {
  console.log('[Worker] Processing sync operation');
  // Placeholder for sync processing
}

/**
 * AI quality check for content (Phase 5)
 */
async function processAIQualityCheck(job: any): Promise<void> {
  console.log('[Worker] Running AI quality check');
  // Placeholder for AI quality checking
}

/**
 * Duplicate detection (Phase 5)
 */
async function processDuplicateDetection(job: any): Promise<void> {
  console.log('[Worker] Running duplicate detection');
  // Placeholder for duplicate detection
}

/**
 * FSRS parameter optimization (Phase 3)
 * Runs nightly to optimize FSRS v6 weights per user from ReviewLog (sessionType=MAIN)
 */
async function processFSRSOptimization(job: any): Promise<void> {
  console.log('[Worker] Running FSRS parameter optimization');
  const { optimizeAllUsersFSRS } = await import('./automation/jobs/fsrsOptimization');
  const result = await optimizeAllUsersFSRS();
  console.log(
    `[Worker] FSRS optimization complete: ${result.optimized}/${result.processed} users optimized`
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = async () => {
    if (isShuttingDown) return;

    console.log('[Worker] Shutdown signal received');
    isShuttingDown = true;

    // Wait for active jobs to complete
    const startTime = Date.now();
    while (activeJobs > 0 && Date.now() - startTime < SHUTDOWN_TIMEOUT) {
      console.log(`[Worker] Waiting for ${activeJobs} active jobs...`);
      await sleep(1000);
    }

    await disconnectPrisma();
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Start the worker
 */
async function main() {
  setupShutdownHandlers();

  try {
    await runWorker();
  } catch (error: any) {
    console.error('[Worker] Fatal error:', error);
    await disconnectPrisma();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { runWorker, processJob };
