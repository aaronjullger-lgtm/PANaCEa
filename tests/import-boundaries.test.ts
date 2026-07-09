/**
 * Import-boundary regression guards (Implementation Expansion Pass — Phase 5/8).
 *
 * Enforces architectural boundaries the audit relied on but nothing was
 * protecting:
 *
 *  1. Production Cloudflare Pages Functions (`functions/**`) must NEVER import
 *     the legacy Express dev middleware (`lib/middleware/*`) — which includes
 *     the regex `sanitizeString` explicitly marked "dev-only" — nor `express`
 *     itself. Production input handling uses `functions/api/_shared/validation`
 *     + Zod. This test fails if that boundary is ever crossed.
 *
 * These are static source scans (no runtime), so they are fast and deterministic.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

// Matches: import ... from 'express' | "lib/middleware/..." | '@/lib/middleware/...'
// and relative traversals into lib/middleware, plus require('express').
const FORBIDDEN_IMPORT =
  /(?:from|require\()\s*['"](?:express|(?:@\/|(?:\.\.\/)+)?lib\/middleware\/[^'"]*)['"]/;

describe('functions/** import boundaries', () => {
  const functionFiles = walk(join(REPO_ROOT, 'functions'), ['.ts', '.tsx']);

  it('discovers the functions source tree', () => {
    expect(functionFiles.length).toBeGreaterThan(50);
  });

  it('never imports express or the legacy lib/middleware sanitizer', () => {
    const offenders: string[] = [];
    for (const file of functionFiles) {
      const src = readFileSync(file, 'utf8');
      for (const line of src.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (FORBIDDEN_IMPORT.test(trimmed)) {
          offenders.push(`${file.replace(REPO_ROOT + '/', '')}: ${trimmed}`);
        }
      }
    }
    expect(
      offenders,
      `Production edge functions must not import express or lib/middleware/* (legacy dev sanitizer). Offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
