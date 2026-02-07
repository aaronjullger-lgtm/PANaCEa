#!/usr/bin/env tsx

/**
 * Check PDF Processing Status Script
 *
 * Reports on the current status of PDF processing in the system
 */

import { getProcessingStatus } from '../services/domain/educationalResourceService';
import { logger } from '../lib/logging/structuredLogger';

async function main() {
  try {
    logger.info('Checking PDF processing status', 'SCRIPT');

    const status = await getProcessingStatus();

    console.log('\n📊 PDF Processing Status Report:');
    console.log('================================');
    console.log(`📄 Total PDFs: ${status.total}`);
    console.log(`✅ Processed: ${status.processed}`);
    console.log(`⏳ Pending: ${status.pending}`);
    console.log(`❌ Failed: ${status.failed}`);
    console.log(`📈 Processing Rate: ${status.processingRate.toFixed(1)}%`);

    if (status.pending > 0) {
      console.log(`\n💡 Run 'npm run pdf:batch-process' to process ${status.pending} pending PDFs`);
    }

    if (status.failed > 0) {
      console.log(`\n⚠️  ${status.failed} PDFs failed processing and may need manual review`);
    }

    if (status.processingRate === 100) {
      console.log('\n🎉 All PDFs have been processed!');
    }
  } catch (error) {
    logger.error('Failed to check PDF processing status', error as Error, 'SCRIPT');
    console.error('❌ Status check failed:', error);
    process.exit(1);
  }
}

main();
