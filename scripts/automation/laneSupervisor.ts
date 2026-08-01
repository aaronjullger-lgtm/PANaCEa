#!/usr/bin/env tsx
/**
 * Automation Lane Supervisor
 *
 * Registry-driven dispatcher and status reporter for the scheduled automation
 * lanes. Reads the single source of truth (config/automation-lanes.ts), validates
 * each lane's declared workflow + npm script, and optionally executes lanes
 * locally with captured logs and per-lane report artifacts.
 *
 * Scheduler owner: GitHub Actions (sched-*.yml) — this script is the local
 * operator counterpart; it never replaces the scheduled workflows.
 *
 * Usage:
 *   npm run automation:supervise              # validation + status (no execution)
 *   npm run automation:supervise -- --check   # strict registry validation (exit 1 on errors)
 *   npm run automation:supervise -- --run <slug>     # execute one lane's npm script
 *   npm run automation:supervise -- --run-all        # execute every lane with an npm script
 *
 * Safety notes:
 *   - Lanes that only fan out production cron endpoints (no npmScript) are
 *     reported as skipped for local execution — never dispatched from here.
 *   - Execution is sequential and log-captured via scripts/automation/shared.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AUTOMATION_LANES, type AutomationLane } from '../../config/automation-lanes';
import { runCapturedCommand } from './shared/commandRunner';
import {
  createLaneReport,
  finalizeLaneReport,
  printLaneConsoleSummary,
  recordLaneTask,
  writeLaneArtifacts,
} from './shared/reporting';

const WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');
const ARTIFACT_DIR = 'logs/automation-supervisor';

interface CliOptions {
  check: boolean;
  runAll: boolean;
  runSlug?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { check: false, runAll: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--run-all') {
      options.runAll = true;
    } else if (arg === '--run' && argv[i + 1]) {
      options.runSlug = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return options;
}

function printUsage(): void {
  console.log(
    [
      'Automation Lane Supervisor',
      '',
      'Usage:',
      '  npm run automation:supervise              validation + status (default)',
      '  npm run automation:supervise -- --check    strict validation (exit 1 on any error)',
      '  npm run automation:supervise -- --run <slug>   execute one lane',
      '  npm run automation:supervise -- --run-all      execute all script-backed lanes',
    ].join('\n')
  );
}

function readPackageScripts(): Map<string, string> {
  const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  return new Map(Object.entries(pkg.scripts ?? {}));
}

function workflowExists(lane: AutomationLane): boolean {
  return fs.existsSync(path.join(WORKFLOW_DIR, lane.workflow));
}

interface LaneValidation {
  lane: AutomationLane;
  workflowOk: boolean;
  scriptOk: boolean;
  scriptValue?: string;
}

function validateLane(lane: AutomationLane, scripts: Map<string, string>): LaneValidation {
  const scriptValue = lane.npmScript ? scripts.get(lane.npmScript) : undefined;
  return {
    lane,
    workflowOk: workflowExists(lane),
    scriptOk: lane.npmScript ? scriptValue !== undefined : true,
    scriptValue,
  };
}

async function runLane(lane: AutomationLane): Promise<{ exitCode: number; durationMs: number }> {
  if (!lane.npmScript) {
    throw new Error(`lane ${lane.slug} has no npmScript — production endpoint fanout is never dispatched locally`);
  }

  const result = await runCapturedCommand({
    command: 'npm',
    args: ['run', lane.npmScript, '--silent'],
    logDirectory: path.join(ARTIFACT_DIR, 'logs'),
    logSlug: lane.slug,
  });

  return { exitCode: result.exitCode, durationMs: result.durationMs };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const scripts = readPackageScripts();
  const validations = AUTOMATION_LANES.map((lane) => validateLane(lane, scripts));

  // ── Strict check mode ────────────────────────────────────────────────────
  if (options.check) {
    const errors: string[] = [];
    for (const v of validations) {
      if (!v.workflowOk) {
        errors.push(`lane ${v.lane.slug}: workflow ${v.lane.workflow} not found`);
      }
      if (!v.scriptOk) {
        errors.push(`lane ${v.lane.slug}: npm script ${v.lane.npmScript} not found in package.json`);
      }
    }
    if (errors.length > 0) {
      console.error(`FAIL: ${errors.length} lane error(s)`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
    console.log(`PASS: ${AUTOMATION_LANES.length} lanes consistent with registry`);
    process.exit(0);
  }

  // ── Report (status or execution results) ─────────────────────────────────
  const report = createLaneReport('Automation Lane Supervisor', {
    mode: options.runAll ? 'run-all' : options.runSlug ? `run:${options.runSlug}` : 'status',
    lanesRegistered: AUTOMATION_LANES.length,
  });

  const toExecute: LaneValidation[] = [];
  for (const v of validations) {
    if (!v.workflowOk) {
      recordLaneTask(report, {
        name: `${v.lane.slug} (${v.lane.workflow})`,
        status: 'failed',
        message: `workflow file not found in .github/workflows`,
      });
      continue;
    }
    if (v.lane.npmScript && !v.scriptOk) {
      recordLaneTask(report, {
        name: `${v.lane.slug} (${v.lane.workflow})`,
        status: 'warning',
        message: `npm script "${v.lane.npmScript}" missing from package.json — registry drift`,
      });
      continue;
    }
    if (!v.lane.npmScript) {
      recordLaneTask(report, {
        name: `${v.lane.slug} (${v.lane.workflow})`,
        status: 'skipped',
        message: `production endpoint fanout (${v.lane.endpoints?.length ?? 0} endpoints) — not dispatched locally`,
      });
      continue;
    }
    if (options.runAll || options.runSlug === v.lane.slug) {
      toExecute.push(v);
    } else {
      recordLaneTask(report, {
        name: `${v.lane.slug} (${v.lane.workflow})`,
        status: 'completed',
        message: `ready — npm run ${v.lane.npmScript} (cron ${v.lane.cron})`,
      });
    }
  }

  // ── Execution ────────────────────────────────────────────────────────────
  if (options.runSlug && toExecute.length === 0) {
    recordLaneTask(report, {
      name: `--run ${options.runSlug}`,
      status: 'failed',
      message: `no executable lane matched (check the slug or npmScript presence)`,
    });
  }

  for (const v of toExecute) {
    try {
      const { exitCode, durationMs } = await runLane(v.lane);
      recordLaneTask(report, {
        name: `${v.lane.slug} (npm run ${v.lane.npmScript})`,
        status: exitCode === 0 ? 'completed' : 'failed',
        message: exitCode === 0 ? `exit 0` : `exit ${exitCode}`,
        duration: durationMs,
        artifacts: [path.join(ARTIFACT_DIR, 'logs', `${v.lane.slug}.log`)],
      });
    } catch (error) {
      recordLaneTask(report, {
        name: `${v.lane.slug} (npm run ${v.lane.npmScript})`,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: ARTIFACT_DIR,
    slug: 'lane-supervisor',
    title: 'Automation Lane Supervisor Report',
    report,
  });
  console.log(`Artifacts: ${artifacts.jsonPath} | ${artifacts.markdownPath}`);

  process.exit(report.overallStatus === 'fail' ? 1 : 0);
}

main().catch((error) => {
  console.error('Lane supervisor failed:', error);
  process.exit(1);
});
