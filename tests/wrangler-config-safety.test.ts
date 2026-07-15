/**
 * SEC-001 regression — committed config must never contain server secrets.
 *
 * wrangler.toml legitimately carries client-public VITE_* values (Clerk
 * publishable pk_live_, Supabase anon key, URLs, Sentry DSN). It must NEVER
 * carry server-side secrets (Clerk secret key, Supabase service-role JWT,
 * DATABASE_URL credentials, Gemini API key, private keys, webhook secrets).
 * This scans the *assignment* lines (comments/placeholders ignored).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

const SERVER_SECRET_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /\bsk_(?:live|test)_[A-Za-z0-9]{6,}/, name: 'Clerk secret key (sk_*)' },
  { re: /SERVICE_ROLE_KEY\s*=\s*["']?eyJ[A-Za-z0-9_-]+\./, name: 'Supabase service-role JWT' },
  { re: /\bAIza[0-9A-Za-z_-]{20,}/, name: 'Google/Gemini API key (AIza…)' },
  {
    re: /(?:DATABASE_URL|DIRECT_DATABASE_URL)\s*=\s*["']?(?:postgres|postgresql|prisma\+postgres):\/\/[^"'\s]*:[^"'\s]+@/,
    name: 'DB connection string with credentials',
  },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, name: 'private key block' },
  { re: /\bwhsec_[A-Za-z0-9]{6,}/, name: 'webhook signing secret (whsec_)' },
];

function assignmentLines(path: string): string {
  const raw = readFileSync(path, 'utf8');
  return raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('#')) // ignore comments/placeholders
    .join('\n');
}

describe('config secret scan (SEC-001)', () => {
  const targets = ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json'].filter((f) =>
    existsSync(join(ROOT, f))
  );

  it('finds a wrangler config to scan', () => {
    expect(targets.length).toBeGreaterThan(0);
  });

  it('contains no server-side secrets in assignment lines', () => {
    const offenders: string[] = [];
    for (const f of targets) {
      const body = assignmentLines(join(ROOT, f));
      for (const { re, name } of SERVER_SECRET_PATTERNS) {
        if (re.test(body)) offenders.push(`${f}: ${name}`);
      }
    }
    expect(
      offenders,
      `Server secret pattern committed to config — rotate + move to Cloudflare Dashboard env:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
