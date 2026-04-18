#!/usr/bin/env node
/**
 * Endpoint Auth Coverage Auditor
 *
 * Scans every `*.ts` file in `functions/api/` (excluding `_shared/` and tests)
 * and classifies its onRequest* handlers by:
 *   - which canonical wrapper they use (authenticatedEndpoint, publicEndpoint, etc.)
 *   - whether they use raw `withAuth` / `authenticateRequest`
 *   - whether they have no auth layer at all
 *
 * The goal: 100% auth coverage on protected routes. Runs in CI so regressions
 * are caught before merge.
 *
 * Usage:
 *   node scripts/audit-endpoint-auth.mjs                   # human summary
 *   node scripts/audit-endpoint-auth.mjs --json            # machine-readable
 *   node scripts/audit-endpoint-auth.mjs --fail-on-misses  # exit 1 on gaps
 *
 * Exit codes:
 *   0 — all protected endpoints covered (or summary mode)
 *   1 — at least one protected endpoint is missing an auth layer
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API_ROOT = join(ROOT, 'functions', 'api');

const CANONICAL_WRAPPERS = [
  'authenticatedEndpoint',
  'adminAuthenticatedEndpoint',
  'adminEndpoint',
  'aiEndpoint',
  'aiStreamingEndpoint',
  'publicEndpoint',
  'cmsEndpoint',
  'refineryEndpoint',
  'cronEndpoint',
  'withEndpoint',
];
const RAW_AUTH_HELPERS = ['withAuth', 'authenticateRequest', 'requireAuth', 'verifyAuthToken'];
const RE_EXPORT_RE = /^\s*export\s*\{[^}]+\}\s*from\s*['"]/m;
const ONREQUEST_RE = /\bonRequest(?:Get|Post|Put|Patch|Delete|Head|Options)\b/g;
const CRON_PATH_RE = /(^|\/)cron(\/|$)/;
const WEBHOOK_PATH_RE = /(^|\/)(clerk|stripe)-webhooks?(\/|$)|(^|\/)webhook(s)?(\/|$)/;

// Files whose public exposure is intentional (e.g. Sentry tunnel proxy). These
// implement their own inline rate limiting / security controls and don't fit
// the standard wrapper pattern. Must be maintained by hand.
const KNOWN_PUBLIC_ALLOWLIST = new Set([
  'functions/api/sentry-tunnel.ts',
]);

// ─── Walker ──────────────────────────────────────────────────────────────────

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '_shared') continue;
      yield* walk(p);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      yield p;
    }
  }
}

// ─── Classifier ──────────────────────────────────────────────────────────────

function classify(filePath, source) {
  const relPath = relative(ROOT, filePath).split(sep).join('/');

  // onRequest* detection
  const exports = new Set();
  for (const match of source.matchAll(ONREQUEST_RE)) {
    exports.add(match[0]);
  }

  // Also capture re-exports like `export { onRequestGet } from './list'`
  const reExportMatch = source.match(
    /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"][^'"]+['"]/
  );
  if (reExportMatch) {
    for (const part of reExportMatch[1].split(',')) {
      const name = part.trim().split(/\s+/)[0];
      if (name?.startsWith('onRequest')) exports.add(name);
    }
  }

  // Detect wrappers
  const wrappers = [];
  for (const w of CANONICAL_WRAPPERS) {
    const re = new RegExp(`\\b${w}\\s*\\(`, 'g');
    if (re.test(source)) wrappers.push(w);
  }

  const rawAuth = [];
  for (const w of RAW_AUTH_HELPERS) {
    const re = new RegExp(`\\b${w}\\s*\\(`, 'g');
    if (re.test(source)) rawAuth.push(w);
  }

  // Pure re-export file: contains `export { onRequestX } from './target'` and
  // has no local handler bodies of its own. The real auth layer lives on the
  // re-export target, so these are never misses on their own.
  const reExportsOnRequest =
    /export\s*\{[^}]*\bonRequest(Get|Post|Put|Patch|Delete|Head|Options)\b[^}]*\}\s*from\s*['"][^'"]+['"]/.test(
      source
    );
  const hasLocalHandler =
    /\b(const|let|var|function)\s+onRequest(?:Get|Post|Put|Patch|Delete|Head|Options)\b/.test(
      source
    ) ||
    /\bexport\s+(?:const|async\s+function|function)\s+onRequest(?:Get|Post|Put|Patch|Delete|Head|Options)\b/.test(
      source
    );
  const isReExport = reExportsOnRequest && !hasLocalHandler;

  const isCron = CRON_PATH_RE.test(relPath);
  const isWebhook = WEBHOOK_PATH_RE.test(relPath);
  const isKnownPublic = KNOWN_PUBLIC_ALLOWLIST.has(relPath);

  // Stub detection: only returns 4xx/5xx with no auth.
  const isStub =
    exports.size > 0 &&
    wrappers.length === 0 &&
    rawAuth.length === 0 &&
    /status:\s*(404|503|410)/.test(source);

  let category = 'UNKNOWN';
  let needsAuth = true;

  if (isReExport) {
    // Pure re-export: auth lives on the target file.
    category = 'RE_EXPORT';
    needsAuth = false;
  } else if (isKnownPublic) {
    category = 'PUBLIC_ALLOWLISTED';
    needsAuth = false;
  } else if (isCron) {
    category = 'CRON';
    needsAuth = true; // CRON_SECRET (or authed user) required
  } else if (isWebhook) {
    category = 'WEBHOOK';
    needsAuth = true; // signature verification
  } else if (wrappers.includes('publicEndpoint')) {
    category = 'PUBLIC';
    needsAuth = false;
  } else if (isStub) {
    category = 'STUB';
    needsAuth = false;
  } else if (wrappers.length > 0) {
    category = 'PROTECTED';
    needsAuth = true;
  } else if (rawAuth.length > 0) {
    category = 'PROTECTED_RAW';
    needsAuth = true;
  } else if (exports.size > 0) {
    category = 'UNPROTECTED';
    needsAuth = true;
  } else {
    category = 'RE_EXPORT';
    needsAuth = false;
  }

  // Coverage pass/fail
  let covered = true;
  const issues = [];

  if (category === 'UNPROTECTED') {
    covered = false;
    issues.push('no auth wrapper and no raw auth helper');
  }
  if (category === 'CRON') {
    // Preferred: cronEndpoint() wrapper OR inline CRON_SECRET check.
    // Acceptable fallback: authenticatedEndpoint (stricter; requires Clerk
    // user token). Only an unprotected cron is a miss.
    const hasCronWrapper = wrappers.includes('cronEndpoint');
    const hasInlineCheck = /CRON_SECRET/.test(source);
    const hasAuthedFallback = wrappers.some((w) =>
      [
        'authenticatedEndpoint',
        'adminAuthenticatedEndpoint',
        'adminEndpoint',
      ].includes(w)
    );
    if (!hasCronWrapper && !hasInlineCheck && !hasAuthedFallback) {
      covered = false;
      issues.push('cron endpoint has no CRON_SECRET verification');
    } else if (!hasCronWrapper && !hasInlineCheck && hasAuthedFallback) {
      issues.push(
        'cron uses authenticatedEndpoint (works, but prefer cronEndpoint for scheduled triggers)'
      );
    }
  }
  if (category === 'WEBHOOK') {
    const hasSigVerify =
      /verifyWebhook|svix|verifyClerkWebhook|WEBHOOK_SECRET|signature/.test(source);
    if (!hasSigVerify) {
      covered = false;
      issues.push('webhook handler has no signature verification');
    }
  }
  if (category === 'PROTECTED_RAW') {
    issues.push('uses raw auth — migrate to canonical wrapper');
  }

  return {
    file: relPath,
    category,
    needsAuth,
    covered,
    wrappers,
    rawAuth,
    exports: [...exports],
    issues,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const failOnMisses = args.includes('--fail-on-misses');

  const results = [];
  for await (const f of walk(API_ROOT)) {
    const src = await readFile(f, 'utf8');
    results.push(classify(f, src));
  }

  // Summaries
  const byCategory = {};
  for (const r of results) {
    byCategory[r.category] ??= [];
    byCategory[r.category].push(r);
  }

  const misses = results.filter((r) => !r.covered);
  const rawAuthUsers = results.filter((r) => r.category === 'PROTECTED_RAW');

  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: results.length,
          byCategory: Object.fromEntries(
            Object.entries(byCategory).map(([k, v]) => [k, v.length])
          ),
          misses,
          rawAuthUsers,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    const order = [
      'PROTECTED',
      'PROTECTED_RAW',
      'PUBLIC',
      'CRON',
      'WEBHOOK',
      'STUB',
      'RE_EXPORT',
      'UNPROTECTED',
      'UNKNOWN',
    ];
    console.log(`PANaCEa endpoint auth coverage — scanned ${results.length} files\n`);
    for (const cat of order) {
      if (!byCategory[cat]) continue;
      console.log(`  ${cat.padEnd(16)} ${String(byCategory[cat].length).padStart(4)}`);
    }

    if (misses.length > 0) {
      console.log(`\n✗ ${misses.length} endpoint(s) missing auth coverage:\n`);
      for (const m of misses) {
        console.log(`  ${m.file}`);
        for (const issue of m.issues) console.log(`    — ${issue}`);
      }
    } else {
      console.log('\n✓ All protected endpoints have auth coverage.');
    }

    if (rawAuthUsers.length > 0) {
      console.log(
        `\n⚠ ${rawAuthUsers.length} endpoint(s) use raw auth helpers — migrate to canonical wrappers:\n`
      );
      for (const r of rawAuthUsers) {
        console.log(`  ${r.file} (${r.rawAuth.join(', ')})`);
      }
    }
  }

  if (failOnMisses && misses.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
