#!/usr/bin/env node
/**
 * scripts/help-scripts.mjs — navigability helper for the 160+ npm scripts.
 *
 * Groups package.json scripts by their first `:` segment (or "other") and
 * prints `name → command`. Optional substring filter narrows the output.
 *
 * Usage:
 *   npm run scripts:list                 # everything, grouped
 *   npm run scripts:list -- audit        # only scripts matching "audit"
 *   npm run scripts:list -- sched        # only scripts matching "sched"
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const scripts = pkg.scripts ?? {};

const filter = process.argv[2]?.toLowerCase() ?? '';

const names = Object.keys(scripts)
  .filter((name) => !filter || name.toLowerCase().includes(filter))
  .sort();

if (names.length === 0) {
  console.log(filter ? `No scripts match "${filter}".` : 'No scripts found.');
  process.exit(0);
}

const groups = new Map();
for (const name of names) {
  const group = name.includes(':') ? name.slice(0, name.indexOf(':')) : 'other';
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(name);
}

console.log(`PANaCEa npm scripts (${names.length} shown${filter ? `, filter "${filter}"` : ''}):\n`);
for (const [group, groupNames] of [...groups.entries()].sort()) {
  console.log(`\x1b[1m${group}\x1b[0m`);
  for (const name of groupNames) {
    console.log(`  npm run ${name.padEnd(42)} ${scripts[name]}`);
  }
  console.log('');
}
