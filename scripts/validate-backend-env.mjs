#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
const wrangler = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');

const requiredSecrets = [
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'CLERK_SECRET_KEY',
  'GEMINI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_AUTH_TOKEN',
  'CRON_SECRET',
];
const requiredBindings = ['RATE_LIMIT_KV', 'CACHE'];

const missingDocs = requiredSecrets.filter((key) => !new RegExp(`^${key}=`, 'm').test(envExample));
const missingBindings = requiredBindings.filter(
  (binding) => !new RegExp(`binding\\s*=\\s*["']${binding}["']`).test(wrangler)
);
const hasPreviewEnv = /^\[env\.preview\]/m.test(wrangler);
const missingPreviewBindings = requiredBindings.filter(
  (binding) =>
    !new RegExp(`\\[\\[env\\.preview\\.kv_namespaces\\]\\][\\s\\S]*?binding\\s*=\\s*["']${binding}["']`).test(wrangler)
);
const previewPlaceholders = [...wrangler.matchAll(/id\s*=\s*["'](REPLACE_WITH_[^"']+)["']/g)].map(
  (match) => match[1]
);

const runtimeStrict = process.argv.includes('--runtime');
const missingRuntime = runtimeStrict
  ? requiredSecrets.filter((key) => !process.env[key] || String(process.env[key]).trim() === '')
  : [];

if (missingDocs.length || missingBindings.length || missingRuntime.length || !hasPreviewEnv || missingPreviewBindings.length) {
  if (missingDocs.length) {
    console.error(`Missing required keys in .env.example: ${missingDocs.join(', ')}`);
  }
  if (missingBindings.length) {
    console.error(`Missing required Cloudflare bindings in wrangler.toml: ${missingBindings.join(', ')}`);
  }
  if (missingRuntime.length) {
    console.error(`Missing required runtime environment variables: ${missingRuntime.join(', ')}`);
  }
  if (!hasPreviewEnv) {
    console.error('Missing [env.preview] block in wrangler.toml');
  }
  if (missingPreviewBindings.length) {
    console.error(`Missing Preview Cloudflare bindings in wrangler.toml: ${missingPreviewBindings.join(', ')}`);
  }
  process.exit(1);
}

if (previewPlaceholders.length) {
  console.warn(
    `Preview environment placeholders still need operator wiring: ${previewPlaceholders.join(', ')}`
  );
}

console.log('Backend environment contract OK');
