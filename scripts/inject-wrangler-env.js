#!/usr/bin/env node
/**
 * Injects [vars] from wrangler.toml into .env.production.local so Vite production
 * builds use production keys when Cloudflare Dashboard build env vars are not set.
 *
 * Run before `vite build` so loadEnv() picks up .env.production.local.
 * Cloudflare Pages: set VITE_* in Dashboard → Environment variables (Build) to override.
 *
 * Usage: node scripts/inject-wrangler-env.js
 * (writes .env.production.local; safe to run, only writes VITE_* and non-secret vars from [vars])
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_PATH = path.join(__dirname, '..', 'wrangler.toml');
const OUT_PATH = path.join(__dirname, '..', '.env.production.local');

function extractVarsFromWrangler(content) {
  const vars = {};
  const varsMatch = content.match(/\[vars\]\s*([\s\S]*?)(?=\n\s*\[|\n# CRITICAL|$)/);
  if (!varsMatch) return vars;
  const block = varsMatch[1];
  const lineRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"\s*(?:#.*)?$/gm;
  let m;
  while ((m = lineRe.exec(block)) !== null) {
    vars[m[1]] = m[2];
  }
  return vars;
}

function main() {
  if (!fs.existsSync(WRANGLER_PATH)) {
    console.warn('[inject-wrangler-env] wrangler.toml not found, skipping.');
    return;
  }
  const content = fs.readFileSync(WRANGLER_PATH, 'utf8');
  const vars = extractVarsFromWrangler(content);
  const viteKeys = Object.keys(vars).filter((k) => k.startsWith('VITE_'));
  if (viteKeys.length === 0) {
    console.warn('[inject-wrangler-env] No VITE_* keys in [vars], skipping write.');
    return;
  }
  // Prefer process.env (Cloudflare Dashboard build env) over wrangler.toml
  const entries = viteKeys.map((k) => [k, process.env[k] !== undefined ? process.env[k] : vars[k]]);
  const lines = [
    '# Auto-generated: process.env (Cloudflare build env) over wrangler.toml [vars]',
    '# Do not commit if it contains secrets.',
    '',
    ...entries.map(([k, v]) => `${k}=${v}`),
  ];
  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('[inject-wrangler-env] Wrote', OUT_PATH, 'with', entries.length, 'VITE_* vars (process.env + wrangler.toml)');
}

main();
