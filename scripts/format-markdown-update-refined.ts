/**
 * scripts/format-markdown-update-refined.ts
 *
 * 📝 Markdown Syntax Standardization with refined emphasis logic.
 *
 * Applies the same Markdown formatting logic as format-markdown-update.ts
 * but uses a more robust emphasis normalization that avoids over‑correction.
 *
 * CRITICAL: Does NOT summarize, rephrase, shorten, or alter any medical terminology or facts.
 * Only modifies Markdown syntax characters (#, *, -, _) and whitespace/newlines.
 *
 * Processing:
 * - Processes all rows in MedicalContent.
 * - Updates all Markdown columns identified in MARKDOWN_COLUMNS.
 * - Batches updates in groups of 50 rows to avoid timeouts.
 * - Logs errors per row to error_log.txt.
 * - Prints progress messages.
 *
 * Usage:
 *   npx tsx scripts/format-markdown-update-refined.ts
 *
 * Output:
 *   - Console progress and final summary.
 *   - error_log.txt if any failures.
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

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
 * Formatting functions (heading, bullets, escaped newlines same as before)
 */

/**
 * Ensure heading spacing: one blank line before and after any Markdown heading.
 */
function fixHeadingSpacing(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
    // Check if line is a heading (starts with 1-6 # characters followed by space)
    const isHeading = /^#{1,6}\s/.test(line);
    if (isHeading) {
      // Ensure blank line before
      if (i > 0 && prevLine.trim() !== '') {
        result.push('');
      }
      result.push(line);
      // Ensure blank line after
      if (i < lines.length - 1 && nextLine.trim() !== '') {
        result.push('');
      }
    } else {
      result.push(line);
    }
  }
  // Collapse multiple consecutive blank lines to a single blank line
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Normalize bullet characters and nesting.
 */
function fixListBullets(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let prevIndent = 0;
  for (const line of lines) {
    // Detect bullet line: starts with optional spaces, then bullet char, then space
    const bulletMatch = line.match(/^(\s*)([-*+•])\s/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const bulletChar = bulletMatch[2];
      // Determine nesting level: indent / 2 (assuming 2 spaces per level)
      const level = Math.floor(indent / 2);
      let newBullet = '';
      if (level === 0) {
        // Top level: dash
        newBullet = '- ';
      } else if (level === 1) {
        // Secondary: two spaces, asterisk, space
        newBullet = '  * ';
      } else {
        // Deeper levels: preserve existing indentation but convert bullet to dash
        newBullet = ' '.repeat(indent) + '- ';
      }
      // If bullet already matches expected, keep original (including extra spaces after bullet)
      // For simplicity, replace the bullet part
      const afterBullet = line.substring(indent + bulletChar.length + 1);
      result.push(' '.repeat(indent) + newBullet + afterBullet);
      prevIndent = indent;
    } else {
      result.push(line);
      prevIndent = 0;
    }
  }
  return result.join('\n');
}

/**
 * Refined emphasis normalization.
 * Normalizes asterisk‑ and underscore‑based emphasis markers to correct Markdown syntax.
 * Rules:
 * - Bold: exactly two asterisks (**text**)
 * - Italic: exactly one asterisk (*text*) or one underscore (_text_)
 * - Bold+Italic: exactly three asterisks (***text***)
 * - Underscore bold: exactly two underscores (__text__) (alternative bold)
 * - If mismatched delimiter counts, normalize to the start count (or the minimum).
 * - Extra asterisks/underscores are trimmed (capped at 3).
 */
