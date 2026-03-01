#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';

// Copy the relevant functions from tailwind-migration.ts
const COLOR_MAPPINGS = [
  { pattern: /blue-\d+/, token: '--color-category-practice', isCssVariable: true },
  { pattern: /green-\d+/, token: 'data-pass' },
  { pattern: /emerald-\d+/, token: 'data-pass' },
  { pattern: /red-\d+/, token: 'data-fail' },
  { pattern: /amber-\d+/, token: 'data-provisional' },
  { pattern: /slate-\d+/, token: 'data-neutral' },
  { pattern: /gray-\d+/, token: '--color-text-muted', isCssVariable: true },
  { pattern: /zinc-\d+/, token: '--color-border', isCssVariable: true },
  { pattern: /neutral-\d+/, token: '--color-bg-secondary', isCssVariable: true },
  { pattern: /stone-\d+/, token: '--color-bg-tertiary', isCssVariable: true },
];

const PREFIXES = [
  'bg', 'text', 'border', 'ring', 'outline', 'divide', 'placeholder',
  'accent', 'shadow', 'fill', 'stroke', 'decoration', 'caret',
];

const VARIANT_PREFIXES = [
  'dark', 'light', 'hover', 'focus', 'active', 'disabled', 'checked',
  'first', 'last', 'odd', 'even', 'group-hover', 'group-focus',
  'sm', 'md', 'lg', 'xl', '2xl', 'max-sm', 'max-md', 'max-lg', 'max-xl', 'max-2xl',
];

function buildClassRegex(): RegExp {
  const variantPattern = `((?:${VARIANT_PREFIXES.join('|')}:)+)?`;
  const prefixPattern = `(${PREFIXES.join('|')})`;
  const colorFamilies = COLOR_MAPPINGS.map(m => m.pattern.source.replace('\\', '')).join('|');
  const colorPattern = `(${colorFamilies})(?:\\/(\\d+))?`;
  return new RegExp(`\\b${variantPattern}${prefixPattern}-${colorPattern}\\b`, 'gi');
}

function isDynamicClass(line: string): boolean {
  return line.includes('${') || line.includes('+') || line.includes('`');
}

function getReplacementClass(variant: string, prefix: string, color: string, opacity?: string): string | null {
  const mapping = COLOR_MAPPINGS.find(m => m.pattern.test(color.toLowerCase()));
  if (!mapping) return null;

  let cleanVariant = variant;
  if (mapping.isCssVariable && variant.includes('dark:')) {
    cleanVariant = variant.replace(/dark:/g, '');
    cleanVariant = cleanVariant.replace(/^:+|:+$/g, '').replace(/::+/g, ':');
    if (cleanVariant === ':') cleanVariant = '';
  }

  if (mapping.isCssVariable) {
    if (opacity) {
      return `${cleanVariant}${prefix}-[color-mix(in_srgb,var(${mapping.token})_${opacity}%,transparent)]`;
    } else {
      return `${cleanVariant}${prefix}-[var(${mapping.token})]`;
    }
  } else {
    const opacitySuffix = opacity ? `/${opacity}` : '';
    return `${cleanVariant}${prefix}-${mapping.token}${opacitySuffix}`;
  }
}

function processLine(line: string): { line: string; count: number } {
  if (isDynamicClass(line)) {
    return { line, count: 0 };
  }

  const classRegex = buildClassRegex();
  let count = 0;
  const newLine = line.replace(classRegex, (match, variant, prefix, color, opacity) => {
    const variantStr = variant || '';
    const replacement = getReplacementClass(variantStr, prefix, color, opacity);
    if (replacement) {
      console.log(`  Matched: ${match} -> ${replacement}`);
      count++;
      return replacement;
    }
    return match;
  });

  return { line: newLine, count };
}

async function testFile(filePath: string) {
  console.log(`Testing ${filePath}`);
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const { line: newLine, count } = processLine(line);
    if (count > 0) {
      console.log(`Line ${idx + 1}: ${line}`);
      console.log(`       -> ${newLine}`);
    }
  });
}

const file = process.argv[2];
if (!file) {
  console.error('Please provide a file path');
  process.exit(1);
}

testFile(file).catch(console.error);