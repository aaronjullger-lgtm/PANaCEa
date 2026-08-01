/**
 * Agent Planning — Barrel Export
 *
 * Persistent file-based planning for PANaCEa agents.
 * Implements the planning-with-files pattern:
 *   task_plan.md + findings.md + progress.md on disk.
 *
 * @module lib/agents/planning
 */

export {
  createPlan,
  loadPlan,
  getActivePlan,
  addPhase,
  startPhase,
  completePhase,
  updateTask,
  addFinding,
  logProgress,
  addTestResult,
  isPlanComplete,
  getCompletionReport,
  getPlanDir,
  type PersistentPlan,
  type PlanPhase,
  type PlanFindings,
  type PlanProgress,
} from './persistent-plan';

export {
  scanForPlans,
  recoverLatestPlan,
  recoverPlanById,
  injectPlanContext,
  checkCompletionGate,
  type RecoveryResult,
} from './session-recovery';
