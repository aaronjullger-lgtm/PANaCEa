import * as fs from 'fs';
import * as path from 'path';

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

interface WriteLaneArtifactsOptions {
  directory: string;
  slug: string;
  title: string;
  report: LaneReport;
}

export function createLaneReport(lane: string, metadata?: Record<string, unknown>): LaneReport {
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

export function recordLaneTask(report: LaneReport, task: LaneTaskResult): void {
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

export function finalizeLaneReport(report: LaneReport): LaneReport {
  if (report.summary.failed > 0) {
    report.overallStatus = 'fail';
  } else if (report.summary.warnings > 0) {
    report.overallStatus = 'warning';
  } else {
    report.overallStatus = 'pass';
  }

  return report;
}

export function renderLaneMarkdownReport(title: string, report: LaneReport): string {
  const lines: string[] = [
    `## ${title}`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${report.overallStatus}`,
    `- Completed: ${report.summary.completed}`,
    `- Failed: ${report.summary.failed}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Skipped: ${report.summary.skipped}`,
  ];

  if (report.metadata && Object.keys(report.metadata).length > 0) {
    lines.push('', '### Metadata');
    for (const [key, value] of Object.entries(report.metadata)) {
      lines.push(`- ${key}: ${formatValue(value)}`);
    }
  }

  lines.push('', '### Tasks');

  for (const task of report.tasks) {
    lines.push(
      `- ${task.name}: ${task.status} - ${task.message}${task.duration ? ` (${task.duration}ms)` : ''}`
    );

    if (task.artifacts && task.artifacts.length > 0) {
      for (const artifact of task.artifacts) {
        lines.push(`  - artifact: ${artifact}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

export function writeLaneArtifacts({ directory, slug, title, report }: WriteLaneArtifactsOptions): {
  jsonPath: string;
  markdownPath: string;
} {
  const artifactDirectory = path.join(process.cwd(), directory);
  fs.mkdirSync(artifactDirectory, { recursive: true });

  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(artifactDirectory, `${slug}-${stamp}.json`);
  const markdownPath = path.join(artifactDirectory, `${slug}-${stamp}.md`);
  const markdown = renderLaneMarkdownReport(title, report);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, markdown);

  return { jsonPath, markdownPath };
}

export function appendWorkflowSummary(markdownPath: string): void {
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!stepSummaryPath || !fs.existsSync(markdownPath)) {
    return;
  }

  const markdown = fs.readFileSync(markdownPath, 'utf8');
  fs.appendFileSync(stepSummaryPath, `${markdown}\n`);
}

export function printLaneConsoleSummary(report: LaneReport): void {
  console.log(`\n=== ${report.lane} ===`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(
    `Summary: ${report.summary.completed} completed, ${report.summary.failed} failed, ${report.summary.warnings} warnings, ${report.summary.skipped} skipped`
  );

  for (const task of report.tasks) {
    const duration = task.duration ? ` (${task.duration}ms)` : '';
    console.log(`- ${task.name}: ${task.status}${duration}`);
    console.log(`  ${task.message}`);
  }

  console.log('');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}
