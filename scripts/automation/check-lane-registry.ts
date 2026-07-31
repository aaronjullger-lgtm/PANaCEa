/**
 * Lane registry validator — `npm run automation:lanes:check`
 *
 * Verifies config/automation-lanes.ts stays consistent with:
 *   1. .github/workflows/sched-*.yml  — every scheduled lane workflow must have
 *      a registry entry (orphan lane = error) and every entry must point at an
 *      existing workflow file.
 *   2. package.json scripts            — every npmScript referenced by a lane
 *      must exist; automation:* scripts not referenced by any lane are
 *      warnings (umbrella/legacy scripts are allowed).
 *
 * Exit code 1 on any error. Run in CI or locally after lane changes.
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTOMATION_LANES } from '../../config/automation-lanes';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOWS_DIR = join(ROOT, '.github/workflows');
const PACKAGE_JSON = join(ROOT, 'package.json');

let errors = 0;
let warnings = 0;

const error = (msg: string): void => {
  console.error(`ERROR: ${msg}`);
  errors += 1;
};

const warn = (msg: string): void => {
  console.warn(`WARN: ${msg}`);
  warnings += 1;
};

function main(): void {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};

  const schedWorkflows = readdirSync(WORKFLOWS_DIR)
    .filter((f) => /^sched-.*\.ya?ml$/.test(f))
    .sort();

  console.log(`Lane registry check: ${AUTOMATION_LANES.length} lanes, ${schedWorkflows.length} sched-* workflows\n`);

  // 1. Every registered lane must point at an existing workflow file.
  const registeredWorkflows = new Set<string>();
  for (const lane of AUTOMATION_LANES) {
    registeredWorkflows.add(lane.workflow);
    const wfPath = join(WORKFLOWS_DIR, lane.workflow);
    if (!existsSync(wfPath)) {
      error(`lane "${lane.slug}" references missing workflow "${lane.workflow}"`);
    }
    if (lane.npmScript && !scripts[lane.npmScript]) {
      error(`lane "${lane.slug}" references missing npm script "${lane.npmScript}"`);
    }
  }

  // 2. Every sched-* workflow must have a registry entry.
  for (const wf of schedWorkflows) {
    if (!registeredWorkflows.has(wf)) {
      error(`orphan lane workflow "${wf}" has no entry in config/automation-lanes.ts`);
    }
  }

  // 3. automation:* scripts should be referenced by a lane (warn-only).
  for (const scriptName of Object.keys(scripts)) {
    if (!scriptName.startsWith('automation:')) continue;
    const referenced = AUTOMATION_LANES.some((lane) => lane.npmScript === scriptName);
    if (!referenced) {
      warn(`automation script "${scriptName}" is not referenced by any lane (umbrella/legacy?)`);
    }
  }

  console.log('');
  if (errors > 0) {
    console.error(`FAIL: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  }
  console.log(`PASS: ${AUTOMATION_LANES.length} lanes consistent (${warnings} warning(s))`);
}

main();
