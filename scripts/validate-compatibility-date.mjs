#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const wranglerToml = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const ciWorkflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');

const wranglerMatch = wranglerToml.match(/^\s*compatibility_date\s*=\s*"([^"]+)"/m);
const ciMatch = ciWorkflow.match(/--compatibility-date=([0-9-]+)/m);

if (!wranglerMatch || !ciMatch) {
  console.error('Unable to parse compatibility date from wrangler.toml or .github/workflows/ci.yml');
  process.exit(1);
}

const wranglerDate = wranglerMatch[1];
const ciDate = ciMatch[1];

if (wranglerDate !== ciDate) {
  console.error(
    `Compatibility date drift detected: wrangler.toml=${wranglerDate}, ci.yml=${ciDate}`
  );
  process.exit(1);
}

console.log(`Compatibility date parity OK (${wranglerDate})`);
