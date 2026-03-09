/**
 * scripts/verify-frontend-rendering.ts
 *
 * 📝 Verification of frontend Markdown rendering using the same ReactMarkdown pipeline.
 *
 * Fetches a sample condition from MedicalContent, passes it through sanitizeMedicalMarkdown,
 * then through ReactMarkdown with remark-gfm and rehype-raw (exactly as in FormattedSection).
 * Outputs the generated HTML for visual inspection.
 *
 * Checks:
 * - No stray asterisks or underscores visible.
 * - Headings are correctly nested.
 * - Lists are properly indented.
 * - Bold/italic text appears as `<strong>` and `<em>`.
 * - No missing or extra line breaks.
 *
 * Usage:
 *   npx ts-node scripts/verify-frontend-rendering.ts
 *
 * Output:
 *   - Console log of raw Markdown, sanitized Markdown, and rendered HTML.
 *   - Optional: save HTML to a file for browser preview.
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { renderToString } from 'react-dom/server';
import { sanitizeMedicalMarkdown } from '../components/conditions/markdownSanitizer.ts';

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
 * Render Markdown to HTML using the same pipeline as FormattedSection.
 */
function renderMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';
  
  const element = React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeRaw],
    // Use the same component remapping as in FormattedSection (simplified)
    components: {
      h1: ({ node, ...props }) => React.createElement('h4', { className: 'condition-heading-1', ...props }),
      h2: ({ node, ...props }) => React.createElement('h5', { className: 'condition-heading-2', ...props }),
      h3: ({ node, ...props }) => React.createElement('h6', { className: 'condition-heading-3', ...props }),
      table: ({ node, ...props }) => React.createElement('div', { className: 'condition-table-wrap' },
        React.createElement('table', props)
      ),
      li: ({ node, children, ...props }) => React.createElement('li', { className: 'condition-list-item', ...props }, children),
      blockquote: ({ node, children, ...props }) => React.createElement('blockquote', { className: 'condition-blockquote', ...props }, children),
    },
    children: markdown,
  });
  
  return renderToString(element);
}

async function main() {
  console.log('🔍 Verifying frontend Markdown rendering...\n');
  
  // Fetch a single row with rich content (choose a condition known to have formatting)
  const row = await prisma.medicalContent.findFirst({
    where: {
      condition: { contains: 'Acute Kidney Injury' },
    },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      ...Object.fromEntries(MARKDOWN_COLUMNS.map(col => [col, true])),
    },
  });
  
  if (!row) {
    console.error('❌ No condition found.');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`📊 Condition: ${row.condition} (${row.conditionId})\n`);
  
  // Focus on columns with known formatting issues
  const columnsToShow = MARKDOWN_COLUMNS.filter(col => ['symptoms', 'treatment', 'overview', 'pathophysiology', 'diagnostics', 'physicalExam', 'riskFactors'].includes(col));
  
  for (const col of columnsToShow) {
    const raw = (row as any)[col];
    if (!raw || typeof raw !== 'string') continue;
    
    console.log(`\n--- ${col} ---`);
    console.log('Raw Markdown:');
    console.log('-------------');
    console.log(raw);
    console.log();
    
    const sanitized = sanitizeMedicalMarkdown(raw);
    console.log('Sanitized Markdown:');
    console.log('-------------------');
    console.log(sanitized);
    console.log();
    
    const html = renderMarkdownToHtml(sanitized);
    console.log('Rendered HTML:');
    console.log('--------------');
    console.log(html);
    console.log();
    
    // Simple validation checks
    if (html.includes('**') || html.includes('__') || (html.includes('*') && !html.includes('<em>'))) {
      console.warn('  ⚠️  Possible stray Markdown syntax in HTML.');
    }
    if (html.includes('<h1') || html.includes('<h2') || html.includes('<h3')) {
      console.warn('  ⚠️  Headings h1-h3 present (should be remapped to h4-h6).');
    }
    if (html.includes('<ul') && !html.includes('<li')) {
      console.warn('  ⚠️  Unordered list without list items.');
    }
  }
  
  console.log('\n📈 Rendering complete.');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});