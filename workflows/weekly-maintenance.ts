import { runTsxScript } from './steps/run-script';
import {
  appendTaskToReport,
  createWorkflowLaneReport,
  persistLaneReport,
  streamLaneTaskEvent,
} from './steps/reporting';
import type { LaneReport } from './steps/reporting';

export interface WeeklyMaintenanceOptions {
  dryRun?: boolean;
  retentionDays?: number;
  skipBackup?: boolean;
  skipRetentionCleanup?: boolean;
}

export interface WeeklyMaintenanceResult {
  overallStatus: 'pass' | 'fail' | 'warning';
  reportPaths: { jsonPath: string; markdownPath: string };
  summary: LaneReport['summary'];
}

export async function weeklyMaintenanceWorkflow(
  options: WeeklyMaintenanceOptions = {}
): Promise<WeeklyMaintenanceResult> {
  'use workflow';

  const {
    dryRun = false,
    retentionDays = 30,
    skipBackup = false,
    skipRetentionCleanup = false,
  } = options;

  const report = createWorkflowLaneReport('Weekly Maintenance', {
    workflow: 'weeklyMaintenanceWorkflow',
    scheduler: '.github/workflows/sched-weekly-maintenance.yml',
    options,
  });

  const args: string[] = [];
  if (dryRun) args.push('--dry-run');
  if (skipBackup) args.push('--skip-backup');
  if (skipRetentionCleanup) args.push('--skip-retention-cleanup');
  args.push('--retention-days', String(retentionDays));

  const start = Date.now();
  try {
    const result = await runTsxScript({
      script: 'scripts/automation/weeklyMaintenance.ts',
      args,
      critical: true,
    });
    const task = {
      name: 'Weekly maintenance lane',
      status: 'completed' as const,
      message: `weeklyMaintenance.ts completed (${result.durationMs}ms)`,
      duration: result.durationMs,
    };
    appendTaskToReport(report, task);
    await streamLaneTaskEvent(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const task = {
      name: 'Weekly maintenance lane',
      status: 'failed' as const,
      message,
      duration: Date.now() - start,
    };
    appendTaskToReport(report, task);
    await streamLaneTaskEvent(task);
  }

  const reportPaths = await persistLaneReport(report, 'weekly-maintenance');

  return {
    overallStatus: report.summary.failed > 0 ? 'fail' : 'pass',
    reportPaths,
    summary: report.summary,
  };
}
