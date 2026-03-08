import { prisma } from './helpers/prisma-client';
import { Prisma } from '@prisma/client';

type TableRowCount = { table: string; count: number };
type TextColumn = { table_name: string; column_name: string; data_type: string };

async function getTableRowCounts(): Promise<TableRowCount[]> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const results: TableRowCount[] = [];
  for (const { table_name } of tables) {
    // Need to quote table name to preserve case
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM public."${table_name}"
    `;
    const count = Number(countResult[0].count);
    results.push({ table: table_name, count });
  }
  return results;
}

async function getTextColumns(): Promise<TextColumn[]> {
  const columns = await prisma.$queryRaw<TextColumn[]>`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'varchar', 'char')
      AND column_name NOT IN (
        'id', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'status', 'type', 'category', 'system', 'subcategory',
        'difficulty', 'source', 'role', 'mode', 'deviceType', 'browserName', 'connectionType', 'mediaType', 'folder',
        'approvalStatus', 'priority', 'severity', 'relationshipType', 'evidenceLevel', 'likelihood', 'rankOrder',
        'sensitivity', 'specificity', 'frequency', 'grade', 'organization', 'year', 'ageGroup', 'sex', 'context',
        'units', 'modality', 'bodyRegion', 'region', 'system', 'subcategory', 'category', 'type', 'name',
        'displayName', 'alias', 'code', 'title', 'description', 'explanation', 'explanation', 'explanation',
        'explanation'
      )
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

async function sampleContent(table: string, column: string, limit = 3): Promise<string[]> {
  try {
    const samples = await prisma.$queryRaw<Array<{ value: string }>>`
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

function detectMarkdown(text: string): boolean {
  // Simple detection of Markdown formatting
  const markdownPatterns = [
    /\*\*[^*]+\*\*/, // bold
    /\*[^*]+\*/,     // italic
    /`[^`]+`/,       // inline code
    /#{1,6}\s/,      // headings
    /\[[^\]]+\]\([^)]+\)/, // links
    /^- /,           // unordered list
    /^\d+\. /,       // ordered list
    /___/,           // horizontal rule
    /~~[^~]+~~/,     // strikethrough
  ];
  return markdownPatterns.some(pattern => pattern.test(text));
}

async function main() {
  console.log('Fetching table row counts...');
  const counts = await getTableRowCounts();
  console.log('Table counts (sorted by population descending):');
  const sorted = counts.sort((a, b) => b.count - a.count);
  sorted.forEach(({ table, count }) => {
    console.log(`  ${table}: ${count}`);
  });

  console.log('\nFetching text columns...');
  const columns = await getTextColumns();
  console.log(`Found ${columns.length} text columns.`);

  const columnByTable: Record<string, TextColumn[]> = {};
  columns.forEach(col => {
    if (!columnByTable[col.table_name]) columnByTable[col.table_name] = [];
    columnByTable[col.table_name].push(col);
  });

  const summary: any[] = [];

  // Examine Drug table in detail
  console.log('\n=== DRUG TABLE DETAIL ===');
  const drugCount = counts.find(c => c.table === 'Drug')?.count || 0;
  console.log(`Drug table row count: ${drugCount}`);
  const drugColumns = columnByTable['Drug'] || [];
  console.log(`Drug columns with text: ${drugColumns.map(c => c.column_name).join(', ')}`);
  for (const col of drugColumns) {
    const samples = await sampleContent('Drug', col.column_name, 3);
    console.log(`\nColumn ${col.column_name}:`);
    samples.forEach((sample, idx) => {
      const preview = sample.length > 150 ? sample.substring(0, 150) + '...' : sample;
      console.log(`  ${idx + 1}: ${preview}`);
    });
    const hasMarkdown = samples.some(s => detectMarkdown(s));
    console.log(`  Markdown detected: ${hasMarkdown ? 'YES' : 'NO'}`);
  }

  // Process top tables (by row count) for Markdown detection
  const topTables = sorted.filter(c => c.count > 0).slice(0, 20); // limit to top 20
  for (const { table, count } of topTables) {
    const cols = columnByTable[table];
    if (!cols || cols.length === 0) continue;

    for (const col of cols) {
      const samples = await sampleContent(table, col.column_name, 2);
      if (samples.length === 0) continue;
      const hasMarkdown = samples.some(s => detectMarkdown(s));
      summary.push({
        table,
        rowCount: count,
        column: col.column_name,
        dataType: col.data_type,
        hasMarkdown: hasMarkdown ? 'Yes' : 'No',
        samplePreview: samples[0]?.substring(0, 200) || '',
      });
    }
  }

  console.log('\n=== SUMMARY TABLE ===');
  console.table(summary);

  // Write summary to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(__dirname, '../docs/markdown_table_audit.md');
  const lines = [
    '# Markdown Table Audit Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Table Row Counts (Descending)',
    '| Table | Row Count |',
    '|-------|-----------|',
    ...sorted.map(c => `| ${c.table} | ${c.count} |`),
    '',
    '## Text Columns with Potential Markdown',
    '| Table | Column | Data Type | Row Count | Markdown Detected | Sample Preview |',
    '|-------|--------|-----------|-----------|-------------------|----------------|',
    ...summary.map(s => `| ${s.table} | ${s.column} | ${s.dataType} | ${s.rowCount} | ${s.hasMarkdown} | ${s.samplePreview.replace(/\|/g, '\\|')} |`),
    '',
    '## Recommendations',
    '1. **High-priority tables** with Markdown columns should be standardized using triggers similar to `standardize_medical_content_markdown`.',
    '2. **Mixed formatting** columns should be audited for consistency.',
    '3. **Plain text columns** can be left as-is.',
    '',
  ];
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`\nReport written to ${outputPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);