#!/usr/bin/env tsx
/**
 * Daily Automation Compatibility Runner
 *
 * This file is no longer the scheduled owner for PANaCEa's daily automation.
 * Scheduled ownership has been split into:
 * - .github/workflows/sched-daily-learning-models.yml
 * - .github/workflows/sched-daily-ops.yml
 * - .github/workflows/sched-content-audit.yml
 *
 * Keep this file as a manual compatibility wrapper so operator muscle memory
 * around `npm run automation:daily` does not break while the new lane-specific
 * entrypoints become the canonical owners.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const COMPATIBILITY_COMMANDS = [
  'npm run automation:daily:learning-models',
  'npm run automation:daily:ops',
  'npm run automation:daily:content-audit',
];

async function main() {
  console.log('Daily automation has been split into purpose-based lanes.');
  console.log('Running the manual compatibility wrapper in sequence:\n');

  for (const command of COMPATIBILITY_COMMANDS) {
    console.log(`> ${command}`);
    execSync(command, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    console.log('');
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { main as runDailyTasks };
