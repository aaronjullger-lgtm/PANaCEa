import { runTsxScript } from './steps/run-script';
import {
  appendTaskToReport,
  createWorkflowLaneReport,
  persistLaneReport,
  streamLaneTaskEvent,
} from './steps/reporting';
import type { LaneReport } from './steps/reporting';

export interface DbHealthCycleOptions {
  /** Sync local registries → database (default: true). */
  syncRegistries?: boolean;
  /** Validate database integrity (default: true). */
  validate?: boolean;
  /** Content quality check (default: true). */
  contentQuality?: boolean;
  /** Relationship validation (default: true). */
  relationships?: boolean;
  /** Duplicate detection — non-critical (default: true). */
  deduplicate?: boolean;
  /** Generate missing content shells — opt-in, may invoke AI (default: false). */
  generateContent?: boolean;
}

export interface DbHealthCycleResult {
  overallStatus: 'pass' | 'fail' | 'warning';
  reportPaths: { jsonPath: string; markdownPath: string };
  summary: LaneReport['summary'];
}

interface DbTask {
  name: string;
  script: string;
  critical: boolean;
  enabled: boolean;
}

export async function dbHealthCycleWorkflow(
  options: DbHealthCycleOptions = {}
): Promise<DbHealthCycleResult> {
  'use workflow';

  const {
    syncRegistries = true,
    validate = true,
    contentQuality = true,
    relationships = true,
    deduplicate = true,
    generateContent = false,
  } = options;

  const report = createWorkflowLaneReport('DB Health Cycle', {
    workflow: 'dbHealthCycleWorkflow',
    options,
    mirrors: 'scripts/orchestrate.ts',
  });

  const tasks: DbTask[] = [
    {
      name: 'Registry synchronization',
      script: 'scripts/syncAllRegistries.ts',
      critical: true,
      enabled: syncRegistries,
    },
    {
      name: 'Database validation',
      script: 'scripts/validate_database.ts',
      critical: true,
      enabled: validate,
    },
    {
      name: 'Content quality check',
      script: 'scripts/check_content_quality.ts',
      critical: true,
      enabled: contentQuality,
    },
    {
      name: 'Relationship validation',
      script: 'scripts/validate_relationships.ts',
      critical: true,
      enabled: relationships,
    },
    {
      name: 'Duplicate detection',
      script: 'scripts/deduplicate.ts',
      critical: false,
      enabled: deduplicate,
    },
    {
      name: 'Content generation',
      script: 'scripts/generate_content.ts',
      critical: false,
      enabled: generateContent,
    },
  ];

  for (const taskDef of tasks) {
    if (!taskDef.enabled) {
      const skipped = {
        name: taskDef.name,
        status: 'skipped' as const,
        message: 'Skipped by workflow options',
      };
      appendTaskToReport(report, skipped);
      await streamLaneTaskEvent(skipped);
      continue;
    }

    const start = Date.now();
    try {
      const result = await runTsxScript({
        script: taskDef.script,
        critical: taskDef.critical,
      });
      const status = result.exitCode === 0 ? ('completed' as const) : ('failed' as const);
      const task = {
        name: taskDef.name,
        status,
        message:
          result.exitCode === 0
            ? `Completed in ${result.durationMs}ms`
            : `Exit code ${result.exitCode}`,
        duration: result.durationMs,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);

      if (taskDef.critical && result.exitCode !== 0) {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const task = {
        name: taskDef.name,
        status: 'failed' as const,
        message,
        duration: Date.now() - start,
      };
      appendTaskToReport(report, task);
      await streamLaneTaskEvent(task);
      if (taskDef.critical) {
        break;
      }
    }
  }

  const reportPaths = await persistLaneReport(report, 'db-health-cycle');

  return {
    overallStatus:
      report.summary.failed > 0 ? 'fail' : report.summary.warnings > 0 ? 'warning' : 'pass',
    reportPaths,
    summary: report.summary,
  };
}
