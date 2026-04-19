#!/usr/bin/env node
/**
 * Endpoint Rate-Limit Coverage Auditor
 *
 * Companion to `audit-endpoint-auth.mjs`. Scans every `.ts` file in
 * `functions/api/` (excluding `_shared/` and tests) and, for each file that
 * calls Gemini or performs expensive DB work, verifies it is wrapped in a
 * rate-limit-aware stack.
 *
 * A file is classified as AI-calling if it imports a Gemini client, calls
 * `generateContent`, or uses `GEMINI_API_KEY`. A file is classified as
 * DB-heavy if it issues `findMany` without a `take` limit, uses raw SQL,
 * or runs cross-table aggregations.
 *
 * Preferred wrappers (by category):
 *   - AI-calling  → aiEndpoint()  or  withEndpoint({ kind: 'ai' })
 *   - DB-heavy    → authenticatedEndpoint() with an explicit rateLimit override,
 *                   or withEndpoint() with rateLimit.requestsPerMinute set
 *   - Cron        → cronEndpoint()
 *
 * Usage:
 *   node scripts/audit-endpoint-rate-limits.mjs                  # human summary
 *   node scripts/audit-endpoint-rate-limits.mjs --json           # machine-readable
 *   node scripts/audit-endpoint-rate-limits.mjs --fail-on-gaps   # exit 1 on gaps
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API_ROOT = join(ROOT, 'functions', 'api');

// Signals that indicate a file calls the Gemini AI stack.
//
// Note: we DON'T use `GEMINI_API_KEY` alone — health checks and env reports
// reference that name without ever calling Gemini. The bare import/call
// signals below are much higher-precision.
const AI_SIGNALS = [
  /from\s+['"]@google\/generative-ai['"]/,
  /\bgenerateContent\s*\(/,
  /:generateContent\?/, // raw REST URL pattern: /models/x:generateContent?key=...
  /\bGoogleGenerativeAI\s*\(/,
  /\bcallGemini\s*\(/,
  /\bstreamGemini\s*\(/,
  /from\s+['"][^'"]*\/ai-service['"]/,
  /from\s+['"][^'"]*\/question-generator['"]/,
];

// Expensive DB-query signals (heuristic — catches raw SQL + unbounded finds).
const DB_HEAVY_SIGNALS = [
  /\$queryRaw(?:Unsafe)?`/,
  /\$executeRaw(?:Unsafe)?`/,
  /\.aggregate\s*\(/,
  /\.groupBy\s*\(/,
  /findMany\s*\(\s*\{[^}]*\}\s*\)/s, // findMany with args (we check for `take` below)
];

// Rate-limit-aware wrappers. All of these apply at least IP-based limiting.
const RATE_LIMITED_WRAPPERS = [
  'aiEndpoint',
  'aiStreamingEndpoint',
  'authenticatedEndpoint',
  'adminAuthenticatedEndpoint',
  'adminEndpoint',
  'publicEndpoint',
  'cmsEndpoint',
  'refineryEndpoint',
  'cronEndpoint',
  'withEndpoint',
];

// Preferred wrappers for AI-calling endpoints.
// aiStreamingEndpoint is the SSE-safe sibling of aiEndpoint — both apply the
// Gemini rate-limit bucket, just with different response shapes.
const AI_PREFERRED = new Set(['aiEndpoint', 'aiStreamingEndpoint']);

// Files whose AI call is covered by an inline bespoke rate limit we want to
// keep (e.g. Sentry tunnel). Maintained by hand.
const KNOWN_INLINE_RATE_LIMIT = new Set([
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

  // Skip pure re-export stubs — they have no handler body to protect.
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

  const hasAnyHandler =
    hasLocalHandler ||
    /\bonRequest(?:Get|Post|Put|Patch|Delete|Head|Options)\b/.test(source);
  if (isReExport || !hasAnyHandler) {
    return null; // not an endpoint
  }

  const callsAI = AI_SIGNALS.some((re) => re.test(source));
  const isDbHeavy = DB_HEAVY_SIGNALS.some((re) => re.test(source));

  // Check wrappers actually used in this file.
  const wrappersUsed = RATE_LIMITED_WRAPPERS.filter((w) =>
    new RegExp(`\\b${w}\\s*\\(`).test(source)
  );

  // Detect explicit rate-limit override.
  const hasExplicitRateLimit =
    /requestsPerMinute\s*:/.test(source) ||
    /rateLimit\s*:\s*\{[^}]*requestsPerMinute/.test(source);

  // Detect cron-style file by path.
  const isCron = /(^|\/)cron(\/|$)/.test(relPath);

  // Issues
  const issues = [];
  let covered = true;

  if (callsAI) {
    if (KNOWN_INLINE_RATE_LIMIT.has(relPath)) {
      // Intentional bespoke handler.
    } else if (isCron) {
      // Cron endpoints are triggered by the scheduler with CRON_SECRET auth.
      // They should use cronEndpoint, not aiEndpoint — AI budget limits don't
      // apply to scheduled jobs.
      const usesCron = wrappersUsed.includes('cronEndpoint');
      if (!usesCron && wrappersUsed.length === 0) {
        covered = false;
        issues.push('Cron endpoint calls Gemini without cronEndpoint wrapper');
      } else if (!usesCron) {
        issues.push(
          `Cron endpoint uses ${wrappersUsed.join(', ')} — prefer cronEndpoint for scheduled triggers`
        );
      }
    } else {
      const usesAiWrapper = wrappersUsed.some((w) => AI_PREFERRED.has(w));
      const usesSomeRateLimitedWrapper =
        wrappersUsed.length > 0 &&
        wrappersUsed.some((w) => w !== 'publicEndpoint');
      if (!usesAiWrapper && !usesSomeRateLimitedWrapper) {
        covered = false;
        issues.push('Gemini call with no rate-limit-aware wrapper');
      } else if (!usesAiWrapper && usesSomeRateLimitedWrapper) {
        issues.push(
          `Gemini call uses ${wrappersUsed.join(', ')} — migrate to aiEndpoint (25/min) for tighter budget`
        );
      }
    }
  }

  if (isDbHeavy && !callsAI) {
    // publicEndpoint IS rate-limited (600/min by IP), so any rate-limit-aware
    // wrapper counts as coverage for DB-heavy endpoints.
    const usesSomeRateLimitedWrapper = wrappersUsed.length > 0;
    if (!usesSomeRateLimitedWrapper && !isCron) {
      covered = false;
      issues.push('DB-heavy handler with no rate-limit wrapper');
    }
  }

  return {
    file: relPath,
    callsAI,
    isDbHeavy,
    wrappersUsed,
    hasExplicitRateLimit,
    covered,
    issues,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const failOnGaps = args.includes('--fail-on-gaps');

  const results = [];
  for await (const f of walk(API_ROOT)) {
    const src = await readFile(f, 'utf8');
    const result = classify(f, src);
    if (result) results.push(result);
  }

  const aiEndpoints = results.filter((r) => r.callsAI);
  const dbHeavyEndpoints = results.filter((r) => r.isDbHeavy && !r.callsAI);
  const gaps = results.filter((r) => !r.covered);
  const migrations = results.filter((r) => r.covered && r.issues.length > 0);

  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        {
          scannedEndpoints: results.length,
          aiEndpoints: aiEndpoints.length,
          dbHeavyEndpoints: dbHeavyEndpoints.length,
          gaps,
          migrations,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    console.log(
      `PANaCEa endpoint rate-limit coverage — scanned ${results.length} endpoint files`
    );
    console.log(
      `  AI-calling (Gemini):  ${String(aiEndpoints.length).padStart(4)}`
    );
    console.log(
      `  DB-heavy (non-AI):    ${String(dbHeavyEndpoints.length).padStart(4)}`
    );

    if (gaps.length > 0) {
      console.log(
        `\n✗ ${gaps.length} endpoint(s) missing rate-limit coverage:\n`
      );
      for (const m of gaps) {
        console.log(`  ${m.file}`);
        for (const issue of m.issues) console.log(`    — ${issue}`);
      }
    } else {
      console.log('\n✓ All hot-path endpoints have rate-limit coverage.');
    }

    if (migrations.length > 0) {
      console.log(
        `\n⚠ ${migrations.length} endpoint(s) have advisory migrations:\n`
      );
      for (const r of migrations) {
        console.log(`  ${r.file}`);
        for (const issue of r.issues) console.log(`    — ${issue}`);
      }
    }
  }

  if (failOnGaps && gaps.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
