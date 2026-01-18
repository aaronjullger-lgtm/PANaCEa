/**
 * Run Automated Content Pipeline
 *
 * Orchestrates the entire automated content management system:
 * 1. Process existing photos
 * 2. Identify content gaps
 * 3. Source new content
 * 4. Validate everything
 * 5. Auto-generate missing content
 * 6. Optimize database
 */

import { runAutomatedPipeline } from '../services/automatedContentPipeline';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    PANaCEa Automated Content Pipeline                     ║');
  console.log('║    Building a guaranteed-correct medical content database ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await runAutomatedPipeline();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║    ✨ Pipeline Complete! Database topped off.              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    process.exit(1);
  }
}

main();
