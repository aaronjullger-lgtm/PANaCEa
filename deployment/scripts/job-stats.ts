#!/usr/bin/env tsx
/**
 * Job Queue Statistics Display
 * 
 * Displays current job queue statistics for monitoring
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function displayJobStats() {
  try {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: 'pending' } }),
      prisma.backgroundJob.count({ where: { status: 'processing' } }),
      prisma.backgroundJob.count({ where: { status: 'completed' } }),
      prisma.backgroundJob.count({ where: { status: 'failed' } }),
    ]);

    console.log('  Pending:    ', pending);
    console.log('  Processing: ', processing);
    console.log('  Completed:  ', completed);
    console.log('  Failed:     ', failed);
    console.log('  Total:      ', pending + processing + completed + failed);

    // Get recent failed jobs if any
    if (failed > 0) {
      const recentFailed = await prisma.backgroundJob.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          jobType: true,
          error: true,
          updatedAt: true,
        },
      });

      console.log('\n  Recent Failed Jobs:');
      recentFailed.forEach((job, i) => {
        console.log(`    ${i + 1}. [${job.jobType}] ${job.error?.substring(0, 60) || 'Unknown error'}`);
      });
    }

  } catch (error: any) {
    console.error('  ✗ Error fetching job statistics:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  displayJobStats().catch(console.error);
}

export { displayJobStats };
