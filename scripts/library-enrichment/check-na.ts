#!/usr/bin/env npx tsx

import { prisma, disconnect } from '../_shared/db';

async function main() {
  // Find records where gold_standard_dx contains 'na' (case-insensitive)
  const records = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { gold_standard_dx: { contains: 'na', mode: 'insensitive' } },
        { first_line_rx: { contains: 'na', mode: 'insensitive' } },
        { best_initial_test: { contains: 'na', mode: 'insensitive' } },
        { overview: { contains: 'na', mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: {
      condition: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
      overview: true,
    },
  });
  console.log('Records with "na" in any field:');
  records.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.condition}`);
    console.log(`   gold_standard_dx: ${r.gold_standard_dx}`);
    console.log(`   first_line_rx: ${r.first_line_rx}`);
    console.log(`   best_initial_test: ${r.best_initial_test}`);
    console.log(`   overview: ${r.overview?.substring(0, 100)}...`);
  });

  // Check exact match to 'na'
  const exactNa = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { gold_standard_dx: { equals: 'na', mode: 'insensitive' } },
        { first_line_rx: { equals: 'na', mode: 'insensitive' } },
        { best_initial_test: { equals: 'na', mode: 'insensitive' } },
        { overview: { equals: 'na', mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: { condition: true, gold_standard_dx: true },
  });
  console.log('\nExact "na" matches:');
  exactNa.forEach((r) => {
    console.log(`   ${r.condition}: ${r.gold_standard_dx}`);
  });

  // Count exact 'na' per field
  const counts = await prisma.$queryRaw<{field: string, count: number}[]>`
    SELECT 'gold_standard_dx' as field, COUNT(*) as count FROM "MedicalContent" WHERE LOWER(gold_standard_dx) = 'na'
    UNION ALL
    SELECT 'first_line_rx', COUNT(*) FROM "MedicalContent" WHERE LOWER(first_line_rx) = 'na'
    UNION ALL
    SELECT 'best_initial_test', COUNT(*) FROM "MedicalContent" WHERE LOWER(best_initial_test) = 'na'
    UNION ALL
    SELECT 'overview', COUNT(*) FROM "MedicalContent" WHERE LOWER(overview) = 'na'
  `;
  console.log('\nExact "na" counts:');
  counts.forEach(row => console.log(`   ${row.field}: ${row.count}`));
}

main()
  .catch(console.error)
  .finally(() => disconnect());