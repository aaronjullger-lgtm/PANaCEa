#!/usr/bin/env tsx
/**
 * Job Scheduler
 * 
 * Sets up recurring jobs for:
 * - Nightly health checks (3 AM)
 * - Question pre-generation (2-5 AM low traffic)
 * - Cleanup old jobs
 * 
 * Usage:
 *   tsx scripts/scheduleJobs.ts
 * 
 * Production:
 *   Run this as a cron job or scheduled task:
 *   0 0 * * * cd /path/to/app && tsx scripts/scheduleJobs.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { scheduleHealthCheck, scheduleQuestionGeneration, cleanupOldJobs } from '../lib/services/queue/jobQueue';

// Load environment variables
config();

const prisma = new PrismaClient();

/**
 * Schedule all recurring jobs
 */
async function scheduleAllJobs() {
  console.log('[Scheduler] Setting up scheduled jobs...\n');

  try {
    // 1. Schedule nightly health check at 3 AM
    const healthCheckJob = await scheduleHealthCheck(prisma);
    console.log(`[Scheduler] ✓ Health check scheduled for ${healthCheckJob.scheduledFor.toLocaleString()}`);

    // 2. Schedule question pre-generation for low traffic hours
    const systems = ['CV', 'PULM', 'GI', 'NEURO', 'ENDO', 'RENAL'];
    
    for (const system of systems) {
      const job = await scheduleQuestionGeneration(prisma, {
        system,
        difficulty: 'medium',
        count: 5, // Generate 5 questions per system
      });
      console.log(`[Scheduler] ✓ Question generation for ${system} scheduled for ${job.scheduledFor.toLocaleString()}`);
    }

    // 3. Clean up old completed jobs (retain 30 days)
    const deletedCount = await cleanupOldJobs(prisma, 30);
    console.log(`[Scheduler] ✓ Cleaned up ${deletedCount} old jobs\n`);

    console.log('[Scheduler] All jobs scheduled successfully');
    
  } catch (error: any) {
    console.error('[Scheduler] Error scheduling jobs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Check if jobs are already scheduled for today
 */
async function needsScheduling(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingJobs = await prisma.backgroundJob.count({
    where: {
      jobType: 'health_check',
      scheduledFor: {
        gte: today,
        lt: tomorrow,
      },
      status: { in: ['pending', 'processing'] },
    },
  });

  return existingJobs === 0;
}

/**
 * Main execution
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PANaCEa Job Scheduler');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const shouldSchedule = await needsScheduling();
    
    if (shouldSchedule) {
      await scheduleAllJobs();
    } else {
      console.log('[Scheduler] Jobs already scheduled for today');
      console.log('[Scheduler] Skipping scheduling to avoid duplicates\n');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('[Scheduler] Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { scheduleAllJobs };
