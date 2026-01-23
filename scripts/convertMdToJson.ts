import fs from 'fs';
import path from 'path';

import { SECTION_BREAK_TOKEN } from '../src/lib/markdown.ts';

const INPUT_JSON = path.resolve('src/conditionContent.generated.json');
const OUTPUT_JSON = INPUT_JSON;

export function asciiClean(str: string = ''): string {
  return (
    str
      .normalize('NFKC')
      .replace(/[“”„‟]/g, '"')
      .replace(/[''‚‛]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\u00A0/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, '')
  );
}

function normalizeWhitespace(value: string): string {
  const unixNewlines = value.replace(/\r\n/g, '\n');
  const lines = unixNewlines.split('\n');
  const cleaned = lines.map((line) =>
    asciiClean(line)
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+$/g, '')
  );
  return cleaned.join('\n');
}

export function normalizeSeparators(value: string): string {
  const lines = value.split(/\r?\n/);
  const processed = lines.map((line) => {
    if (/^\s*\*{3}\s*$/.test(line)) {
      return SECTION_BREAK_TOKEN;
    }
    const trailing = line.match(/^(.*?\S)\s*\*{3}\s*$/);
    if (trailing && !/\*{3}.+\*{3}/.test(trailing[1])) {
      return `${trailing[1]}\n${SECTION_BREAK_TOKEN}`;
    }
    return line;
  });
  return processed.join('\n');
}

export function cleanMultilineString(value: string): string {
  const withWhitespace = normalizeWhitespace(value);
  return normalizeSeparators(withWhitespace);
}

function cleanValue(value: any): any {
  if (typeof value === 'string') {
    return cleanMultilineString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cleanValue(entry));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = cleanValue(v);
    }
    return next;
  }
  return value;
}

export function run() {
  if (!fs.existsSync(INPUT_JSON)) {
    console.error('Missing input JSON', INPUT_JSON);
    process.exit(1);
  }
  const raw = fs.readFileSync(INPUT_JSON, 'utf8');
  const parsed = JSON.parse(raw);
  const cleaned = cleanValue(parsed);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(cleaned, null, 2));
  console.log(`Updated ${OUTPUT_JSON} with cleaned markdown separators.`);
}
const executedDirectly =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  process.argv[1]?.endsWith('convertMdToJson.ts');

if (executedDirectly) {
  run();
}
