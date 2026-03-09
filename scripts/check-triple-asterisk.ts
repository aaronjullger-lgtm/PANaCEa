import { prisma } from './_shared/db';

async function main() {
  // Use raw SQL to search for three consecutive asterisks
  const rows = await prisma.$queryRawUnsafe<Array<any>>(`
    SELECT id, condition, overview
    FROM "MedicalContent"
    WHERE overview LIKE '%***%'
    LIMIT 5
  `);
  console.log(`Found ${rows.length} rows with triple asterisks in overview`);
  for (const row of rows) {
    console.log(`ID ${row.id}: ${row.condition}`);
    console.log(`  overview: ${row.overview?.substring(0, 200)}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);