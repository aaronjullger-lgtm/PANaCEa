#!/usr/bin/env tsx

/**
 * Tailwind Color Migration Script
 * 
 * Replaces unauthorized Tailwind color utility classes with semantic design tokens
 * according to the Stormy Slate design system.
 * 
 * Usage:
 *   npx tsx scripts/tailwind-migration.ts --dry-run
 *   npx tsx scripts/tailwind-migration.ts --apply
 */

import fs from 'fs/promises';
import path from 'path';

// ----------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------

interface ColorMapping {
  /** Tailwind color family regex (without prefix) */
  pattern: RegExp;
  /** Replacement token (Tailwind color name or CSS variable) */
  token: string;
  /** Whether token is a CSS variable (requires wrapping in var()) */
  isCssVariable?: boolean;
  /** Optional note */
  note?: string;
}

/**
 * Mapping of Tailwind color families to semantic tokens.
 * 
 * Each mapping defines a regex pattern that matches the color part of a utility class
 * (e.g., 'blue-500', 'green-300/50'). The replacement token is used as the new color
 * value, either as a Tailwind color (e.g., 'data-pass') or a CSS variable
 * (e.g., '--color-category-practice').
 * 
 * For CSS variables, the resulting class will be of the form
 * `bg-[var(--color-category-practice)]` (or `text-`, `border-`, etc.).
 */
const COLOR_MAPPINGS: ColorMapping[] = [
  // Blue → Steel Blue (category practice)
  {
    pattern: /blue-\d+/,
    token: '--color-category-practice',
    isCssVariable: true,
    note: 'Steel blue for practice questions',
  },
  // Green/Emerald → Data Pass (success)
  {
    pattern: /green-\d+/,
    token: 'data-pass',
    note: 'Semantic token for passing/correct',
  },
  {
    pattern: /emerald-\d+/,
    token: 'data-pass',
    note: 'Semantic token for passing/correct',
  },
  // Red → Data Fail (error)
  {
    pattern: /red-\d+/,
    token: 'data-fail',
    note: 'Semantic token for failing/incorrect',
  },
  // Amber → Data Provisional (warning)
  {
    pattern: /amber-\d+/,
    token: 'data-provisional',
    note: 'Semantic token for provisional/warning',
  },
  // Slate → Data Neutral (neutral)
  {
    pattern: /slate-\d+/,
    token: 'data-neutral',
    note: 'Semantic token for neutral/gray',
  },
  // Gray/Zinc/Neutral/Stone → appropriate muted/border variables
  {
    pattern: /gray-\d+/,
    token: '--color-text-muted',
    isCssVariable: true,
    note: 'Generic gray → text muted variable',
  },
  {
    pattern: /zinc-\d+/,
    token: '--color-border',
    isCssVariable: true,
    note: 'Zinc → border variable',
  },
  {
    pattern: /neutral-\d+/,
    token: '--color-bg-secondary',
    isCssVariable: true,
    note: 'Neutral → secondary background',
  },
  {
    pattern: /stone-\d+/,
    token: '--color-bg-tertiary',
    isCssVariable: true,
    note: 'Stone → tertiary background',
  },
];

/**
 * Supported utility prefixes that we will process.
 * These are the first part of a Tailwind class before the color.
 */
const PREFIXES = [
  'bg', 'text', 'border', 'ring', 'outline', 'divide', 'placeholder',
  'accent', 'shadow', 'fill', 'stroke', 'decoration', 'caret',
];

/**
 * Variant prefixes that may appear before the utility (including dark mode).
 * These are separated by a colon.
 */
const VARIANT_PREFIXES = [
  'dark', 'light', 'hover', 'focus', 'active', 'disabled', 'checked',
  'first', 'last', 'odd', 'even', 'group-hover', 'group-focus',
  'sm', 'md', 'lg', 'xl', '2xl', 'max-sm', 'max-md', 'max-lg', 'max-xl', 'max-2xl',
];

