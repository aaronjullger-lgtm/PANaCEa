#!/usr/bin/env tsx

/**
 * Zod Validation Audit Script
 *
 * Audits all mutation endpoints (POST/PUT/PATCH/DELETE) under functions/api
 * for proper runtime input validation.
 *
 * An endpoint is considered PASS if ANY of these hold:
 *   1. It uses one of the shared middleware wrappers that internally compose
 *      `withValidation(schema)`:
 *        - adminEndpoint (deprecated alias of adminAuthenticatedEndpoint)
 *        - adminAuthenticatedEndpoint
 *        - authenticatedEndpoint
 *        - aiEndpoint
 *        - refineryEndpoint
 *        - cmsEndpoint
 *        - publicEndpoint
 *      These wrappers guarantee Zod validation before the handler runs, even
 *      when the schema is an empty object or undefined (the wrapper still
 *      rejects non-JSON bodies and enforces the auth/rate-limit model).
 *   2. It calls `withMiddleware(..., withValidation(...), ...)` directly
 *      (custom middleware composition that still includes validation).
 *   3. It calls `validateRequest(`, `.safeParse(`, or a Zod-shaped `.parse(`
 *      (excluding `JSON.parse(`).
 *
 * An endpoint is WARN if it has:
 *   - A recognized out-of-band security model (CRON_SECRET bearer check or
 *     Svix webhook signature verification) — these are correct by design and
 *     do NOT need Zod.
 *   OR
 *   - Manual validation only (`if (!field) return 400` style) with no Zod.
 *
 * An endpoint is FAIL if none of the above.
 *
 * Exclusions:
 *   - _shared/** (middleware internals)
 *   - *.test.ts (test harness fixtures)
 *   - *.disabled / paths containing `.disabled.` (intentionally off)
 *   - node_modules
 */

import { promises as fs } from 'fs';
import path from 'path';

type Status = 'PASS' | 'WARN_MANUAL_ONLY' | 'WARN_OUT_OF_BAND' | 'FAIL_NO_VALIDATION';

interface AuditResult {
  file: string;
  hasMutation: boolean;
  usesValidateRequest: boolean;
  usesZodSafeParse: boolean;
  usesZodParse: boolean;
  usesWrapper: boolean;
  usesWithValidation: boolean;
  hasManualValidation: boolean;
  usesCronSecret: boolean;
  usesSvixWebhook: boolean;
  status: Status;
  methods: string[];
  note?: string;
}

const VALIDATED_WRAPPERS = [
  'adminEndpoint',
  'adminAuthenticatedEndpoint',
  'authenticatedEndpoint',
  'aiEndpoint',
  'refineryEndpoint',
  'cmsEndpoint',
  'publicEndpoint',
];

async function findApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(dirPath: string) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === '_shared') continue;
        await scan(fullPath);
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        if (item.name.endsWith('.test.ts')) continue;
        if (item.name.endsWith('.disabled') || fullPath.includes('.disabled.')) continue;
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}

function detectWrapper(content: string): boolean {
  for (const name of VALIDATED_WRAPPERS) {
    // Allow an optional TypeScript generic type argument between the wrapper
    // name and its parenthesis — e.g. `authenticatedEndpoint<Input>(...)` — so
    // strongly-typed usages still count as validated.
    const re = new RegExp(`\\b${name}\\s*(?:<[^>]*>)?\\s*\\(`);
    if (re.test(content)) return true;
  }
  return false;
}

function detectZodParseNotJsonParse(content: string): boolean {
  // Match `.parse(` but not `JSON.parse(`. Require the preceding token to not be `JSON`.
  // Line-by-line scan so a trailing `.parse(` call on a Zod schema identifier is caught
  // without false-positives on `JSON.parse(...)`.
  const lines = content.split('\n');
  for (const line of lines) {
    const re = /([A-Za-z_$][\w$]*)\s*\.\s*parse\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const token = m[1];
      if (token !== 'JSON') return true;
    }
  }
  return false;
}

