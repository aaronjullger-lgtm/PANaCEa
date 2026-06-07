#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const wranglerToml = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const ciWorkflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');

const wranglerMatch = wranglerToml.match(/^\s*compatibility_date\s*=\s*"([^"]+)"/m);
const ciMatch = ciWorkflow.match(/--compatibility-date=(\d{4}-\d{2}-\d{2})/m);

if (!wranglerMatch || !ciMatch) {
  console.error('Unable to parse compatibility date from wrangler.toml or .github/workflows/ci.yml');
  process.exit(1);
}

const wranglerDate = wranglerMatch[1];
const ciDate = ciMatch[1];

function isValidDateString(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  // Round-trip guard: Date() normalizes invalid calendar dates (e.g., 2024-02-30 -> 2024-03-01),
  // so we parse then compare back to the original date string.
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

if (!isValidDateString(wranglerDate) || !isValidDateString(ciDate)) {
  console.error(
    `Invalid compatibility date format detected: wrangler.toml=${wranglerDate}, ci.yml=${ciDate}`
  );
  process.exit(1);
}

if (wranglerDate !== ciDate) {
  console.error(
    `Compatibility date drift detected: wrangler.toml=${wranglerDate}, ci.yml=${ciDate}`
  );
  process.exit(1);
}

console.log(`Compatibility date parity OK (${wranglerDate})`);
