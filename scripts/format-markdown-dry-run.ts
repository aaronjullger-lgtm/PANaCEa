/**
 * scripts/format-markdown-dry-run.ts
 *
 * 📝 Markdown Syntax Standardization (Dry Run)
 *
 * Standardizes Markdown formatting in MedicalContent columns without altering medical content.
 * Only modifies Markdown syntax characters (#, *, -, _) and whitespace/newlines.
 *
 * CRITICAL: Does NOT summarize, rephrase, shorten, or alter any medical terminology or facts.
 *
 * Formatting Rules:
 * 1. Headings: Ensure exactly one blank line above and below any Markdown heading (lines starting with 1‑6 `#`).
 * 2. List Nesting:
 *    - Top‑level bullets: `- ` (dash space)
 *    - Secondary bullets: `  * ` (two spaces, asterisk, space)
 *    - Convert other bullet characters (`*`, `+`, `•`) at top‑level to `- `
 *    - Preserve deeper nesting (third level: `    - `, etc.)
 * 3. Emphasis:
 *    - Bold: `**text**`
 *    - Italic: `_text_`
 *    - Fix messy combinations (e.g., `***text**` → `**_text_**`, `**_text_` → `**_text_**`)
 * 4. Line Breaks: Replace escaped `\\n` with actual newline `\n`.
 *
 * Usage:
 *   npx ts-node scripts/format-markdown-dry-run.ts
 *
 * Output:
 *   - Prints before/after diff for each column of 5 random rows.
 *   - Writes diff to `formatting_audit_diff.txt`.
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
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
 * Formatting functions
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
 * Fix emphasis markers: bold **text**, italic _text_.
 * Handles common messy patterns.
 */
function fixEmphasis(text: string): string {
  // Fix bold: ensure **text** (no extra asterisks)
  // Pattern: ***text** → **_text_**
  // Pattern: **text* → **text** (assuming missing closing *)
  // We'll use a simple heuristic: replace *** with **_ and ** with **
  // Better to use regex that finds * and _ sequences.
  // We'll implement a more robust replacement:
  // 1. Bold: match **something** (already correct) or __something__
  // 2. Italic: match *something* or _something_
  // 3. Combined bold+italic: ***something*** or **_something_**
  // We'll not overcomplicate; just fix obvious mismatched delimiters.
  // For safety, we'll only fix patterns where delimiters are mismatched but content unchanged.
  // We'll do a pass:
  // - Replace ***text** with **_text_** (assuming bold + italic)
  // - Replace **text* with **text**
  // - Replace *text** with **text**
  // - Replace _text__ with __text__
  // - Replace __text_ with __text__
  // We'll use regex with lookahead to avoid touching valid patterns.
  let result = text;
  // Fix ***text** → **_text_**
  result = result.replace(/\*\*\*([^*]+)\*\*/g, '**_$1_**');
  // Fix **text* (missing closing *)
  result = result.replace(/\*\*([^*]+)\*/g, '**$1**');
  // Fix *text** (missing opening *)
  result = result.replace(/\*([^*]+)\*\*/g, '**$1**');
  // Fix __text_ (missing closing _)
  result = result.replace(/__([^_]+)_/g, '__$1__');
  // Fix _text__ (missing opening _)
  result = result.replace(/_([^_]+)__/g, '__$1__');
  // Fix ***text*** (already correct) leave as is.
  // Ensure bold uses ** not __ (standardize)
  // We'll keep __ as alternative bold; not changing.
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
 * Generate a simple diff view (before/after).
 */
function generateDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let diff = '';
  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i] || '';
    const afterLine = afterLines[i] || '';
    if (beforeLine !== afterLine) {
      diff += `  ${i + 1}: - ${beforeLine}\n`;
      diff += `     + ${afterLine}\n`;
    } else {
      diff += `  ${i + 1}:   ${beforeLine}\n`;
    }
  }
  return diff;
}

async function main() {
  console.log('🔍 Fetching 5 random MedicalContent rows...');
  const rows = await prisma.medicalContent.findMany({
    take: 5,
    orderBy: { id: 'asc' }, // deterministic for review; change to random if desired
    select: {
      id: true,
      conditionId: true,
      condition: true,
      ...Object.fromEntries(MARKDOWN_COLUMNS.map(col => [col, true])),
    },
  });

  console.log(`📄 Found ${rows.length} rows.`);
  const diffs: string[] = [];
  let totalChanges = 0;

  for (const row of rows) {
    diffs.push(`\n=== MedicalContent ID: ${row.id} (${row.condition}) ===`);
    for (const col of MARKDOWN_COLUMNS) {
      const before = (row as any)[col];
      if (!before || typeof before !== 'string') continue;
      const after = formatMarkdown(before);
      if (after !== before) {
        totalChanges++;
        diffs.push(`\n--- ${col} ---`);
        diffs.push(generateDiff(before, after));
      }
    }
  }

  const diffOutput = [
    `Markdown Formatting Audit (Dry Run)`,
    `Generated at: ${new Date().toISOString()}`,
    `Total columns with changes: ${totalChanges}`,
    `========================================`,
    ...diffs,
  ].join('\n');

  const diffPath = join(process.cwd(), 'formatting_audit_diff.txt');
  writeFileSync(diffPath, diffOutput, 'utf8');
  console.log(`📝 Diff written to ${diffPath}`);
  console.log(`📊 Total columns modified: ${totalChanges}`);

  // Print a sample of changes
  if (diffs.length > 0) {
    console.log('\n' + diffs.slice(0, 10).join('\n'));
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());