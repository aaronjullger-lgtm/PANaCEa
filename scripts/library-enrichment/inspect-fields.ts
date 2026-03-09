#!/usr/bin/env npx tsx

import { prisma, disconnect } from '../_shared/db';

async function main() {
  const sample = await prisma.medicalContent.findFirst({
    where: { condition: { contains: 'Hidradenitis' } },
    select: {
      id: true,
      condition: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
      overview: true,
    },
  });
  console.log('Sample MedicalContent:');
  console.log(JSON.stringify(sample, null, 2));

  // Check a few random conditions
  const random = await prisma.medicalContent.findMany({
    take: 5,
    select: {
      id: true,
      condition: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
      overview: true,
    },
  });
  console.log('\nRandom records:');
  random.forEach((r, i) => {
    console.log(`${i + 1}. ${r.condition}`);
    console.log(`   gold_standard_dx: ${r.gold_standard_dx?.substring(0, 80)}`);
    console.log(`   first_line_rx: ${r.first_line_rx?.substring(0, 80)}`);
    console.log(`   best_initial_test: ${r.best_initial_test?.substring(0, 80)}`);
    console.log(`   overview length: ${r.overview?.length}`);
  });

  // Count nulls
  const nullCounts = await prisma.$queryRaw<{field: string, null_count: number}[]>`
    SELECT 
      'gold_standard_dx' as field, COUNT(*) FILTER (WHERE gold_standard_dx IS NULL) as null_count FROM "MedicalContent"
    UNION ALL
    SELECT 'first_line_rx', COUNT(*) FILTER (WHERE first_line_rx IS NULL) FROM "MedicalContent"
    UNION ALL
    SELECT 'best_initial_test', COUNT(*) FILTER (WHERE best_initial_test IS NULL) FROM "MedicalContent"
    UNION ALL
    SELECT 'overview', COUNT(*) FILTER (WHERE overview IS NULL) FROM "MedicalContent"
  `;
  console.log('\nNull counts:');
  nullCounts.forEach(row => console.log(`${row.field}: ${row.null_count}`));

  // Count empty strings
  const emptyCounts = await prisma.$queryRaw<{field: string, empty_count: number}[]>`
    SELECT 
      'gold_standard_dx' as field, COUNT(*) FILTER (WHERE gold_standard_dx = '') as empty_count FROM "MedicalContent"
    UNION ALL
    SELECT 'first_line_rx', COUNT(*) FILTER (WHERE first_line_rx = '') FROM "MedicalContent"
    UNION ALL
    SELECT 'best_initial_test', COUNT(*) FILTER (WHERE best_initial_test = '') FROM "MedicalContent"
    UNION ALL
    SELECT 'overview', COUNT(*) FILTER (WHERE overview = '') FROM "MedicalContent"
  `;
  console.log('\nEmpty string counts:');
  emptyCounts.forEach(row => console.log(`${row.field}: ${row.empty_count}`));

  // Count placeholder patterns
  const placeholderPatterns = ['to be generated', 'content needed', 'N/A', 'na', 'none', 'clinical diagnosis'];
  for (const pattern of placeholderPatterns) {
    const count = await prisma.medicalContent.count({
      where: {
        OR: [
          { gold_standard_dx: { contains: pattern, mode: 'insensitive' } },
          { first_line_rx: { contains: pattern, mode: 'insensitive' } },
          { best_initial_test: { contains: pattern, mode: 'insensitive' } },
          { overview: { contains: pattern, mode: 'insensitive' } },
        ],
      },
    });
    console.log(`Placeholder "${pattern}" appears in ${count} records`);
  }
}

main()
  .catch(console.error)
  .finally(() => disconnect());