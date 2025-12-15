#!/usr/bin/env tsx

/**
 * Batch Process PDFs Script
 * 
 * Processes existing PDF educational resources that haven't been processed yet
 * Uses the new pdf-parse library instead of AI vision for cost efficiency
 */

import { batchProcessExistingPDFs } from '../services/educationalResourceService';
import { logger } from '../lib/logging/structuredLogger';

async function main() {
  try {
    logger.info('Starting batch PDF processing', 'SCRIPT');
    
    const results = await batchProcessExistingPDFs();
    
    logger.info('Batch PDF processing completed', 'SCRIPT', {
      processed: results.processed,
      failed: results.failed,
      skipped: results.skipped
    });
    
    console.log('\n📊 Batch Processing Results:');
    console.log(`✅ Processed: ${results.processed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    
    if (results.failed > 0) {
      console.log('\n⚠️  Some PDFs failed to process. Check logs for details.');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Batch PDF processing failed', error as Error, 'SCRIPT');
    console.error('❌ Batch processing failed:', error);
    process.exit(1);
  }
}

main();