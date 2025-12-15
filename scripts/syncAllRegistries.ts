#!/usr/bin/env tsx
/**
 * Master Sync Script - Sync All Registries to Database
 * 
 * This script syncs ALL registry files to their respective database tables.
 * Runs all individual sync scripts in sequence.
 * 
 * Usage: tsx scripts/syncAllRegistries.ts
 * Or: npm run sync:all-registries
 * 
 * This is typically run:
 * - After initial setup
 * - After adding new entries to any registry
 * - As part of deployment process
 */

import { config } from 'dotenv';

// Load environment variables
config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║    Master Registry Sync - All Medical Knowledge Entities  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

interface SyncResult {
  registry: string;
  success: boolean;
  error?: string;
  duration: number;
}

const results: SyncResult[] = [];

/**
 * Run a sync script and capture result
 */
async function runSync(registryName: string, syncFunction: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting: ${registryName}`);
    console.log('='.repeat(60));
    
    await syncFunction();
    
    const duration = Date.now() - startTime;
    results.push({
      registry: registryName,
      success: true,
      duration,
    });
    
    console.log(`\n✅ ${registryName} completed in ${(duration / 1000).toFixed(2)}s`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      registry: registryName,
      success: false,
      error: error.message,
      duration,
    });
    
    console.error(`\n❌ ${registryName} failed: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const overallStart = Date.now();
  
  // Import and run all sync scripts
  try {
    // Core medical entities
    const { syncAllConditions } = await import('./syncConditionTable');
    await runSync('Conditions', syncAllConditions);
    
    const { syncAllDrugs } = await import('./syncDrugTable');
    await runSync('Drugs', syncAllDrugs);
    
    const { syncAllTests } = await import('./syncSpecialTestTable');
    await runSync('Special Tests', syncAllTests);
    
    const { syncAllAnatomy } = await import('./syncAnatomyTable');
    await runSync('Anatomy', syncAllAnatomy);
    
    // Note: Additional sync scripts need to be created for:
    // - Lab Tests
    // - Imaging Studies
    // - Symptoms
    // - Findings
    // - Surgeries
    // - Treatments
    // - Guidelines
    // - Scoring Systems
    // - Abbreviations
    // - Differentials
    
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log('║    Master Sync Summary');
    console.log('═'.repeat(60) + '\n');
    
    const totalDuration = Date.now() - overallStart;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`📊 Total Registries: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}\n`);
    
    // Print individual results
    console.log('Registry Results:');
    results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`  ${index + 1}. ${icon} ${result.registry} (${duration}s)`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '═'.repeat(60));
    
    if (failed > 0) {
      console.log('\n⚠️  Some registries failed to sync. Check errors above.');
      console.log('   You can re-run individual syncs with:');
      console.log('   npm run sync:conditions');
      console.log('   npm run sync:drugs');
      console.log('   etc.\n');
      process.exit(1);
    } else {
      console.log('\n✅ All registries synced successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Run automation to generate content: npm run automation:daily');
      console.log('   2. Check weekly report: npm run automation:weekly\n');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during master sync:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as syncAllRegistries };
