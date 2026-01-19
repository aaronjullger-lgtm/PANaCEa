#!/usr/bin/env tsx
// @ts-nocheck
/**
 * PANCE Entry Generation Orchestrator
 * Runs all entry generators in sequence to fill database gaps
 *
 * Usage:
 *   npx tsx scripts/generators/run-all-entry-generators.ts
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const GENERATORS = [
  { name: 'ScoringSystem', script: 'scoring-system-generator.ts' },
  { name: 'LabTest', script: 'labtest-entry-generator.ts', args: ['--batch=200'] },
  { name: 'PhysicalExamFinding', script: 'physical-exam-entry-generator.ts' },
  { name: 'SpecialTest', script: 'special-test-entry-generator.ts' },
  { name: 'ECGPattern', script: 'ecg-pattern-entry-generator.ts' },
  { name: 'ImagingStudy', script: 'imaging-study-entry-generator.ts' },
  { name: 'Procedure', script: 'procedure-entry-generator.ts' },
  { name: 'PhysiologyConcept', script: 'physiology-concept-entry-generator.ts' },
  { name: 'DifferentialDiagnosis', script: 'differential-diagnosis-entry-generator.ts' },
];

const scriptsDir = path.join(process.cwd(), 'scripts', 'generators');

function runGenerator(
  scriptName: string,
  args: string[] = []
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(scriptsDir, scriptName);

    if (!existsSync(scriptPath)) {
      resolve({ success: false, output: `Script not found: ${scriptPath}` });
      return;
    }

    let output = '';
    const proc = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: '.env',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Filter out noisy warnings
      if (!text.includes('prisma:warn')) {
        process.stderr.write(text);
      }
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on('error', (error) => {
      resolve({ success: false, output: error.message });
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        PANCE ENTRY GENERATION ORCHESTRATOR                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const results: Array<{ name: string; success: boolean; duration: number }> = [];

  for (const generator of GENERATORS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Running: ${generator.name} Generator`);
    console.log(`   Script: ${generator.script}`);
    console.log(`${'='.repeat(70)}\n`);

    const genStart = Date.now();
    const result = await runGenerator(generator.script, generator.args || []);
    const duration = Math.round((Date.now() - genStart) / 1000);

    results.push({
      name: generator.name,
      success: result.success,
      duration,
    });

    if (!result.success) {
      console.error(`\n❌ ${generator.name} generator failed`);
    }

    // Brief pause between generators
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Summary
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    ORCHESTRATION SUMMARY                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log('Generator Results:');
  console.log('─'.repeat(50));
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const durationStr = `${Math.floor(result.duration / 60)}m ${result.duration % 60}s`;
    console.log(`${status} ${result.name.padEnd(25)} ${durationStr}`);
  }
  console.log('─'.repeat(50));
  console.log(`\nTotal: ${successCount} succeeded, ${failedCount} failed`);
  console.log(`Total time: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
}

main().catch(console.error);
