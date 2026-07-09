/**
 * DOC-001/DOC-002 guard — prevents FSRS docs from reintroducing the stock
 * `ts-fsrs` 4-button / explicit self-rating workflow. PANaCEa's rating model is
 * behaviorally derived (implicit); no student-facing Again/Hard/Good/Easy buttons.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = join(__dirname, '..', 'docs');

// Unambiguous stock-ts-fsrs / explicit-rating patterns that must not appear as
// build guidance in FSRS docs.
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  { re: /import\s*\{[^}]*\}\s*from\s*['"]@open-spaced-repetition\/ts-fsrs['"]/, why: 'importing stock ts-fsrs in a code example (use @/lib/fsrs)' },
  { re: /scheduling\[\s*Rating\./, why: 'stock ts-fsrs scheduling[Rating.X] explicit-rating access' },
  { re: /User selected ["']/, why: 'implies an explicit student rating choice' },
  { re: /\bf\.repeat\(/, why: 'stock ts-fsrs f.repeat() workflow' },
];

function fsrsDocs(): string[] {
  if (!existsSync(DOCS_DIR)) return [];
  return readdirSync(DOCS_DIR)
    .filter((f) => /^FSRS_.*\.md$/i.test(f))
    .map((f) => join(DOCS_DIR, f));
}

describe('FSRS documentation guard (DOC-001/DOC-002)', () => {
  it('finds FSRS docs to scan', () => {
    expect(fsrsDocs().length).toBeGreaterThan(0);
  });

  it('no FSRS doc reintroduces stock ts-fsrs / explicit-rating examples', () => {
    const offenders: string[] = [];
    for (const file of fsrsDocs()) {
      const src = readFileSync(file, 'utf8');
      for (const { re, why } of FORBIDDEN) {
        const m = src.match(re);
        if (m) offenders.push(`${file.split('/docs/')[1]}: "${m[0]}" — ${why}`);
      }
    }
    expect(offenders, `Stale FSRS doc patterns found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the quick reference asserts the implicit / no-buttons model', () => {
    const qr = join(DOCS_DIR, 'FSRS_V6_QUICK_REFERENCE.md');
    // Normalize markdown blockquote wrapping ("\n> ") + whitespace to spaces.
    const src = readFileSync(qr, 'utf8').toLowerCase().replace(/[>\s]+/g, ' ');
    expect(src).toContain('self-rating buttons');
    expect(src).toContain('no student-facing');
    expect(src).toMatch(/behaviorally derived|behaviorally-derived|implicit/);
  });
});
