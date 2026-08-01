/**
 * Session Recovery & Plan Injection
 *
 * Implements the planning-with-files recovery pattern:
 *   1. On agent startup, scan for existing plan files
 *   2. Reconstruct the plan state from disk
 *   3. Inject the current plan into the agent's context each turn
 *   4. Provide a completion gate — agent won't stop until all phases done
 *
 * @module lib/agents/planning/session-recovery
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  getPlanDir,
  loadPlan,
  getActivePlan,
  getCompletionReport,
  isPlanComplete,
  type PersistentPlan,
} from './persistent-plan';

export interface RecoveryResult {
  recovered: boolean;
  plan: PersistentPlan | null;
  summary: string;
  nextPhase: string | null;
  pendingTaskCount: number;
}

export function scanForPlans(): string[] {
  const baseDir = getPlanDir();
  if (!existsSync(baseDir)) return [];

  return readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(baseDir, d.name, 'task_plan.md')))
    .map((d) => d.name)
    .sort()
    .reverse();
}

export function recoverLatestPlan(): RecoveryResult {
  const planIds = scanForPlans();

  if (planIds.length === 0) {
    return {
      recovered: false,
      plan: null,
      summary: 'No existing plans found. Create a new plan with createPlan().',
      nextPhase: null,
      pendingTaskCount: 0,
    };
  }

  const latestId = planIds[0]!;
  const plan = loadPlan(latestId);

  if (!plan) {
    return {
      recovered: false,
      plan: null,
      summary: `Plan ${latestId} found but could not be parsed.`,
      nextPhase: null,
      pendingTaskCount: 0,
    };
  }

  const pendingPhases = plan.phases.filter((p) => p.status !== 'completed');
  const pendingTasks = pendingPhases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status !== 'completed').length, 0);
  const nextPhase = plan.phases.find((p) => p.status === 'in_progress')?.name
    ?? pendingPhases[0]?.name
    ?? null;

  return {
    recovered: true,
    plan,
    summary: [
      `Recovered plan: "${plan.title}"`,
      `Phases: ${plan.phases.filter((p) => p.status === 'completed').length}/${plan.phases.length} complete`,
      `Pending tasks: ${pendingTasks}`,
      `Next phase: ${nextPhase ?? 'none — all phases complete'}`,
    ].join('\n'),
    nextPhase,
    pendingTaskCount: pendingTasks,
  };
}

export function recoverPlanById(planId: string): RecoveryResult {
  const plan = loadPlan(planId);

  if (!plan) {
    return {
      recovered: false,
      plan: null,
      summary: `Plan ${planId} not found.`,
      nextPhase: null,
      pendingTaskCount: 0,
    };
  }

  const pendingPhases = plan.phases.filter((p) => p.status !== 'completed');
  const pendingTasks = pendingPhases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status !== 'completed').length, 0);
  const nextPhase = plan.phases.find((p) => p.status === 'in_progress')?.name
    ?? pendingPhases[0]?.name
    ?? null;

  return {
    recovered: true,
    plan,
    summary: getCompletionReport(plan),
    nextPhase,
    pendingTaskCount: pendingTasks,
  };
}

export function injectPlanContext(): string {
  const plan = getActivePlan();
  if (!plan) return '';

  const report = getCompletionReport(plan);

  return [
    '===BEGIN PLAN DATA===',
    report,
    '',
    `Completion gate: ${isPlanComplete(plan) ? 'ALL PHASES COMPLETE — ready to stop' : `${plan.phases.filter((p) => p.status !== 'completed').length} phase(s) remaining — do NOT stop until all phases are [x]`}`,
    '===END PLAN DATA===',
  ].join('\n');
}

export function checkCompletionGate(): { canStop: boolean; reason: string } {
  const plan = getActivePlan();
  if (!plan) return { canStop: true, reason: 'No active plan' };

  if (isPlanComplete(plan)) {
    return { canStop: true, reason: 'All phases complete' };
  }

  const pending = plan.phases.filter((p) => p.status !== 'completed');
  const names = pending.map((p) => p.name).join(', ');

  return {
    canStop: false,
    reason: `${pending.length} phase(s) remaining: ${names}`,
  };
}
