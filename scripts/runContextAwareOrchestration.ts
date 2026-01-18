/**
 * Run Context-Aware Site Orchestration
 *
 * Intelligently analyzes and maintains ALL parts of the site:
 * - Understands what each component needs and why
 * - Knows quality expectations for each content type
 * - Maintains dependencies and relationships
 * - Generates content that meets exact requirements
 * - Runs continuously to keep everything topped off
 */

import { runContextAwareOrchestration } from '../services/contextAwareOrchestrator';

async function main() {
  console.log('Starting context-aware site maintenance...\n');

  try {
    await runContextAwareOrchestration();

    console.log('\n✅ Site maintenance complete!');
    console.log('   All components analyzed');
    console.log('   Content gaps identified');
    console.log('   High-priority needs addressed');
    console.log('   Quality standards maintained\n');
  } catch (error) {
    console.error('\n❌ Orchestration failed:', error);
    process.exit(1);
  }
}

main();
