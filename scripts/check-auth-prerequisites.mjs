#!/usr/bin/env node

/**
 * Auth Smoke Prerequisites Check
 *
 * Validates that the local environment is ready for authenticated E2E smoke tests.
 * Run before attempting `npm run test:auth` or `npm run test:e2e:production-smoke`
 * with E2E_REQUIRE_AUTH=1.
 *
 * Usage: node scripts/check-auth-prerequisites.mjs
 * npm:   npm run test:auth:check
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const checks = [];
let passed = 0;
let failed = 0;
let skipped = 0;

function check(label, fn) {
  checks.push({ label, fn });
}

function pass(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`);
  failed++;
}

function skip(label, detail) {
  console.log(`  ⬜ ${label}${detail ? `\n     → ${detail}` : ''}`);
  skipped++;
}

// --- Checks ---

check('CLERK_SECRET_KEY is set', () => {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key || !key.trim()) {
    fail('CLERK_SECRET_KEY is not set', 'Add CLERK_SECRET_KEY=sk_test_... to .env');
  } else {
    const masked = key.substring(0, 7);
    if (key.startsWith('sk_test_') || key.startsWith('sk_live_')) {
      pass(`CLERK_SECRET_KEY set (${masked}***)`);
    } else {
      fail(
        'CLERK_SECRET_KEY has unexpected format',
        `Expected sk_test_* or sk_live_*, got: ${masked}`
      );
    }
  }
});

check('E2E_CLERK_TEST_EMAIL is set (required for auth)', () => {
  const email = process.env.E2E_CLERK_TEST_EMAIL?.trim();
  if (!email) {
    skip(
      'E2E_CLERK_TEST_EMAIL is not set',
      'Set E2E_CLERK_TEST_EMAIL=user@example.com in .env to enable authenticated smoke.'
    );
  } else {
    pass(`E2E_CLERK_TEST_EMAIL=${email}`);
  }
});

check('E2E_CLERK_TEST_PASSWORD is set (optional, legacy only)', () => {
  const pwd = process.env.E2E_CLERK_TEST_PASSWORD;
  if (pwd) {
    pass('E2E_CLERK_TEST_PASSWORD set (legacy browser-based sign-in available)');
  } else {
    skip(
      'E2E_CLERK_TEST_PASSWORD is not set',
      'Not required when using backend-based sign-in (@clerk/testing).'
    );
  }
});

check('@clerk/testing is installed', () => {
  try {
    require.resolve('@clerk/testing/playwright');
    pass('@clerk/testing is installed');
  } catch {
    fail('@clerk/testing is not installed', 'Run: npm install --save-dev @clerk/testing');
  }
});

check('@playwright/test is installed', () => {
  try {
    require.resolve('@playwright/test');
    pass('@playwright/test is installed');
  } catch {
    fail('@playwright/test is not installed', 'Run: npm install');
  }
});

check('Playwright browsers are installed', () => {
  try {
    const { getPackageManager } = require('@playwright/test/lib/utils');
    const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH || undefined;
    // Quick check: does the chromium directory exist?
    const pwPath = require.resolve('@playwright/test');
    const browsersPath = resolve(dirname(dirname(pwPath)), '.local-browsers');
    if (existsSync(browsersPath)) {
      pass('Playwright browsers directory exists');
    } else {
      skip('Could not verify Playwright browsers', 'Run: npx playwright install chromium');
    }
  } catch {
    skip('Could not check Playwright browsers (install may be needed)');
  }
});

check('Wrangler is installed', () => {
  try {
    require.resolve('wrangler');
    pass('Wrangler is installed');
  } catch {
    fail('Wrangler is not installed', 'Run: npm install');
  }
});

check('Build output exists (dist/)', () => {
  const distPath = resolve(__dirname, '..', 'dist');
  if (existsSync(distPath)) {
    pass('dist/ directory exists');
  } else {
    skip('dist/ does not exist', 'Run: npm run build');
  }
});

check('E2E_REQUIRE_AUTH is enabled', () => {
  if (process.env.E2E_REQUIRE_AUTH === '1') {
    pass('E2E_REQUIRE_AUTH=1 (authenticated smoke will run)');
  } else {
    skip('E2E_REQUIRE_AUTH=0 or unset', 'Set E2E_REQUIRE_AUTH=1 to run authenticated smoke tests.');
  }
});

check('Auth methods available', () => {
  const hasBackend =
    process.env.CLERK_SECRET_KEY?.trim() && process.env.E2E_CLERK_TEST_EMAIL?.trim();
  const hasBrowser = process.env.E2E_CLERK_TEST_EMAIL && process.env.E2E_CLERK_TEST_PASSWORD;

  if (hasBackend) {
    pass('Backend-based sign-in available (bypasses MFA)');
  } else if (hasBrowser) {
    pass('Browser-based sign-in available (requires MFA disabled)');
  } else {
    skip('No auth method available', 'Set E2E_CLERK_TEST_EMAIL in .env');
  }
});

// --- Runner ---

console.log('\n🔐 Auth Smoke Prerequisites Check\n');

for (const { label, fn } of checks) {
  fn();
}

console.log(`\n${'─'.repeat(50)}`);
const total = passed + failed + skipped;
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${total} total)`);

if (failed > 0) {
  console.log('\n⚠️  Fix the failures above before running authenticated smoke tests.');
  process.exit(1);
}

if (skipped > 0) {
  console.log(
    '\n⚠️  Some checks were skipped. Run the missing setup steps to enable authenticated testing.'
  );
}

if (failed === 0 && passed > 0) {
  console.log('\n✅ Ready for authenticated smoke testing.');
  console.log('   Terminal 1: npm run dev:wrangler');
  console.log(
    '   Terminal 2: E2E_REQUIRE_AUTH=1 BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke'
  );
}

console.log();
