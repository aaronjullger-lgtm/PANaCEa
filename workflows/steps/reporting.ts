import * as fs from 'node:fs';
import * as path from 'node:path';
import { getWritable } from 'workflow';

/** Workflow-safe lane report types (mirrors scripts/automation/shared/reporting). */
export type LaneTaskStatus = 'completed' | 'failed' | 'warning' | 'skipped';
export type LaneOverallStatus = 'pass' | 'fail' | 'warning';

export interface LaneTaskResult {
  name: string;
  status: LaneTaskStatus;
  message: string;
  duration?: number;
  details?: unknown;
  artifacts?: string[];
}

export interface LaneReport {
  lane: string;
  generatedAt: string;
  overallStatus: LaneOverallStatus;
  tasks: LaneTaskResult[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  metadata?: Record<string, unknown>;
}

export function createWorkflowLaneReport(
  lane: string,
  metadata?: Record<string, unknown>
): LaneReport {
  return {
    lane,
    generatedAt: new Date().toISOString(),
    overallStatus: 'pass',
    tasks: [],
    summary: {
      total: 0,
      completed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
    },
    metadata,
  };
}

export function appendTaskToReport(report: LaneReport, task: LaneTaskResult): void {
  report.tasks.push(task);
  report.summary.total += 1;

  switch (task.status) {
    case 'completed':
      report.summary.completed += 1;
      break;
    case 'failed':
      report.summary.failed += 1;
      break;
    case 'warning':
      report.summary.warnings += 1;
      break;
    case 'skipped':
      report.summary.skipped += 1;
      break;
  }
}

function finalizeLaneReport(report: LaneReport): LaneReport {
  if (report.summary.failed > 0) {
    report.overallStatus = 'fail';
  } else if (report.summary.warnings > 0) {
    report.overallStatus = 'warning';
  } else {
    report.overallStatus = 'pass';
  }
  return report;
}

function renderLaneMarkdown(title: string, report: LaneReport): string {
  const lines = [
    `## ${title}`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${report.overallStatus}`,
    `- Completed: ${report.summary.completed}`,
    `- Failed: ${report.summary.failed}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Skipped: ${report.summary.skipped}`,
    '',
    '### Tasks',
  ];

  for (const task of report.tasks) {
    lines.push(
      `- ${task.name}: ${task.status} - ${task.message}${task.duration ? ` (${task.duration}ms)` : ''}`
    );
  }

  return `${lines.join('\n')}\n`;
}

export async function persistLaneReport(
  report: LaneReport,
  slug: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  'use step';

  const dir = path.join(process.cwd(), 'artifacts', 'workflows');
  fs.mkdirSync(dir, { recursive: true });

  const finalized = finalizeLaneReport(report);
  const stamp = finalized.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(dir, `${slug}-${stamp}.json`);
  const markdownPath = path.join(dir, `${slug}-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(finalized, null, 2));
  fs.writeFileSync(markdownPath, renderLaneMarkdown(`${report.lane} Workflow Report`, finalized));

  return { jsonPath, markdownPath };
}

export async function streamLaneTaskEvent(task: LaneTaskResult): Promise<void> {
  'use step';

  const writer = getWritable<LaneTaskResult>({ namespace: 'lane:tasks' }).getWriter();
  try {
    await writer.write(task);
  } finally {
    writer.releaseLock();
  }
}
