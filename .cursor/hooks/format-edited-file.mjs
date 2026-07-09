#!/usr/bin/env node
/**
 * Cursor afterFileEdit hook — non-destructive Prettier check.
 *
 * Reads a JSON payload on stdin ({ file_path, edits, ... }) after Cursor edits
 * a file. By default it only CHECKS formatting for the single edited file and
 * logs the result to .cursor/hooks/logs/format.log — it does NOT modify files.
 *
 * Opt-in auto-format: set CURSOR_HOOK_AUTOFORMAT=1 to run `prettier --write`
 * on just the edited file instead of check-only.
 *
 * This hook never fails the edit: all errors are swallowed and it exits 0.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';

const FORMATTABLE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.md', '.mdx', '.html', '.yml', '.yaml',
]);

// Sensitive paths: editing these should go through the right workflow / approval.
// This is a NON-BLOCKING advisory logged for the audit trail (afterFileEdit
// cannot message the agent or block; see docs/proposed-agent-hooks.md).
const SENSITIVE = [
  { re: /(^|\/)\.env(\.|$)|(^|\/)\.dev\.vars$|\.cursor\/mcp\.json$/i, why: 'secret/env file' },
  { re: /(^|\/)package-lock\.json$|(^|\/)package\.json$/i, why: 'dependency manifest/lockfile' },
  { re: /(^|\/)prisma\/(schema\.prisma|migrations\/)/i, why: 'Prisma schema/migration (use database-change-review workflow; migrations need approval)' },
  { re: /functions\/api\/_shared\/auth\.|(^|\/)middleware|rls|policy/i, why: 'auth/RLS/middleware (use security-review workflow; needs approval)' },
  { re: /(^|\/)wrangler\.toml$|(^|\/)public\/_headers$/i, why: 'Cloudflare/prod config' },
  { re: /(^|\/)lib\/fsrs\.ts$|drillReviewService|implicit-metrics/i, why: 'FSRS rating logic (safety-critical; needs approval)' },
];

const LOG = '.cursor/hooks/logs/format.log';

function log(line) {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* ignore logging errors */
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (data += c));
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', () => resolve(data));
      setTimeout(() => resolve(data), 2000);
    } catch {
      resolve(data);
    }
  });
}

async function main() {
  let file = '';
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) file = String(JSON.parse(raw).file_path ?? '');
  } catch {
    return;
  }
  if (!file) return;

  // Non-blocking advisory when a sensitive file is edited.
  for (const s of SENSITIVE) {
    if (s.re.test(file)) {
      log(`ADVISORY sensitive-file edited (${s.why}): ${file}`);
      break;
    }
  }

  if (!existsSync(file)) return;
  if (!FORMATTABLE.has(extname(file))) return;

  const autoformat = process.env.CURSOR_HOOK_AUTOFORMAT === '1';
  const args = autoformat ? ['prettier', '--write', file] : ['prettier', '--check', file];

  const res = spawnSync('npx', args, { encoding: 'utf8', timeout: 20000 });
  if (res.error) {
    log(`skip (${res.error.code || res.error.message}): ${file}`);
    return;
  }
  if (autoformat) {
    log(`formatted: ${file}`);
  } else if (res.status === 0) {
    log(`ok: ${file}`);
  } else {
    log(`needs formatting (run \`npx prettier --write ${file}\` or \`npm run format\`): ${file}`);
  }
}

main().catch(() => {}).finally(() => process.exit(0));