function fixEmphasis(text: string): string {
  // Process asterisk-based emphasis
  let result = text.replace(/(\*+)([^*]+)(\*+)/g, (match, start, content, end) => {
    const startCount = start.length;
    const endCount = end.length;
    // Determine target delimiter count based on start count (prefer start)
    let targetCount = startCount;
    if (startCount >= 3 && endCount >= 3) {
      targetCount = 3; // bold+italic
    } else if (startCount >= 2 && endCount >= 2) {
      targetCount = 2; // bold
    } else if (startCount >= 1 && endCount >= 1) {
      targetCount = 1; // italic
    } else {
      // If one side has zero? shouldn't happen because regex requires at least one.
      targetCount = Math.min(startCount, endCount);
    }
    // If targetCount is more than 3, cap at 3 (unlikely)
    if (targetCount > 3) targetCount = 3;
    const delimiter = '*'.repeat(targetCount);
    return delimiter + content + delimiter;
  });

  // Process underscore-based emphasis (similar but keep underscore)
  result = result.replace(/(_+)([^_]+)(_+)/g, (match, start, content, end) => {
    const startCount = start.length;
    const endCount = end.length;
    // For underscores, we treat 1 as italic, 2 as bold, 3 as bold+italic (though not standard)
    let targetCount = startCount;
    if (startCount >= 3 && endCount >= 3) {
      targetCount = 3;
    } else if (startCount >= 2 && endCount >= 2) {
      targetCount = 2;
    } else if (startCount >= 1 && endCount >= 1) {
      targetCount = 1;
    } else {
      targetCount = Math.min(startCount, endCount);
    }
    if (targetCount > 3) targetCount = 3;
    const delimiter = '_'.repeat(targetCount);
    return delimiter + content + delimiter;
  });

  // Additionally, ensure that bold uses ** (not __) for consistency? We'll keep both.
  // Optional: convert __bold__ to **bold**.
  // result = result.replace(/__([^_]+)__/g, '**$1**');

  return result;
}

/**
 * Replace escaped newline literals with actual newlines.
 */
function fixEscapedNewlines(text: string): string {
  // Replace \\n with \n (if present as literal backslash-n)
  return text.replace(/\\\\n/g, '\n');
}

/**
 * Apply all formatting transformations.
 */
function formatMarkdown(text: string | null): string | null {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  result = fixEscapedNewlines(result);
  result = fixHeadingSpacing(result);
  result = fixListBullets(result);
  result = fixEmphasis(result);
  return result;
}

/**
 * Log error to error_log.txt
 */
function logError(id: number, condition: string, column: string, error: any) {
  const errorMessage = typeof error === 'object' && error.message ? error.message : String(error);
  const line = `${new Date().toISOString()} | ID ${id} | ${condition} | ${column} | ${errorMessage}\n`;
  const logPath = join(process.cwd(), 'error_log.txt');
  appendFileSync(logPath, line, 'utf8');
}

async function main() {
  console.log('🚀 Starting full database Markdown formatting update (refined emphasis logic)...');
  console.log('📊 Fetching total row count...');
  const totalRows = await prisma.medicalContent.count();
  console.log(`📊 Total rows to process: ${totalRows}`);

  const BATCH_SIZE = 50;
  let processedRows = 0;
  let updatedRows = 0;
  let updatedColumns = 0;
  let errorCount = 0;

  // Cursor pagination
  let cursorId: number | undefined = undefined;

  while (processedRows < totalRows) {
    console.log(`🔄 Fetching batch of ${BATCH_SIZE} rows (starting after ID ${cursorId || 'none'})...`);
    const rows = await prisma.medicalContent.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      where: cursorId ? { id: { gt: cursorId } } : undefined,
      select: {
        id: true,
        conditionId: true,
        condition: true,
        ...Object.fromEntries(MARKDOWN_COLUMNS.map(col => [col, true])),
      },
    });

    if (rows.length === 0) {
      break;
    }

    console.log(`   Processing ${rows.length} rows...`);

    for (const row of rows) {
      const updates: Partial<Record<MarkdownColumn, string>> = {};
      let rowUpdated = false;

      for (const col of MARKDOWN_COLUMNS) {
        const before = (row as any)[col];
        if (before == null || typeof before !== 'string') continue;
        const after = formatMarkdown(before);
        if (after !== before) {
          updates[col] = after!;
          updatedColumns++;
          rowUpdated = true;
        }
      }

      if (rowUpdated) {
        try {
          await prisma.medicalContent.update({
            where: { id: row.id },
            data: updates,
          });
          updatedRows++;
        } catch (error) {
          errorCount++;
          // Log each column that caused the error? For simplicity log whole row.
          logError(row.id, row.condition, 'multiple', error);
        }
      }

      processedRows++;
    }

    cursorId = rows[rows.length - 1].id;
    console.log(`   Batch completed. Processed ${processedRows}/${totalRows} rows.`);
  }

  console.log('\n✅ Update completed!');
  console.log(`📊 Summary:`);
  console.log(`   Total rows processed: ${processedRows}`);
  console.log(`   Rows with at least one column updated: ${updatedRows}`);
  console.log(`   Total columns updated: ${updatedColumns}`);
  console.log(`   Errors encountered: ${errorCount}`);
  if (errorCount > 0) {
    console.log(`   Error details written to error_log.txt`);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());