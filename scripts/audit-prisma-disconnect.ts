#!/usr/bin/env tsx

/**
 * Prisma Disconnect Audit Script
 * Checks all API endpoints for proper prisma.$disconnect() usage
 * as required by .clinerules for database-first principle
 */

import { promises as fs } from 'fs';
import path from 'path';

interface AuditResult {
  file: string;
  usesPrisma: boolean;
  hasDisconnect: boolean;
  hasTryFinally: boolean;
  status: 'PASS' | 'FAIL_MISSING_DISCONNECT' | 'FAIL_MISSING_TRY_FINALLY';
}

async function findApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(dirPath: string) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory() && item.name !== 'node_modules') {
        await scan(fullPath);
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}

async function auditFile(filePath: string): Promise<AuditResult> {
  const content = await fs.readFile(filePath, 'utf-8');

  const usesPrisma = /prisma\./.test(content);

  // Recognize both direct $disconnect() and safePrismaDisconnect wrapper
  const hasDisconnect =
    /prisma\.\$disconnect\(\)/.test(content) || /safePrismaDisconnect\s*\(/.test(content);

  // Check if in finally block (either pattern)
  const hasTryFinally =
    /finally\s*\{[\s\S]*prisma\.\$disconnect\(\)/.test(content) ||
    /finally\s*\{[\s\S]*safePrismaDisconnect\s*\(/.test(content);

  // Utility modules that export functions (not API endpoints) shouldn't be flagged
  // They receive prisma as a parameter and caller handles cleanup
  const isUtilityModule =
    /export\s+(async\s+)?function\s+\w+\s*\([^)]*prisma/.test(content) &&
    !/onRequest(Get|Post|Put|Delete|Patch)/.test(content);

  let status: AuditResult['status'] = 'PASS';

  // Skip utility modules that receive prisma as a parameter
  if (isUtilityModule) {
    status = 'PASS'; // Caller is responsible for cleanup
  } else if (usesPrisma && !hasDisconnect) {
    status = 'FAIL_MISSING_DISCONNECT';
  } else if (usesPrisma && hasDisconnect && !hasTryFinally) {
    status = 'FAIL_MISSING_TRY_FINALLY';
  }

  return {
    file: filePath,
    usesPrisma,
    hasDisconnect,
    hasTryFinally,
    status,
  };
}

async function main() {
  const apiDir = path.join(process.cwd(), 'functions/api');
  const files = await findApiFiles(apiDir);

  console.log('🔍 Auditing Prisma disconnect usage in API endpoints...\n');

  const results: AuditResult[] = [];

  for (const file of files) {
    try {
      const result = await auditFile(file);
      if (result.usesPrisma) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Error auditing ${file}:`, error);
    }
  }

  // Group results
  const passing = results.filter((r) => r.status === 'PASS');
  const missingDisconnect = results.filter((r) => r.status === 'FAIL_MISSING_DISCONNECT');
  const missingTryFinally = results.filter((r) => r.status === 'FAIL_MISSING_TRY_FINALLY');

  console.log(`📊 Audit Results:`);
  console.log(`✅ PASS: ${passing.length} files`);
  console.log(`❌ FAIL (Missing disconnect): ${missingDisconnect.length} files`);
  console.log(`⚠️  FAIL (Not in finally block): ${missingTryFinally.length} files\n`);

  if (missingDisconnect.length > 0) {
    console.log('🚨 CRITICAL: Files missing prisma.$disconnect():');
    missingDisconnect.forEach((result) => {
      console.log(`  - ${path.relative(process.cwd(), result.file)}`);
    });
    console.log('');
  }

  if (missingTryFinally.length > 0) {
    console.log('⚠️  WARNING: Files with disconnect not in finally block:');
    missingTryFinally.forEach((result) => {
      console.log(`  - ${path.relative(process.cwd(), result.file)}`);
    });
    console.log('');
  }

  if (passing.length > 0) {
    console.log('✅ Properly implemented files:');
    passing.slice(0, 5).forEach((result) => {
      console.log(`  - ${path.relative(process.cwd(), result.file)}`);
    });
    if (passing.length > 5) {
      console.log(`  ... and ${passing.length - 5} more`);
    }
  }

  const hasFailures = missingDisconnect.length > 0 || missingTryFinally.length > 0;

  if (hasFailures) {
    console.log('\n💡 Fix Pattern:');
    console.log('```typescript');
    console.log('export async function onRequestGet(context: any) {');
    console.log('  const { request, env } = context;');
    console.log('  const auth = await authenticateRequest(request, env);');
    console.log('  if (!auth) return new Response("Unauthorized", { status: 401 });');
    console.log('');
    console.log('  const prisma = createEdgePrismaClient(env.DATABASE_URL);');
    console.log('  try {');
    console.log('    // your logic here');
    console.log('  } finally {');
    console.log('    await prisma.$disconnect();');
    console.log('  }');
    console.log('}');
    console.log('```');

    process.exit(1);
  } else {
    console.log('\n🎉 All API endpoints properly handle Prisma disconnect!');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { auditFile, findApiFiles };
