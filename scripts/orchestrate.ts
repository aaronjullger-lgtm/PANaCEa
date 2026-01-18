#!/usr/bin/env tsx
/**
 * Database Automation Orchestrator
 * Runs all validation, quality checks, and content generation in sequence
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Task {
  name: string;
  script: string;
  args?: string[];
  description: string;
  critical: boolean;
}

const TASKS: Task[] = [
  // 1. THE BRIDGE: Ensure DB has all the rows from your .ts files
  {
    name: 'Registry Synchronization',
    script: 'syncAllRegistries.ts',
    description: 'Upsert local registry files (Conditions, Drugs) to Database',
    critical: true, // If this fails, there is nothing to validate
  },
  // 2. THE CHECKUP: Are the rows we just synced valid?
  {
    name: 'Database Validation',
    script: 'validate_database.ts',
    description: 'Check for missing fields (nulls) and data format issues',
    critical: true,
  },
  // 3. THE CONTENT AUDIT: Do they have the actual text?
  {
    name: 'Content Quality Check',
    script: 'check_content_quality.ts',
    description: 'Verify required sections (symptoms, treatment) exist and aren\'t "TBD"',
    critical: true,
  },
  // 4. THE RELATIONSHIPS: Are the links broken?
  {
    name: 'Relationship Validation',
    script: 'validate_relationships.ts',
    description: 'Ensure Conditions link to valid Systems/Categories',
    critical: true,
  },
  // 5. THE CLEANUP
  {
    name: 'Duplicate Detection',
    script: 'deduplicate.ts',
    description: 'Find and report duplicate conditions',
    critical: false,
  },
  // 6. THE FIX: Fill the empty shells found in steps 2 & 3
  {
    name: 'Content Generation',
    script: 'generate_content.ts',
    args: ['--limit=5'], // Removed dry-run for production fix, or keep for safety
    description: 'Generate missing content sections using Gemini 2.5 Pro',
    critical: false,
  },
];

interface TaskResult {
  task: Task;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

const results: TaskResult[] = [];

function runScript(
  scriptPath: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    const proc = spawn('npx', ['tsx', fullPath, ...args], {
      cwd: path.join(__dirname, '..'),
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

async function runTask(task: Task): Promise<TaskResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Running: ${task.name}`);
  console.log(`   ${task.description}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const { stdout, stderr } = await runScript(task.script, task.args);
    const duration = Date.now() - startTime;

    console.log(`\n✅ ${task.name} completed in ${(duration / 1000).toFixed(2)}s\n`);

    return {
      task,
      success: true,
      duration,
      output: stdout,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`\n❌ ${task.name} failed after ${(duration / 1000).toFixed(2)}s`);
    if (error.error) console.error(`   Error: ${error.error}`);

    return {
      task,
      success: false,
      duration,
      error: error.error || error.stderr || 'Unknown error',
    };
  }
}

async function generateSummaryReport() {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('AUTOMATION SUMMARY');
  console.log(`${'='.repeat(80)}`);

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;
  const criticalFailures = results.filter((r) => !r.success && r.task.critical);

  console.log(`\nTotal Tasks: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  if (criticalFailures.length > 0) {
    console.log(`🚨 Critical Failures: ${criticalFailures.length}`);
  }
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  console.log(`\n${'='.repeat(80)}`);
  console.log('Task Details:');
  console.log(`${'='.repeat(80)}\n`);

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const critical = result.task.critical ? '🚨' : '  ';
    const duration = (result.duration / 1000).toFixed(2);

    console.log(`${status} ${critical} ${result.task.name} (${duration}s)`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error.split('\n')[0]}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);

  // Check for generated reports
  const reportDir = path.join(__dirname, '../reports');
  if (fs.existsSync(reportDir)) {
    const files = fs
      .readdirSync(reportDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 10);

    if (files.length > 0) {
      console.log('\n📄 Recent Reports Generated:');
      for (const file of files) {
        const stats = fs.statSync(path.join(reportDir, file));
        const time = stats.mtime.toLocaleString();
        console.log(`   - ${file} (${time})`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);

  // Save automation log
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logDir, `automation-${timestamp}.json`);

  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalTasks: results.length,
          successful: successCount,
          failed: failureCount,
          criticalFailures: criticalFailures.length,
          totalDuration,
        },
        results: results.map((r) => ({
          task: r.task.name,
          success: r.success,
          duration: r.duration,
          error: r.error,
        })),
      },
      null,
      2
    )
  );

  console.log(`📝 Automation log saved to: ${logPath}\n`);

  return criticalFailures.length === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const skipGeneration = args.includes('--skip-generation');
  const quickMode = args.includes('--quick');

  console.log('🤖 DATABASE AUTOMATION ORCHESTRATOR');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Mode: ${quickMode ? 'Quick' : 'Full'} ${skipGeneration ? '(no generation)' : ''}`);
  console.log('='.repeat(80));

  try {
    let tasksToRun = TASKS;

    if (skipGeneration) {
      tasksToRun = TASKS.filter((t) => t.name !== 'Content Generation');
    }

    if (quickMode) {
      // In quick mode, only run critical tasks
      tasksToRun = tasksToRun.filter((t) => t.critical);
    }

    for (const task of tasksToRun) {
      const result = await runTask(task);
      results.push(result);

      // If critical task fails, ask whether to continue
      if (!result.success && task.critical) {
        console.warn(`\n⚠️  Critical task "${task.name}" failed!`);
        console.warn('   Continuing with remaining tasks...\n');
      }
    }

    const allCriticalTasksSucceeded = await generateSummaryReport();

    if (!allCriticalTasksSucceeded) {
      console.error('❌ Some critical tasks failed. Review the errors above.');
      process.exit(1);
    }

    console.log('✅ Automation completed successfully!\n');
  } catch (error) {
    console.error('❌ Automation orchestrator failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
