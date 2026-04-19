#!/usr/bin/env tsx
/**
 * Weekly Automation Compatibility Runner
 *
 * This file is no longer the scheduled owner for PANaCEa's weekly automation.
 * Scheduled ownership has been split into:
 * - .github/workflows/sched-weekly-platform-report.yml
 * - .github/workflows/sched-weekly-maintenance.yml
 *
 * Keep this file as a manual compatibility wrapper so `npm run automation:weekly`
 * still works while the new purpose-based weekly lanes become the canonical owners.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const COMPATIBILITY_COMMANDS = [
  'npm run automation:weekly:report',
  'npm run automation:weekly:maintenance',
];

async function main() {
  console.log('Weekly automation has been split into purpose-based lanes.');
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

export { main as runWeeklyTasks };
