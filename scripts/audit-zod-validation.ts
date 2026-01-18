#!/usr/bin/env tsx

/**
 * Zod Validation Audit Script
 * Checks all POST/PUT/PATCH API endpoints for proper Zod validation usage
 * as required by .clinerules for runtime validation
 */

import { promises as fs } from 'fs';
import path from 'path';

interface AuditResult {
  file: string;
  hasPostPutPatch: boolean;
  usesValidateRequest: boolean;
  usesZodSafeParse: boolean;
  usesZodParse: boolean;
  hasManualValidation: boolean;
  status: 'PASS' | 'WARN_MANUAL_ONLY' | 'FAIL_NO_VALIDATION';
  methods: string[];
}

async function findApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(dirPath: string) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '_shared') {
        await scan(fullPath);
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}

async function auditFile(filePath: string): Promise<AuditResult | null> {
  const content = await fs.readFile(filePath, 'utf-8');

  const methods: string[] = [];
  if (/onRequestPost/.test(content)) methods.push('POST');
  if (/onRequestPut/.test(content)) methods.push('PUT');
  if (/onRequestPatch/.test(content)) methods.push('PATCH');

  const hasPostPutPatch = methods.length > 0;

  if (!hasPostPutPatch) {
    return null; // Skip GET-only endpoints
  }

  const usesValidateRequest = /validateRequest\s*\(/.test(content);
  const usesZodSafeParse = /\.safeParse\s*\(/.test(content);
  const usesZodParse = /\.parse\s*\(/.test(content);

  // Check for manual validation patterns
  const hasManualValidation =
    /if\s*\(\s*![\w.]+\s*\)/.test(content) && // if (!field)
    /return\s+new\s+Response\s*\([^)]*(?:400|missing|required)/i.test(content);

  let status: AuditResult['status'] = 'FAIL_NO_VALIDATION';

  if (usesValidateRequest || usesZodSafeParse || usesZodParse) {
    status = 'PASS';
  } else if (hasManualValidation) {
    status = 'WARN_MANUAL_ONLY';
  }

  return {
    file: filePath,
    hasPostPutPatch,
    usesValidateRequest,
    usesZodSafeParse,
    usesZodParse,
    hasManualValidation,
    status,
    methods,
  };
}

async function main() {
  const apiDir = path.join(process.cwd(), 'functions/api');
  const files = await findApiFiles(apiDir);

  console.log('🔍 Auditing Zod validation usage in API endpoints...\n');

  const results: AuditResult[] = [];

  for (const file of files) {
    try {
      const result = await auditFile(file);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Error auditing ${file}:`, error);
    }
  }

  // Group results
  const passing = results.filter((r) => r.status === 'PASS');
  const manualOnly = results.filter((r) => r.status === 'WARN_MANUAL_ONLY');
  const noValidation = results.filter((r) => r.status === 'FAIL_NO_VALIDATION');

  console.log(`📊 Audit Results:`);
  console.log(`✅ PASS (Zod validation): ${passing.length} endpoints`);
  console.log(`⚠️  WARN (Manual validation only): ${manualOnly.length} endpoints`);
  console.log(`❌ FAIL (No validation): ${noValidation.length} endpoints\n`);

  if (noValidation.length > 0) {
    console.log('🚨 CRITICAL: Endpoints with NO validation:');
    noValidation.forEach((result) => {
      console.log(
        `  - ${path.relative(process.cwd(), result.file)} [${result.methods.join(', ')}]`
      );
    });
    console.log('');
  }

  if (manualOnly.length > 0) {
    console.log('⚠️  WARNING: Endpoints with manual validation (should use Zod):');
    manualOnly.forEach((result) => {
      console.log(
        `  - ${path.relative(process.cwd(), result.file)} [${result.methods.join(', ')}]`
      );
    });
    console.log('');
  }

  if (passing.length > 0) {
    console.log('✅ Properly validated endpoints:');
    passing.slice(0, 5).forEach((result) => {
      console.log(
        `  - ${path.relative(process.cwd(), result.file)} [${result.methods.join(', ')}]`
      );
    });
    if (passing.length > 5) {
      console.log(`  ... and ${passing.length - 5} more`);
    }
    console.log('');
  }

  // Priority list for fixing
  console.log('📋 Priority Fix Order (Security-Critical First):');
  const priorityEndpoints = [
    'webhooks/clerk.ts',
    'exam/start.ts',
    'exam/complete.ts',
    'questions/attempt.ts',
    'drills/submit-review.ts',
    'feedback/submit.ts',
    'admin/',
    'srs/sync.ts',
    'performance/record.ts',
  ];

  const prioritized = [...manualOnly, ...noValidation].filter((r) =>
    priorityEndpoints.some((p) => r.file.includes(p))
  );

  prioritized.forEach((result, i) => {
    console.log(`  ${i + 1}. ${path.relative(process.cwd(), result.file)} [${result.status}]`);
  });

  const hasIssues = manualOnly.length > 0 || noValidation.length > 0;

  if (hasIssues) {
    console.log('\n💡 Fix Pattern:');
    console.log('```typescript');
    console.log("import { validateRequest, QuestionAttemptSchema } from '../_shared/schemas';");
    console.log('');
    console.log('export async function onRequestPost(context: any) {');
    console.log('  const { request, env } = context;');
    console.log('');
    console.log('  // Validate input first');
    console.log('  const validation = await validateRequest(request, QuestionAttemptSchema);');
    console.log('  if (!validation.success) return validation.response;');
    console.log('');
    console.log('  const { questionId, isCorrect, ... } = validation.data;');
    console.log('  // ... rest of logic');
    console.log('}');
    console.log('```');

    process.exit(1);
  } else {
    console.log('\n🎉 All API endpoints properly use Zod validation!');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { auditFile, findApiFiles };
