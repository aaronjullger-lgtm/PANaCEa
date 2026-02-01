#!/usr/bin/env tsx
/**
 * Seed runner: runs the minimal required seeds in order.
 * 1. seed:registry (conditions from registry)
 * 2. seed:question-pool
 *
 * Usage: npm run seed  OR  npm run db:seed
 * For optional seeds (drills, OSCE, buzzwords, etc.), run those scripts individually.
 */

import { spawn } from 'child_process';

const scripts: { name: string; script: string }[] = [
  { name: 'seed:registry', script: 'seed:registry' },
  { name: 'seed:question-pool', script: 'seed:question-pool' },
];

function runNpmScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  console.log('Running minimal seed set (registry → question-pool)...\n');
  for (const { name, script } of scripts) {
    console.log(`> ${name}`);
    await runNpmScript(script);
    console.log('');
  }
  console.log('Seed run completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
