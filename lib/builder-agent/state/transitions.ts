/**
 * Validated state transitions for Builder Agent runs.
 */

import type { BuilderRunStatus } from './types';

const TRANSITIONS: Record<BuilderRunStatus, readonly BuilderRunStatus[]> = {
  intake: ['analyzing', 'canceled', 'failed'],
  analyzing: ['awaiting_plan_approval', 'approved', 'failed', 'canceled'],
  awaiting_plan_approval: ['approved', 'failed', 'canceled'],
  approved: ['executing', 'failed', 'canceled'],
  executing: ['testing', 'failed', 'canceled'],
  testing: ['awaiting_pr_review', 'revising', 'failed', 'canceled'],
  awaiting_pr_review: ['revising', 'awaiting_merge_approval', 'completed', 'failed', 'canceled'],
  revising: ['testing', 'awaiting_pr_review', 'failed', 'canceled'],
  awaiting_merge_approval: ['completed', 'failed', 'canceled'],
  completed: [],
  failed: [],
  canceled: [],
};

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: BuilderRunStatus,
    public readonly to: BuilderRunStatus
  ) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function canTransition(
  from: BuilderRunStatus,
  to: BuilderRunStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: BuilderRunStatus,
  to: BuilderRunStatus
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

export function isTerminal(status: BuilderRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'canceled';
}

export function nextStatuses(from: BuilderRunStatus): readonly BuilderRunStatus[] {
  return TRANSITIONS[from] ?? [];
}
