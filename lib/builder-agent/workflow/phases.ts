/**
 * Build workflow phase definitions (15 durable phases).
 */

export const BUILD_PHASES = [
  { id: 'intake', name: 'Intake and normalization', checkpoint: 'intake_complete' },
  { id: 'context', name: 'Context collection', checkpoint: 'context_complete' },
  { id: 'risk', name: 'Risk and scope classification', checkpoint: 'risk_complete' },
  { id: 'spec', name: 'Specification creation', checkpoint: 'spec_complete' },
  { id: 'plan', name: 'Implementation planning', checkpoint: 'plan_complete' },
  { id: 'approval', name: 'Approval when required', checkpoint: 'approval_complete' },
  { id: 'workspace', name: 'Workspace preparation', checkpoint: 'workspace_complete' },
  { id: 'implement', name: 'Implementation', checkpoint: 'implement_complete' },
  { id: 'validate', name: 'Local validation', checkpoint: 'validate_complete' },
  { id: 'branch', name: 'Branch and commit creation', checkpoint: 'branch_complete' },
  { id: 'pr', name: 'Pull-request creation', checkpoint: 'pr_complete' },
  { id: 'ci_monitor', name: 'CI and review monitoring', checkpoint: 'ci_complete' },
  { id: 'revise', name: 'Revision loop', checkpoint: 'revise_complete' },
  { id: 'final_approval', name: 'Final approval', checkpoint: 'final_approval_complete' },
  { id: 'complete', name: 'Completion and audit summary', checkpoint: 'run_complete' },
] as const;

export type BuildPhaseId = (typeof BUILD_PHASES)[number]['id'];

export function getPhase(id: BuildPhaseId) {
  return BUILD_PHASES.find((p) => p.id === id);
}

export function nextPhase(current: BuildPhaseId): BuildPhaseId | null {
  const idx = BUILD_PHASES.findIndex((p) => p.id === current);
  if (idx < 0 || idx >= BUILD_PHASES.length - 1) return null;
  return BUILD_PHASES[idx + 1]!.id;
}
