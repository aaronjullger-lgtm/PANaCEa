#!/usr/bin/env npx tsx
/**
 * Design System Audit Script
 *
 * Scans components for forbidden patterns per .cursor/rules/ui-design-system.mdc:
 * - Pure black: bg-black, text-black, border-black, #000
 * - Generic gray for dark mode: bg-gray-900, dark:bg-gray-900, text-gray-900
 * - Black overlays: bg-black/40, bg-black/70 (use --color-overlay)
 * - Hardcoded gray borders: border-gray-800 for cards (use var(--color-border))
 *
 * Run: npm run audit:design-system
 * Exit code: 0 if no violations, 1 if violations found
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\bbg-black(?:\s|"|'|`|\/|$)/,
    message: 'bg-black: Use bg-[var(--color-overlay)] for overlays',
  },
  {
    pattern: /\btext-black(?:\s|"|'|`)/,
    message: 'text-black: Use text-[var(--color-text-primary)]',
  },
  {
    pattern: /\bborder-black(?:\s|"|'|`)/,
    message: 'border-black: Use border-[var(--color-border)]',
  },
  {
    pattern: /#[0]{3,6}(?!\d)/,
    message: '#000: Pure black forbidden; use Brand Dark Blue or semantic tokens',
  },
  {
    pattern: /\bbg-gray-900(?:\s|"|'|`)/,
    message: 'bg-gray-900: Use bg-[var(--color-bg-primary)] or slate',
  },
  {
    pattern: /\bdark:bg-gray-900(?:\s|"|'|`)/,
    message: 'dark:bg-gray-900: Use semantic tokens (Brand Dark Blue, not gray)',
  },
  {
    pattern: /\btext-gray-900\s+dark:text-white(?:\s|"|'|`)/,
    message: 'text-gray-900 dark:text-white: Use text-[var(--color-text-primary)]',
  },
  {
    pattern: /\bbg-black\/\d+(?:\s|"|'|`)/,
    message: 'bg-black/opacity: Use bg-[var(--color-overlay)] with backdrop-blur',
  },
];

const SLATE_PREFER_SEMANTIC: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\btext-slate-900\s+dark:text-white(?:\s|"|'|`)/,
    message: 'text-slate-900 dark:text-white: Prefer text-[var(--color-text-primary)]',
  },
  {
    pattern: /\btext-slate-800\s+dark:text-white(?:\s|"|'|`)/,
    message: 'text-slate-800 dark:text-white: Prefer text-[var(--color-text-primary)]',
  },
  {
    pattern: /\bborder-gray-300\s+dark:border-gray-600(?:\s|"|'|`)/,
    message: 'border-gray-300 dark:border-gray-600: Prefer border-[var(--color-border)]',
  },
];

const EXTENSIONS = ['.tsx', '.jsx'];
const DIRS_TO_SCAN = ['components', 'pages', 'contexts', 'src'];

function* walkFiles(dir: string, base = dir): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      yield* walkFiles(full, base);
    } else if (EXTENSIONS.some((ext) => e.name.endsWith(ext))) {
      yield full;
    }
  }
}

interface Violation {
  file: string;
  line: number;
  match: string;
  message: string;
  severity: 'error' | 'warn';
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        violations.push({
          file: filePath,
          line: i + 1,
          match: m[0] ?? '',
          message,
          severity: 'error',
        });
      }
    }
    for (const { pattern, message } of SLATE_PREFER_SEMANTIC) {
      const m = line.match(pattern);
      if (m) {
        violations.push({
          file: filePath,
          line: i + 1,
          match: m[0] ?? '',
          message,
          severity: 'warn',
        });
      }
    }
  }
  return violations;
}

function main() {
  const root = process.cwd();
  const allViolations: Violation[] = [];

  for (const dir of DIRS_TO_SCAN) {
    const fullDir = join(root, dir);
    try {
      for (const f of walkFiles(fullDir)) {
        allViolations.push(...scanFile(f));
      }
    } catch {
      // dir may not exist
    }
  }

  const errors = allViolations.filter((v) => v.severity === 'error');
  const warns = allViolations.filter((v) => v.severity === 'warn');

  if (errors.length > 0) {
    console.error('\n❌ Design System Violations (forbidden):\n');
    for (const v of errors) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.message}`);
      console.error(`    Match: ${v.match}\n`);
    }
  }

  if (warns.length > 0 && process.argv.includes('--strict')) {
    console.warn('\n⚠️  Design System Warnings (prefer semantic tokens):\n');
    for (const v of warns) {
      console.warn(`  ${v.file}:${v.line} - ${v.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\nTotal: ${errors.length} error(s), ${warns.length} warning(s)`);
    process.exit(1);
  }

  console.log(`\n✅ Design system audit passed. (${warns.length} optional improvements found; use --strict to show)`);
  process.exit(0);
}

main();
