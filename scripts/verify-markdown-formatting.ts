/**
 * scripts/verify-markdown-formatting.ts
 *
 * 📝 Verification of Markdown formatting after database update.
 *
 * Fetches a sample of updated rows from MedicalContent and examines Markdown columns
 * to ensure formatting rules have been applied correctly.
 *
 * Checks:
 * - Headings have exactly one blank line above and below.
 * - Top‑level bullets use `- `, secondary bullets use `  * `.
 * - Bold/italic formatting uses `**` and `_`.
 * - Escaped newlines `\n` are actual newlines.
 * - No obvious formatting errors that would break frontend rendering.
 *
 * Usage:
 *   npx ts-node scripts/verify-markdown-formatting.ts
 *
 * Output:
 *   - Console summary of issues per column per row.
 *   - Optional: write issues to a log file.
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

config();

function createPrismaClient() {
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const isAccelerateUrl = databaseUrl.startsWith('prisma://');
  if (isAccelerateUrl) {
    const client = new PrismaClient({ accelerateUrl: databaseUrl });
    return client.$extends(withAccelerate());
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return client;
}

const prisma = createPrismaClient();

/**
 * Columns in MedicalContent that contain Markdown (String fields)
 */
const MARKDOWN_COLUMNS = [
  'complications',
  'diagnostics',
  'differentialDiagnosis',
  'epidemiology',
  'etiology',
  'overview',
  'pathophysiology',
  'physicalExam',
  'prognosis',
  'riskFactors',
  'symptoms',
  'treatment',
  'first_line_rx',
  'gold_standard_dx',
  'best_initial_test',
  'classic_patient',
  'disposition',
  'gender_bias',
  'guidelines',
  'image_query',
  'mnemonic',
  'patient_education',
  'prevention',
] as const;

type MarkdownColumn = typeof MARKDOWN_COLUMNS[number];

/**
 * Analyze a Markdown string for formatting issues.
 * Returns an array of issue descriptions.
 */
function analyzeMarkdown(text: string, column: string): string[] {
  const issues: string[] = [];
  if (!text || typeof text !== 'string') {
    return [];
  }
  const lines = text.split('\n');
  let lineNumber = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Check heading spacing
    if (trimmed.startsWith('#') && trimmed.match(/^#{1,6}\s/)) {
      // Check blank line before (if not first line)
      if (i > 0 && lines[i - 1].trim() !== '') {
        issues.push(`Line ${i + 1}: Heading missing blank line above`);
      }
      // Check blank line after (if not last line)
      if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
        issues.push(`Line ${i + 1}: Heading missing blank line below`);
      }
    }
    // Check bullet nesting
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const bulletChar = trimmed[0];
      if (indent === 0 && bulletChar !== '-') {
        issues.push(`Line ${i + 1}: Top-level bullet should use '-', found '${bulletChar}'`);
      }
      if (indent === 2 && bulletChar !== '*') {
        issues.push(`Line ${i + 1}: Secondary bullet (indent 2) should use '*', found '${bulletChar}'`);
      }
    }
    // Check for escaped newline literal
    if (line.includes('\\n') && !line.includes('\\\\n')) {
      issues.push(`Line ${i + 1}: Contains escaped newline '\\n' (should be actual newline)`);
    }
    // Check for mismatched bold/italic markers (simple detection)
    const boldCount = (line.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      issues.push(`Line ${i + 1}: Uneven number of '**' bold markers`);
    }
    const italicCount = (line.match(/_/g) || []).length;
    if (italicCount % 2 !== 0 && !line.includes('_')?.includes('\\_')) {
      // ignore underscores inside words
      if (!line.match(/\b_\b/)) {
        issues.push(`Line ${i + 1}: Uneven number of '_' italic markers`);
      }
    }
  }
  return issues;
}

async function main() {
  console.log('🔍 Verifying Markdown formatting in MedicalContent...\n');
  
  // Fetch 5 random rows
  const rows = await prisma.medicalContent.findMany({
    take: 5,
    orderBy: { id: 'asc' }, // deterministic for review
    select: {
      id: true,
      conditionId: true,
      condition: true,
      ...Object.fromEntries(MARKDOWN_COLUMNS.map(col => [col, true])),
    },
  });

  console.log(`📊 Retrieved ${rows.length} rows for analysis.\n`);

  const totalIssues: { rowId: string; condition: string | null; column: string; issues: string[] }[] = [];

  for (const row of rows) {
    console.log(`\n--- Row: ${row.condition} (${row.conditionId}) ---`);
    for (const col of MARKDOWN_COLUMNS) {
      const value = (row as any)[col];
      if (value && typeof value === 'string') {
        const issues = analyzeMarkdown(value, col);
        if (issues.length > 0) {
          console.log(`  ❌ ${col}: ${issues.length} issue(s)`);
          issues.forEach(issue => console.log(`     - ${issue}`));
          totalIssues.push({
            rowId: row.id,
            condition: row.condition,
            column: col,
            issues,
          });
        } else {
          console.log(`  ✅ ${col}: OK`);
        }
      } else {
        // null or empty
        console.log(`  ⚪ ${col}: empty`);
      }
    }
  }

  console.log('\n📈 SUMMARY');
  console.log(`Total rows examined: ${rows.length}`);
  console.log(`Total columns examined: ${rows.length * MARKDOWN_COLUMNS.length}`);
  console.log(`Total columns with issues: ${totalIssues.length}`);
  if (totalIssues.length > 0) {
    console.log('\n📋 Issues by column:');
    const byColumn: Record<string, number> = {};
    totalIssues.forEach(item => {
      byColumn[item.column] = (byColumn[item.column] || 0) + 1;
    });
    Object.entries(byColumn).forEach(([col, count]) => {
      console.log(`  ${col}: ${count} issue(s)`);
    });
    console.log('\n⚠️  Some formatting issues may require manual review.');
  } else {
    console.log('\n🎉 All Markdown columns appear correctly formatted.');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});