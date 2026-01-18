/**
 * Step 5: Apply Full-Text Search Migration
 *
 * This script applies the PostgreSQL full-text search migration to the MedicalContent table.
 * It adds a tsvector column, creates indexes, and sets up triggers for automatic updates.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration(): Promise<void> {
  console.log('🔍 Applying Full-Text Search Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '../../prisma/migrations/add_fulltext_search.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration SQL...');

    // Execute the migration using raw SQL
    await prisma.$executeRawUnsafe(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Test the search functionality
    console.log('🧪 Testing search functionality...\n');

    // Test 1: Search for "diabetes"
    console.log('Test 1: Searching for "diabetes"...');
    const diabetesResults = await prisma.$queryRaw<
      Array<{
        id: string;
        condition: string;
        system: string;
        rank: number;
        headline: string;
      }>
    >`
      SELECT 
        id,
        condition,
        system,
        ts_rank(search_vector, websearch_to_tsquery('english', 'diabetes')) AS rank,
        ts_headline('english', 
          COALESCE(overview, symptoms, ''),
          websearch_to_tsquery('english', 'diabetes'),
          'MaxWords=30'
        ) AS headline
      FROM "MedicalContent"
      WHERE search_vector @@ websearch_to_tsquery('english', 'diabetes')
      ORDER BY rank DESC
      LIMIT 5
    `;

    console.log(`  Found ${diabetesResults.length} results:`);
    diabetesResults.forEach((result, i) => {
      console.log(
        `  ${i + 1}. [${result.system}] ${result.condition} (rank: ${result.rank.toFixed(3)})`
      );
      console.log(`     ${result.headline.substring(0, 80)}...`);
    });

    // Test 2: Search for "chest pain"
    console.log('\nTest 2: Searching for "chest pain"...');
    const chestPainResults = await prisma.$queryRaw<
      Array<{
        condition: string;
        rank: number;
      }>
    >`
      SELECT condition, ts_rank(search_vector, websearch_to_tsquery('english', 'chest pain')) AS rank
      FROM "MedicalContent"
      WHERE search_vector @@ websearch_to_tsquery('english', 'chest pain')
      ORDER BY rank DESC
      LIMIT 5
    `;

    console.log(`  Found ${chestPainResults.length} results:`);
    chestPainResults.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.condition} (rank: ${result.rank.toFixed(3)})`);
    });

    // Test 3: Performance comparison
    console.log('\n⚡ Performance Comparison...\n');

    // Old method: LIKE query
    const likeStart = Date.now();
    const likeResults = await prisma.medicalContent.count({
      where: {
        OR: [
          { condition: { contains: 'pneumonia', mode: 'insensitive' } },
          { overview: { contains: 'pneumonia', mode: 'insensitive' } },
          { symptoms: { contains: 'pneumonia', mode: 'insensitive' } },
        ],
      },
    });
    const likeTime = Date.now() - likeStart;

    // New method: Full-text search
    const ftsStart = Date.now();
    const ftsResults = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "MedicalContent"
      WHERE search_vector @@ websearch_to_tsquery('english', 'pneumonia')
    `;
    const ftsTime = Date.now() - ftsStart;
    const ftsCount = Number(ftsResults[0].count);

    console.log(`  LIKE query:          ${likeResults} results in ${likeTime}ms`);
    console.log(`  Full-text search:    ${ftsCount} results in ${ftsTime}ms`);
    console.log(`  Speed improvement:   ${(likeTime / ftsTime).toFixed(1)}x faster`);

    console.log('\n✅ Full-text search is ready to use!\n');
    console.log('💡 Usage in API endpoints:');
    console.log("   Use: WHERE search_vector @@ websearch_to_tsquery('english', $1)");
    console.log("   Instead of: WHERE condition LIKE '%search%'");
    console.log('\n💡 The search_vector is automatically updated via triggers on INSERT/UPDATE\n');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  }
}

async function checkIfMigrationApplied(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'MedicalContent' 
        AND column_name = 'search_vector'
      ) as exists
    `;
    return result[0].exists;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log('🏥 PANaCEa Database: Full-Text Search Setup\n');

  // Check if already applied
  const alreadyApplied = await checkIfMigrationApplied();

  if (alreadyApplied && !force) {
    console.log('ℹ️  Full-text search is already set up.');
    console.log('   Use --force to reapply the migration.\n');

    // Just run tests
    console.log('🧪 Running search tests...\n');

    const testResults = await prisma.$queryRaw<
      Array<{
        condition: string;
        system: string;
      }>
    >`
      SELECT condition, system
      FROM "MedicalContent"
      WHERE search_vector @@ websearch_to_tsquery('english', 'heart attack')
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', 'heart attack')) DESC
      LIMIT 3
    `;

    console.log('  Search for "heart attack":');
    testResults.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.system}] ${r.condition}`);
    });
    console.log('\n✅ Full-text search is working!\n');
    return;
  }

  await applyMigration();
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