// ----------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------

/**
 * Check if a line contains dynamic class construction (template literals, concatenation).
 * We skip such lines because we cannot safely replace them.
 */
function isDynamicClass(line: string): boolean {
  return line.includes('${') || line.includes('+') || line.includes('`');
}

/**
 * Build a regex that matches a full Tailwind color utility class.
 * 
 * Captures:
 *  1. Full variant prefix (including colons) – group 1
 *  2. Utility prefix (e.g., 'bg') – group 2
 *  3. Color part (e.g., 'blue-500', 'green-300/50') – group 3
 * 
 * The regex is case‑insensitive and matches across word boundaries.
 */
function buildClassRegex(): RegExp {
  // Pattern for variant prefixes (optional, repeat with colon)
  const variantWithColons = VARIANT_PREFIXES.map(v => v + ':').join('|');
  const variantPattern = `((?:${variantWithColons})*)`;
  // Pattern for utility prefix
  const prefixPattern = `(${PREFIXES.join('|')})`;
  // Pattern for color (matches any of the mapped families plus a shade, optionally with opacity)
  const colorFamilies = COLOR_MAPPINGS.map(m => m.pattern.source).join('|');
  const colorPattern = `(${colorFamilies})(?:\\/(\\d+))?`;
  // Combine with word boundaries
  return new RegExp(`\\b${variantPattern}${prefixPattern}-${colorPattern}\\b`, 'gi');
}

/**
 * Given a matched Tailwind class, compute its replacement.
 * 
 * @param variant - The variant prefix (including trailing colon) or empty string.
 * @param prefix - The utility prefix (e.g., 'bg').
 * @param color - The full color part (e.g., 'blue-500').
 * @param opacity - The opacity suffix without slash (e.g., '30') or undefined.
 * @returns The replacement class, or null if no mapping applies.
 */
function getReplacementClass(
  variant: string,
  prefix: string,
  color: string,
  opacity?: string
): string | null {
  // Find mapping that matches this color
  const mapping = COLOR_MAPPINGS.find(m => m.pattern.test(color.toLowerCase()));
  if (!mapping) {
    return null;
  }

  // For CSS variables, we drop the dark: prefix because the variable is theme‑aware.
  let cleanVariant = variant;
  if (mapping.isCssVariable && variant.includes('dark:')) {
    // Remove all dark: prefixes (could be multiple, but we just strip them)
    cleanVariant = variant.replace(/dark:/g, '');
    // Also remove any resulting leading/trailing colons or double colons
    cleanVariant = cleanVariant.replace(/^:+|:+$/g, '').replace(/::+/g, ':');
    // If variant becomes empty, set to empty string
    if (cleanVariant === ':') cleanVariant = '';
  }

  // If mapping is a CSS variable, wrap in square brackets with var()
  if (mapping.isCssVariable) {
    // For opacity suffixes, we need to use color‑mix
    if (opacity) {
      // Use color‑mix(in_srgb, var(--token)_opacity%, transparent)
      return `${cleanVariant}${prefix}-[color-mix(in_srgb,var(${mapping.token})_${opacity}%,transparent)]`;
    } else {
      return `${cleanVariant}${prefix}-[var(${mapping.token})]`;
    }
  } else {
    // Simple token replacement (e.g., data‑pass). Keep opacity if present.
    const opacitySuffix = opacity ? `/${opacity}` : '';
    return `${cleanVariant}${prefix}-${mapping.token}${opacitySuffix}`;
  }
}

/**
 * Process a single line of source code, replacing all matching Tailwind classes.
 * Returns the modified line and a count of replacements made.
 */
