#!/usr/bin/env tsx
/**
 * Master Database Orchestrator
 *
 * Runs the complete "Health & Sync" cycle in the correct order:
 * 1. Handshake (Local → DB): Sync local registries to database
 * 2. Diagnostic: Validate database integrity
 * 3. Auto-Mechanic: Repair data issues
 * 4. Write-Back (DB → Local): Capture AI-generated records back to code
 *
 * This ensures bi-directional synchronization and database health.
 *
 * Usage: npx tsx scripts/maintenance/orchestrator.ts
 * Or: npm run db:orchestrate (add to package.json)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TaskResult {
  name: string;
  emoji: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

const results: TaskResult[] = [];

/**
 * Run a TypeScript script and capture output
 */
function runScript(
  scriptPath: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, '..', scriptPath);
    const proc = spawn('npx', ['tsx', fullPath, ...args], {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject({ stdout, stderr, code });
      }
    });

    proc.on('error', (error) => {
      reject({ error: error.message, stdout, stderr });
    });
  });
}

/**
 * Execute a phase of the orchestration
 */
async function runPhase(
  name: string,
  emoji: string,
  scriptPath: string,
  args: string[] = []
): Promise<TaskResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${emoji} Phase: ${name}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const { stdout, stderr } = await runScript(scriptPath, args);
    const duration = Date.now() - startTime;

    console.log(`\n✅ ${name} completed in ${(duration / 1000).toFixed(2)}s\n`);

    return {
      name,
      emoji,
      success: true,
      duration,
      output: stdout,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`\n❌ ${name} failed after ${(duration / 1000).toFixed(2)}s`);
    if (error.error) console.error(`   Error: ${error.error}`);

    return {
      name,
      emoji,
      success: false,
      duration,
      error: error.error || error.stderr || 'Unknown error',
    };
  }
}

/**
 * Generate orchestration summary
 */
function printSummary() {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('ORCHESTRATION SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`✅ Successful Phases: ${successCount}/${results.length}`);
  console.log(`❌ Failed Phases: ${failureCount}/${results.length}\n`);

  console.log(`${'='.repeat(80)}`);
  console.log('Phase Results:');
  console.log(`${'='.repeat(80)}\n`);

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);

    console.log(`${status} ${result.emoji} ${result.name} (${duration}s)`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error.split('\n')[0]}`);
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);

  if (failureCount > 0) {
    console.error('⚠️  Some phases failed. Review the errors above.');
    console.error('   You can re-run individual phases manually.\n');
    return false;
  }

  console.log('✅ System Synchronized!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review any changes made to registry files');
  console.log('   2. Check validation reports in reports/ directory');
  console.log('   3. Commit changes to version control\n');
  return true;
}

/**
 * Main orchestration
 */
async function main() {
  console.log('🤖 MASTER DATABASE ORCHESTRATOR');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  try {
    // Phase 1: The Handshake (Local → DB)
    const sync = await runPhase('The Handshake: Local → Cloud', '🔄', 'syncAllRegistries.ts');
    results.push(sync);

    // Phase 2: The Diagnostic
    const validate = await runPhase(
      'The Diagnostic: Database Validation',
      '🔬',
      'validate_database.ts'
    );
    results.push(validate);

    // Phase 3: The Auto-Mechanic (only if exists)
    // Check if autoRepair.ts exists
    const autoRepairPath = path.join(__dirname, 'autoRepair.ts');
    const fs = await import('fs');
    if (fs.existsSync(autoRepairPath)) {
      const repair = await runPhase(
        'The Auto-Mechanic: Data Repair',
        '🚑',
        'maintenance/autoRepair.ts'
      );
      results.push(repair);
    } else {
      console.log('\n⏭️  Skipping Auto-Mechanic phase (autoRepair.ts not found)\n');
    }

    // Phase 4: The Write-Back (DB → Local)
    const backSync = await runPhase(
      'The Write-Back: Cloud → Local',
      '💾',
      'sync_db_to_registry.ts'
    );
    results.push(backSync);

    // Print summary
    const success = printSummary();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Orchestration failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
