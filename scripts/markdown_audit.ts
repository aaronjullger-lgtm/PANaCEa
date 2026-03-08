import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getTableRowCounts() {
  // Get all tables from the public schema
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const results = [];
  for (const { table_name } of tables) {
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM public."${table_name}"
    `;
    const count = Number(countResult[0].count);
    results.push({ table: table_name, count });
  }
  return results;
}

async function getTextColumns() {
  // Get columns of type text, varchar, etc. that could contain Markdown
  const columns = await prisma.$queryRaw<Array<{ table_name: string, column_name: string, data_type: string }>>`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'varchar', 'char')
      AND column_name NOT IN ('id', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'status', 'type', 'category', 'system', 'subcategory', 'difficulty', 'source', 'role', 'mode', 'deviceType', 'browserName', 'connectionType', 'mediaType', 'folder', 'approvalStatus', 'status', 'priority', 'severity', 'relationshipType', 'evidenceLevel', 'likelihood', 'rankOrder', 'sensitivity', 'specificity', 'frequency', 'grade', 'organization', 'year', 'ageGroup', 'sex', 'context', 'units', 'modality', 'bodyRegion', 'region', 'system', 'subcategory', 'category', 'type', 'name', 'displayName', 'alias', 'code', 'title', 'description', 'explanation', 'explanation', 'explanation', 'explanation')
      AND table_name NOT LIKE '%Relation%'
      AND table_name NOT LIKE '%Link%'
      AND table_name NOT LIKE '%Audit%'
      AND table_name NOT LIKE '%Log%'
      AND table_name NOT LIKE '%Statistic%'
      AND table_name NOT LIKE '%Snapshot%'
      AND table_name NOT LIKE '%Cache%'
    ORDER BY table_name, column_name
  `;
  return columns;
}

async function sampleContent(table: string, column: string, limit = 3) {
  try {
    const samples = await prisma.$queryRaw<Array<Record<string, string>>>`
      SELECT "${column}" as value
      FROM public."${table}"
      WHERE "${column}" IS NOT NULL
        AND "${column}" != ''
        AND length("${column}") > 10
      LIMIT ${limit}
    `;
    return samples.map(s => s.value);
  } catch (error) {
    console.error(`Error sampling ${table}.${column}:`, error);
    return [];
  }
}

async function main() {
  console.log('Fetching table row counts...');
  const counts = await getTableRowCounts();
  console.log('Table counts:');
  counts.forEach(({ table, count }) => {
    console.log(`  ${table}: ${count}`);
  });

  console.log('\nFetching text columns...');
  const columns = await getTextColumns();
  console.log(`Found ${columns.length} text columns.`);

  const columnByTable: Record<string, Array<{ column_name: string, data_type: string }>> = {};
  columns.forEach(col => {
    if (!columnByTable[col.table_name]) columnByTable[col.table_name] = [];
    columnByTable[col.table_name].push({ column_name: col.column_name, data_type: col.data_type });
  });

  const summary = [];

  for (const { table, count } of counts) {
    if (count === 0) continue;
    const cols = columnByTable[table];
    if (!cols || cols.length === 0) continue;

    console.log(`\n--- ${table} (${count} rows) ---`);
    for (const col of cols) {
      console.log(`  ${col.column_name} (${col.data_type})`);
      // Sample content
      const samples = await sampleContent(table, col.column_name, 2);
      if (samples.length > 0) {
        console.log(`    Samples:`);
        samples.forEach((sample, idx) => {
          const preview = sample.length > 100 ? sample.substring(0, 100) + '...' : sample;
          console.log(`      ${idx + 1}: ${preview}`);
        });
      }
      // Determine if contains Markdown formatting
      const hasMarkdown = samples.some(s => /[*_`#\[\]()\-+]/.test(s));
      console.log(`    Markdown detected: ${hasMarkdown ? 'YES' : 'NO'}`);
      summary.push({
        table,
        rowCount: count,
        column: col.column_name,
        hasMarkdown,
        sample: samples[0]?.substring(0, 200) || ''
      });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.table(summary);

  await prisma.$disconnect();
}

main().catch(console.error);