import { runNpmScript } from './steps/run-script';
import {
  appendTaskToReport,
  createWorkflowLaneReport,
  persistLaneReport,
  streamLaneTaskEvent,
} from './steps/reporting';
import type { LaneReport } from './steps/reporting';

export interface VerifyChangeOptions {
  /** Run production typecheck (default: true). */
  typecheck?: boolean;
  /** Run critical FSRS/session test suite (default: true). */
  criticalTests?: boolean;
  /** Run production Vite build (default: false — slower). */
  build?: boolean;
  /** Optional Vitest file paths for targeted checks before widening. */
  targetedTests?: string[];
}

export interface VerifyChangeResult {
  overallStatus: 'pass' | 'fail' | 'warning';
  reportPaths: { jsonPath: string; markdownPath: string };
  summary: LaneReport['summary'];
}

async function runTargetedVitest(testPath: string) {
  'use step';
  return runNpmScript({
    script: 'test',
    args: [testPath],
    critical: true,
  });
}

export async function verifyChangeWorkflow(
  options: VerifyChangeOptions = {}
): Promise<VerifyChangeResult> {
  'use workflow';

  const {
    typecheck = true,
    criticalTests = true,
    build = false,
    targetedTests = [],
  } = options;

  const report = createWorkflowLaneReport('Change Verification', {
    workflow: 'verifyChangeWorkflow',
    options,
  });

  for (const testPath of targetedTests) {
    const start = Date.now();
    try {
      const result = await runTargetedVitest(testPath);
      const task = {
        name: `Targeted test: ${testPath}`,
        status: 'completed' as const,
        message: `Exit ${result.exitCode}`,
        duration: result.durationMs,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const task = {
        name: `Targeted test: ${testPath}`,
        status: 'failed' as const,
        message,
        duration: Date.now() - start,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    }
  }

  if (typecheck) {
    const start = Date.now();
    try {
      const result = await runNpmScript({ script: 'typecheck', critical: true });
      const task = {
        name: 'Typecheck',
        status: 'completed' as const,
        message: `tsc --noEmit passed (${result.durationMs}ms)`,
        duration: result.durationMs,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const task = {
        name: 'Typecheck',
        status: 'failed' as const,
        message,
        duration: Date.now() - start,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    }
  }

  if (criticalTests) {
    const start = Date.now();
    try {
      const result = await runNpmScript({ script: 'test:critical', critical: true });
      const task = {
        name: 'Critical tests',
        status: 'completed' as const,
        message: `test:critical passed (${result.durationMs}ms)`,
        duration: result.durationMs,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const task = {
        name: 'Critical tests',
        status: 'failed' as const,
        message,
        duration: Date.now() - start,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    }
  }

  if (build) {
    const start = Date.now();
    try {
      const result = await runNpmScript({ script: 'build', critical: true });
      const task = {
        name: 'Production build',
        status: 'completed' as const,
        message: `build passed (${result.durationMs}ms)`,
        duration: result.durationMs,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const task = {
        name: 'Production build',
        status: 'failed' as const,
        message,
        duration: Date.now() - start,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
    }
  }

  const reportPaths = await persistLaneReport(report, 'verify-change');

  return {
    overallStatus: report.summary.failed > 0 ? 'fail' : 'pass',
    reportPaths,
    summary: report.summary,
  };
}