async function auditFile(filePath: string): Promise<AuditResult | null> {
  const content = await fs.readFile(filePath, 'utf-8');

  const methods: string[] = [];
  if (/\bonRequestPost\b/.test(content)) methods.push('POST');
  if (/\bonRequestPut\b/.test(content)) methods.push('PUT');
  if (/\bonRequestPatch\b/.test(content)) methods.push('PATCH');
  if (/\bonRequestDelete\b/.test(content)) methods.push('DELETE');

  const hasMutation = methods.length > 0;
  if (!hasMutation) return null;

  const usesValidateRequest = /\bvalidateRequest\s*\(/.test(content);
  const usesZodSafeParse = /\.safeParse\s*\(/.test(content);
  const usesZodParse = detectZodParseNotJsonParse(content);
  const usesWrapper = detectWrapper(content);
  const usesWithValidation = /\bwithValidation\s*\(/.test(content);

  // Manual "required-field" validation — a last-resort heuristic when no schema
  // is in play.
  const hasManualValidation =
    /if\s*\(\s*![\w.]+\s*\)/.test(content) &&
    /return\s+new\s+Response\s*\([^)]*(?:400|missing|required)/i.test(content);

  // Out-of-band security models that legitimately don't need Zod.
  // Accept any `<identifier>.CRON_SECRET` reference (e.g. `env.CRON_SECRET`,
  // `cronEnv.CRON_SECRET`, `context.env.CRON_SECRET`).
  const usesCronSecret =
    /\.CRON_SECRET\b/.test(content) &&
    /Authorization|Bearer/i.test(content);
  const usesSvixWebhook =
    /svix/i.test(content) && /verify\s*\(/.test(content);

  let status: Status = 'FAIL_NO_VALIDATION';
  let note: string | undefined;

  if (
    usesValidateRequest ||
    usesZodSafeParse ||
    usesZodParse ||
    usesWrapper ||
    usesWithValidation
  ) {
    status = 'PASS';
    if (usesWrapper) note = 'shared middleware wrapper';
    else if (usesWithValidation) note = 'custom withValidation composition';
  } else if (usesCronSecret) {
    status = 'WARN_OUT_OF_BAND';
    note = 'CRON_SECRET bearer (Zod not applicable)';
  } else if (usesSvixWebhook) {
    status = 'WARN_OUT_OF_BAND';
    note = 'Svix webhook signature (Zod not applicable)';
  } else if (hasManualValidation) {
    status = 'WARN_MANUAL_ONLY';
  }

  return {
    file: filePath,
    hasMutation,
    usesValidateRequest,
    usesZodSafeParse,
    usesZodParse,
    usesWrapper,
    usesWithValidation,
    hasManualValidation,
    usesCronSecret,
    usesSvixWebhook,
    status,
    methods,
    note,
  };
}

async function main() {
  const apiDir = path.join(process.cwd(), 'functions/api');
  const files = await findApiFiles(apiDir);

  console.log('Auditing Zod validation on API mutation endpoints...\n');

  const results: AuditResult[] = [];

  for (const file of files) {
    try {
      const result = await auditFile(file);
      if (result) results.push(result);
    } catch (error) {
      console.error(`Error auditing ${file}:`, error);
    }
  }

  const passing = results.filter((r) => r.status === 'PASS');
  const outOfBand = results.filter((r) => r.status === 'WARN_OUT_OF_BAND');
  const manualOnly = results.filter((r) => r.status === 'WARN_MANUAL_ONLY');
  const noValidation = results.filter((r) => r.status === 'FAIL_NO_VALIDATION');

  console.log(`Audit results:`);
  console.log(`  PASS (Zod/wrapper):              ${passing.length}`);
  console.log(`  WARN (out-of-band security):     ${outOfBand.length}`);
  console.log(`  WARN (manual validation only):   ${manualOnly.length}`);
  console.log(`  FAIL (no validation):            ${noValidation.length}\n`);

  if (noValidation.length > 0) {
    console.log('FAIL — endpoints with no recognized validation:');
    for (const r of noValidation) {
      console.log(`  - ${path.relative(process.cwd(), r.file)} [${r.methods.join(', ')}]`);
    }
    console.log('');
  }

  if (manualOnly.length > 0) {
    console.log('WARN — manual validation only (prefer Zod schema):');
    for (const r of manualOnly) {
      console.log(`  - ${path.relative(process.cwd(), r.file)} [${r.methods.join(', ')}]`);
    }
    console.log('');
  }

  if (outOfBand.length > 0) {
    console.log('WARN — out-of-band security (OK, Zod not applicable):');
    for (const r of outOfBand) {
      console.log(
        `  - ${path.relative(process.cwd(), r.file)} [${r.methods.join(', ')}] ${r.note ? `(${r.note})` : ''}`
      );
    }
    console.log('');
  }

  const blockingIssues = noValidation.length + manualOnly.length;

  if (blockingIssues > 0) {
    console.log('Fix pattern:');
    console.log('  import { z } from "zod";');
    console.log('  import { authenticatedEndpoint } from "../_shared/middleware";');
    console.log('');
    console.log('  const Schema = z.object({');
    console.log('    body: z.object({ /* request fields */ }),');
    console.log('  });');
    console.log('');
    console.log('  export const onRequestPost = authenticatedEndpoint(Schema, async ({ env, auth, validated }) => {');
    console.log('    const { /* fields */ } = validated.body;');
    console.log('    /* handler logic */');
    console.log('  });');
    process.exit(1);
  } else {
    console.log('All mutation endpoints use a recognized validation path.');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { auditFile, findApiFiles };
