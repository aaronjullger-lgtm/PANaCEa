/**
 * Automation lane registry — machine-checkable single source of truth for the
 * scheduled automation lanes.
 *
 * Mirrors the human-readable schedule matrix in docs/automation/README.md.
 * Keep this file and the matrix in sync when lanes change; the validator
 * (scripts/automation/check-lane-registry.ts, `npm run automation:lanes:check`)
 * fails when:
 *   - a sched-*.yml workflow exists without a registry entry (orphan lane)
 *   - a registered lane references a workflow file that does not exist
 *   - a registered lane references an npm script that is not in package.json
 */

export interface AutomationLane {
  /** Stable lane identifier (used for docs, runs, and concurrency groups). */
  slug: string;
  /** Human-readable lane name. */
  name: string;
  /** Workflow file under .github/workflows/ that runs this lane. */
  workflow: string;
  /** Cron schedule as declared in the workflow. */
  cron: string;
  /** Primary npm script invoked by the lane, if any. */
  npmScript?: string;
  /** Production cron endpoints fanned out by the lane (METHOD PATH). */
  endpoints?: string[];
  /** What the lane does, for operator reference. */
  purpose: string;
}

export const AUTOMATION_LANES: AutomationLane[] = [
  {
    slug: 'runtime-sanity',
    name: 'Runtime Sanity',
    workflow: 'sched-runtime-sanity.yml',
    cron: '17 * * * *',
    npmScript: 'automation:hourly',
    purpose: 'Hourly health sanity checks against the live stack.',
  },
  {
    slug: 'reservoir-supply',
    name: 'Reservoir Supply',
    workflow: 'sched-reservoir-supply.yml',
    cron: '25 */2 * * *',
    endpoints: ['POST /api/cron/reservoir-maintenance', 'POST /api/cron/replenish-pool'],
    purpose: 'Every-2h question reservoir maintenance and pool replenishment via production cron endpoints.',
  },
  {
    slug: 'daily-learning-models',
    name: 'Daily Learning Models',
    workflow: 'sched-daily-learning-models.yml',
    cron: '13 3 * * *',
    npmScript: 'automation:daily:learning-models',
    purpose: 'Daily refresh of user learning models and derived profiles.',
  },
  {
    slug: 'daily-ops',
    name: 'Daily Ops',
    workflow: 'sched-daily-ops.yml',
    cron: '27 4 * * *',
    npmScript: 'automation:daily:ops',
    endpoints: [
      'POST /api/cron/aggregate-analytics',
      'POST /api/cron/aggregate-distributions',
      'POST /api/cron/daily-prescription',
      'POST /api/cron/generate-daily-insights',
    ],
    purpose: 'Daily repo rollups plus analytics and personalization production endpoint fanout.',
  },
  {
    slug: 'content-audit',
    name: 'Content Audit',
    workflow: 'sched-content-audit.yml',
    cron: '41 5 * * *',
    npmScript: 'automation:daily:content-audit',
    purpose: 'Daily clinical content audit plus DB health and completeness checks.',
  },
  {
    slug: 'weekly-platform-report',
    name: 'Weekly Platform Report',
    workflow: 'sched-weekly-platform-report.yml',
    cron: '18 6 * * 0',
    npmScript: 'automation:weekly:report',
    purpose: 'Weekly progress report, progress audit, and psychometric snapshot.',
  },
  {
    slug: 'weekly-maintenance',
    name: 'Weekly Maintenance',
    workflow: 'sched-weekly-maintenance.yml',
    cron: '47 7 * * 0',
    npmScript: 'automation:weekly:maintenance',
    purpose: 'Weekly maintenance: backups and background-job retention cleanup.',
  },
  {
    slug: 'weekly-repo-hygiene',
    name: 'Weekly Repo Hygiene',
    workflow: 'sched-weekly-repo-hygiene.yml',
    cron: '23 8 * * 6',
    npmScript: 'automation:weekly:repo-hygiene',
    purpose: 'Weekly repository hygiene pass (dead code, duplicate paths, docs drift).',
  },
  {
    slug: 'monthly-deep-audit',
    name: 'Monthly Deep Audit',
    workflow: 'sched-monthly-deep-audit.yml',
    cron: '29 9 1 * *',
    npmScript: 'automation:monthly:deep-audit',
    purpose: 'Monthly deep audit of platform data and governance.',
  },
];
