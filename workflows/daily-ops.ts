import { runTsxScript } from './steps/run-script';
import {
  appendTaskToReport,
  createWorkflowLaneReport,
  persistLaneReport,
  streamLaneTaskEvent,
} from './steps/reporting';
import type { LaneReport } from './steps/reporting';

export interface DailyOpsOptions {
  reportOnly?: boolean;
  skipPlatformRollup?: boolean;
  skipContentRollup?: boolean;
}

export interface DailyOpsResult {
  overallStatus: 'pass' | 'fail' | 'warning';
  reportPaths: { jsonPath: string; markdownPath: string };
  summary: LaneReport['summary'];
}

export async function dailyOpsWorkflow(options: DailyOpsOptions = {}): Promise<DailyOpsResult> {
  'use workflow';

  const { reportOnly = false, skipPlatformRollup = false, skipContentRollup = false } = options;

  const report = createWorkflowLaneReport('Daily Ops', {
    workflow: 'dailyOpsWorkflow',
    scheduler: '.github/workflows/sched-daily-ops.yml',
    options,
  });

  const args: string[] = [];
  if (reportOnly) args.push('--report-only');
  if (skipPlatformRollup) args.push('--skip-platform-rollup');
  if (skipContentRollup) args.push('--skip-content-rollup');

  const start = Date.now();
  try {
    const result = await runTsxScript({
      script: 'scripts/automation/dailyOps.ts',
      args,
      critical: true,
    });
    const task = {
      name: 'Daily ops lane',
      status: 'completed' as const,
      message: `dailyOps.ts completed (${result.durationMs}ms)`,
      duration: result.durationMs,
    };
    appendTaskToReport(report, task);
    await streamLaneTaskEvent(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const task = {
      name: 'Daily ops lane',
      status: 'failed' as const,
      message,
      duration: Date.now() - start,
    };
    appendTaskToReport(report, task);
    await streamLaneTaskEvent(task);
  }

  const reportPaths = await persistLaneReport(report, 'daily-ops');

  return {
    overallStatus: report.summary.failed > 0 ? 'fail' : 'pass',
    reportPaths,
    summary: report.summary,
  };
}