function processLine(line: string): { line: string; count: number } {
  if (isDynamicClass(line)) {
    return { line, count: 0 };
  }

  const classRegex = buildClassRegex();
  let count = 0;
  const newLine = line.replace(classRegex, (match, variant, prefix, color, opacity) => {
    // variant may be undefined if no variant prefix matched
    const variantStr = variant || '';
    const replacement = getReplacementClass(variantStr, prefix, color, opacity);
    if (replacement) {
      count++;
      return replacement;
    }
    return match;
  });

  return { line: newLine, count };
}

/**
 * Process a single file, optionally writing changes.
 */
async function processFile(filePath: string, dryRun: boolean): Promise<{ changed: boolean; replacements: number }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  let totalReplacements = 0;
  const processedLines = lines.map(line => {
    const { line: newLine, count } = processLine(line);
    totalReplacements += count;
    return newLine;
  });

  if (totalReplacements === 0) {
    return { changed: false, replacements: 0 };
  }

  const newContent = processedLines.join('\n');

  if (dryRun) {
    console.log(`📄 ${filePath} (dry run): ${totalReplacements} replacement(s)`);
    return { changed: true, replacements: totalReplacements };
  } else {
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`✅ ${filePath}: ${totalReplacements} replacement(s) applied`);
    return { changed: true, replacements: totalReplacements };
  }
}

// ----------------------------------------------------------------------
// File Discovery
// ----------------------------------------------------------------------

/**
 * Recursively find all source files with the given extensions.
 */
async function findFiles(
  dir: string,
  extensions: string[],
  ignorePatterns: RegExp[] = []
): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    // Skip ignored directories
    if (ignorePatterns.some(pattern => pattern.test(relativePath))) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await findFiles(fullPath, extensions, ignorePatterns);
      results.push(...subFiles);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Get all relevant source files in the project.
 */
async function getSourceFiles(): Promise<string[]> {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  const ignorePatterns = [
    /node_modules/,
    /dist/,
    /build/,
    /\.next/,
    /\.git/,
    /coverage/,
    /__tests__/,
    /\.spec\./,
    /\.test\./,
  ];

  const rootDirs = [
    'components',
    'pages',
    'lib',
    'hooks',
    'src',
    'routes',
    'services',
    'utils',
  ];

  let allFiles: string[] = [];
  for (const dir of rootDirs) {
    if (await fs.access(dir).then(() => true).catch(() => false)) {
      const files = await findFiles(dir, extensions, ignorePatterns);
      allFiles.push(...files);
    }
  }

  return allFiles;
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const help = args.includes('--help') || args.includes('-h');
  const fileIndex = args.indexOf('--file');
  const specifiedFiles = fileIndex !== -1 ? [args[fileIndex + 1]].filter(Boolean) : [];

  if (help || (!dryRun && !apply)) {
    console.log(`
Usage: npx tsx scripts/tailwind-migration.ts [options]

Options:
  --dry-run    Show what would be changed without writing files.
  --apply      Actually apply the replacements.
  --file <path> Process only the specified file (for testing).
  --help       Show this message.

This script scans all .tsx, .ts, .jsx, .js files in the project (excluding node_modules)
and replaces unauthorized Tailwind color classes with semantic design tokens.
    `);
    process.exit(0);
  }

  console.log('🔍 Scanning for files...');

  const files = specifiedFiles.length > 0 ? specifiedFiles : await getSourceFiles();
  console.log(`📁 Found ${files.length} file(s) to process.`);

  let totalFilesChanged = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const { changed, replacements } = await processFile(file, dryRun);
    if (changed) {
      totalFilesChanged++;
      totalReplacements += replacements;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (dryRun) {
    console.log(`🎯 Dry run complete.`);
    console.log(`   ${totalReplacements} replacement(s) would be made across ${totalFilesChanged} file(s).`);
    console.log(`   Run with --apply to write changes.`);
  } else {
    console.log(`🎉 Migration complete!`);
    console.log(`   ${totalReplacements} replacement(s) applied across ${totalFilesChanged} file(s).`);
  }
  console.log('='.repeat(50));
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});