/**
 * Regression guard: production API endpoints must never return the raw
 * `error.message` in a response body (it can leak internal DB/stack detail).
 * Errors should be logged server-side (redacting logger) and the client should
 * receive a generic message.
 *
 * Heuristic: flag any `error instanceof Error ? error.message` that sits inside a
 * RESPONSE object (a `status:` appears within the preceding few lines) rather than
 * inside a logger call (`.error(`/`.warn(`/`.info(`/`console.` within those lines).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = join(__dirname, '..', 'functions', 'api');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const LEAK = /(?:error|message)\s*:\s*error instanceof Error \? error\.message/;
const LOGGER = /\.(error|warn|info|debug)\s*\(|console\./;

describe('API responses never leak raw error.message', () => {
  const files = walk(API_DIR);

  it('scans the functions/api tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no response-body error.message leaks', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!LEAK.test(lines[i]!)) continue;
        const windowLines = lines.slice(Math.max(0, i - 4), i + 1);
        const win = windowLines.join('\n');
        const inResponse = /status\s*:/.test(win);
        const inLogger = LOGGER.test(win);
        // Explicit, justified exceptions (e.g. admin-only health diagnostics that
        // intentionally surface DB error detail) are annotated with `leak-ok:`.
        const allowlisted = /leak-ok:/.test(win);
        if (inResponse && !inLogger && !allowlisted) {
          offenders.push(`${file.split('/functions/api/')[1]}:${i + 1}: ${lines[i]!.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `Raw error.message returned in a response body (leaks internal detail). Log it and return a generic message instead:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
