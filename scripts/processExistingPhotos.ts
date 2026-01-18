/**
 * Script to Process Existing Photos
 *
 * Processes all photos currently in the repository:
 * - Confirms clinical relevance
 * - Confirms/suggests proper naming
 * - Identifies if cropping is needed
 * - Runs quality assurance checks
 * - Uploads to database with proper categorization
 */

import { processExistingPhotos } from '../services/automatedContentPipeline';

async function main() {
  console.log('🚀 Processing Existing Photos in Repository...\n');
  console.log('This will:');
  console.log('  ✓ Analyze each image for clinical relevance');
  console.log('  ✓ Suggest proper naming conventions');
  console.log('  ✓ Identify cropping needs');
  console.log('  ✓ Run quality assurance checks');
  console.log('  ✓ Upload approved images to database\n');

  try {
    const result = await processExistingPhotos();

    console.log('\n📊 Processing Complete!');
    console.log('─────────────────────────');
    console.log(`Total Processed: ${result.processed}`);
    console.log(`✅ Approved: ${result.approved}`);
    console.log(`❌ Rejected: ${result.rejected}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.forEach((err) => console.log(`  - ${err}`));
    }

    console.log('\n✨ Done! Check the database for uploaded images.');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
