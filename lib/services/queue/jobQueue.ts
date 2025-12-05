/**
 * Background Job Queue Service
 * 
 * Phase 4: Queue management for:
 * - Pre-generating AI questions during low-traffic hours
 * - Running health checks
 * - Processing media uploads
 * - Sync operations
 * 
 * NOTE: This is a simple database-backed queue implementation.
 * For production with high volume, consider Redis + BullMQ.
 */

import { PrismaClient } from '@prisma/client';

export type JobType = 
  | 'generate_questions'
  | 'health_check'
  | 'media_processing'
  | 'sync_operation'
  | 'ai_quality_check'
  | 'duplicate_detection';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobPayload {
  [key: string]: any;
}

export interface CreateJobOptions {
  jobType: JobType;
  payload: JobPayload;
  priority?: number; // 1-10, higher = more important
  scheduledFor?: Date;
  maxAttempts?: number;
}

/**
 * Create a new background job
 */
export async function createJob(
  prisma: PrismaClient,
  options: CreateJobOptions
): Promise<any> {
  return prisma.backgroundJob.create({
    data: {
      jobType: options.jobType,
      payload: options.payload,
      priority: options.priority || 5,
      scheduledFor: options.scheduledFor || new Date(),
      maxAttempts: options.maxAttempts || 3,
    },
  });
}

/**
 * Get next job to process (highest priority, oldest first)
 */
export async function getNextJob(
  prisma: PrismaClient,
  jobTypes?: JobType[]
): Promise<any | null> {
  const where: any = {
    status: 'pending',
    scheduledFor: { lte: new Date() },
    attempts: { lt: prisma.raw('max_attempts') },
  };

  if (jobTypes && jobTypes.length > 0) {
    where.jobType = { in: jobTypes };
  }

  const job = await prisma.backgroundJob.findFirst({
    where,
    orderBy: [
      { priority: 'desc' },
      { scheduledFor: 'asc' },
    ],
  });

  if (job) {
    // Mark as processing
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        startedAt: new Date(),
        attempts: job.attempts + 1,
      },
    });
  }

  return job;
}

/**
 * Mark job as completed with result
 */
export async function completeJob(
  prisma: PrismaClient,
  jobId: string,
  result?: any
): Promise<void> {
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      result: result || {},
      completedAt: new Date(),
    },
  });
}

/**
 * Mark job as failed with error message
 */
export async function failJob(
  prisma: PrismaClient,
  jobId: string,
  error: string
): Promise<void> {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const updateData: any = {
    error,
    updatedAt: new Date(),
  };

  // Only mark as failed if max attempts reached
  if (job.attempts >= job.maxAttempts) {
    updateData.status = 'failed';
    updateData.completedAt = new Date();
  } else {
    // Reset to pending for retry with exponential backoff
    updateData.status = 'pending';
    updateData.scheduledFor = new Date(
      Date.now() + Math.pow(2, job.attempts) * 60000 // 2^attempts minutes
    );
  }

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: updateData,
  });
}

/**
 * Schedule question pre-generation job
 * Phase 4: Pre-generate questions during low-traffic hours
 */
export async function scheduleQuestionGeneration(
  prisma: PrismaClient,
  options: {
    system?: string;
    difficulty?: string;
    count?: number;
    scheduledFor?: Date;
  }
): Promise<any> {
  return createJob(prisma, {
    jobType: 'generate_questions',
    payload: {
      system: options.system,
      difficulty: options.difficulty || 'medium',
      count: options.count || 10,
    },
    priority: 3, // Lower priority for background generation
    scheduledFor: options.scheduledFor || getNextLowTrafficTime(),
  });
}

/**
 * Schedule nightly health check
 * Phase 3: Run at 3 AM
 */
export async function scheduleHealthCheck(
  prisma: PrismaClient,
  scheduledFor?: Date
): Promise<any> {
  return createJob(prisma, {
    jobType: 'health_check',
    payload: {},
    priority: 8, // High priority for health checks
    scheduledFor: scheduledFor || getNext3AM(),
  });
}

/**
 * Get next 3 AM timestamp (for nightly jobs)
 */
function getNext3AM(): Date {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  
  // If it's already past 3 AM today, schedule for tomorrow
  if (now.getHours() >= 3) {
    next3AM.setDate(next3AM.getDate() + 1);
  }
  
  return next3AM;
}

/**
 * Get next low-traffic time (2-5 AM)
 */
function getNextLowTrafficTime(): Date {
  const now = new Date();
  const lowTraffic = new Date(now);
  
  // Random time between 2-5 AM
  const hour = 2 + Math.floor(Math.random() * 3);
  lowTraffic.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  
  // If it's already past that time today, schedule for tomorrow
  if (now >= lowTraffic) {
    lowTraffic.setDate(lowTraffic.getDate() + 1);
  }
  
  return lowTraffic;
}

/**
 * Clean up old completed jobs (retention policy)
 */
export async function cleanupOldJobs(
  prisma: PrismaClient,
  retentionDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: ['completed', 'failed'] },
      completedAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Get job statistics
 */
export async function getJobStats(prisma: PrismaClient): Promise<any> {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: 'pending' } }),
    prisma.backgroundJob.count({ where: { status: 'processing' } }),
    prisma.backgroundJob.count({ where: { status: 'completed' } }),
    prisma.backgroundJob.count({ where: { status: 'failed' } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}
