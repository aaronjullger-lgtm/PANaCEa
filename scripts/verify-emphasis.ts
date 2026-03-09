import { prisma } from './_shared/db';

/**
 * Check for remaining malformed emphasis patterns in MedicalContent.
 */
async function verifyEmphasis() {
  console.log('🔍 Scanning for malformed emphasis patterns...');

  // Patterns to detect (PostgreSQL regex)
  const patterns = [
    { name: '***text** (three start, two end)', regex: '\\*\\*\\*[^*]+\\*\\*' },
    { name: '**text*** (two start, three end)', regex: '\\*\\*[^*]+\\*\\*\\*' },
    { name: '**text* (missing closing asterisk)', regex: '\\*\\*[^*]+\\*' },
    { name: '*text** (missing opening asterisk)', regex: '\\*[^*]+\\*\\*' },
    { name: '**** (more than three asterisks start or end)', regex: '\\*{4,}' },
    { name: '___ (more than three underscores)', regex: '_{4,}' },
  ];

  const columns = [
    'overview',
    'etiology',
    'pathophysiology',
    'diagnostics',
    'treatment',
    'symptoms',
    'complications',
  ];

  let totalIssues = 0;

  for (const col of columns) {
    console.log(`\n📄 Column: ${col}`);
    for (const pattern of patterns) {
      const sql = `
        SELECT COUNT(*)::integer as count
        FROM "MedicalContent"
        WHERE "${col}" ~ $1
      `;
      const result = await prisma.$queryRawUnsafe<[{ count: number }]>(sql, pattern.regex);
      const count = result[0]?.count ?? 0;
      if (count > 0) {
        console.log(`  ❌ ${pattern.name}: ${count} rows`);
        totalIssues += count;
      } else {
        console.log(`  ✅ ${pattern.name}: none`);
      }
    }
  }

  // Also sample a few rows to show before/after (maybe compare with backup?)
  console.log('\n📋 Sampling 5 rows with emphasis markers...');
  const sampleRows = await prisma.$queryRawUnsafe<Array<any>>(`
    SELECT id, condition, overview
    FROM "MedicalContent"
    WHERE overview LIKE '%*%' OR overview LIKE '%_%'
    LIMIT 5
  `);
  for (const row of sampleRows) {
    console.log(`\n  ID: ${row.id} - ${row.condition}`);
    console.log(`    overview: ${row.overview?.substring(0, 200)}`);
  }

  console.log('\n' + '='.repeat(50));
  if (totalIssues === 0) {
    console.log('✅ No malformed emphasis patterns detected.');
  } else {
    console.log(`⚠️  Found ${totalIssues} potential emphasis issues across checked columns.`);
    console.log('   Consider reviewing the rows above.');
  }
}

async function main() {
  try {
    await verifyEmphasis();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();