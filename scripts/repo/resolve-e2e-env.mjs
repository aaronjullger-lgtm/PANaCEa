#!/usr/bin/env node
/**
 * Resolve Clerk E2E env vars for GitHub Actions with alias fallbacks.
 * Workflow passes secrets as SEC_* inputs; writes canonical names to GITHUB_ENV.
 */
import { appendFileSync } from 'node:fs';

const out = process.env.GITHUB_ENV ?? '/dev/stdout';

function pickFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

const vitePk =
  pickFirst('SEC_VITE_CLERK_PUBLISHABLE_KEY', 'SEC_CLERK_PUBLISHABLE_KEY');
if (vitePk) {
  appendFileSync(out, `VITE_CLERK_PUBLISHABLE_KEY=${vitePk}\n`);
  appendFileSync(out, `CLERK_PUBLISHABLE_KEY=${vitePk}\n`);
}

const email = pickFirst('SEC_PANACEA_E2E_EMAIL', 'SEC_E2E_CLERK_TEST_EMAIL');
if (email) {
  appendFileSync(out, `PANACEA_E2E_EMAIL=${email}\n`);
  appendFileSync(out, `E2E_CLERK_TEST_EMAIL=${email}\n`);
}

const password = pickFirst('SEC_PANACEA_E2E_PASSWORD', 'SEC_E2E_CLERK_TEST_PASSWORD');
if (password) {
  appendFileSync(out, `PANACEA_E2E_PASSWORD=${password}\n`);
  appendFileSync(out, `E2E_CLERK_TEST_PASSWORD=${password}\n`);
}

const secret = process.env.SEC_CLERK_SECRET_KEY?.trim();
if (secret) {
  appendFileSync(out, `CLERK_SECRET_KEY=${secret}\n`);
}

console.log(
  `[ci] E2E env resolved: publishable=${vitePk ? 'yes' : 'no'} email=${email ? 'yes' : 'no'} secret=${secret ? 'yes' : 'no'}`
);
