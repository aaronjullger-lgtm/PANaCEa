/**
 * Approval policy — which actions require human approval.
 */

import type { ApprovalKind, BuilderRunState } from '../state/types';

export interface RiskClassification {
  level: 'low' | 'medium' | 'high';
  reasons: string[];
  requiresPlanApproval: boolean;
}

const HIGH_RISK_PATTERNS = [
  /\bprisma\b/i,
  /\bmigration\b/i,
  /\bschema\.prisma\b/i,
  /\bauth\b/i,
  /\brls\b/i,
  /\bwrangler\b/i,
  /\bdeploy\b/i,
  /\bsecret\b/i,
  /\bcredential\b/i,
  /\bfsrs\b/i,
  /\bprocess\.env\b/i,
];

export function classifyRisk(objective: string, metadata?: Record<string, unknown>): RiskClassification {
  const reasons: string[] = [];
  let level: RiskClassification['level'] = 'low';

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(objective)) {
      reasons.push(`Matched risk pattern: ${pattern.source}`);
      level = 'high';
    }
  }

  if (metadata?.touchesDatabase === true) {
    reasons.push('Metadata indicates database changes');
    level = 'high';
  }

  if (metadata?.touchesAuth === true) {
    reasons.push('Metadata indicates auth changes');
    level = 'high';
  }

  if (level === 'low' && objective.length > 500) {
    level = 'medium';
    reasons.push('Large objective scope');
  }

  return {
    level,
    reasons,
    requiresPlanApproval: level !== 'low',
  };
}

export function approvalRequiredFor(kind: ApprovalKind): boolean {
  // plan may be conditional; merge/deploy/infra/credentials always require approval
  switch (kind) {
    case 'plan':
      return false; // evaluated via classifyRisk
    case 'merge':
    case 'deploy':
    case 'infrastructure':
    case 'credentials':
      return true;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function canMerge(run: BuilderRunState): boolean {
  if (run.dryRun) return false;
  const mergeApproval = run.pendingApprovals.find(
    (a) => a.kind === 'merge' && a.status === 'approved'
  );
  return Boolean(mergeApproval);
}

export function canDeploy(run: BuilderRunState): boolean {
  if (run.dryRun) return false;
  return run.pendingApprovals.some(
    (a) => a.kind === 'deploy' && a.status === 'approved'
  );
}

export function prohibitedWithoutApproval(
  action: 'merge' | 'deploy' | 'infrastructure' | 'credentials',
  run: BuilderRunState
): string | null {
  if (run.dryRun && (action === 'merge' || action === 'deploy')) {
    return `${action} is disabled while dry-run mode is active`;
  }
  switch (action) {
    case 'merge':
      return canMerge(run) ? null : 'Merge requires explicit merge approval';
    case 'deploy':
      return canDeploy(run) ? null : 'Deploy requires explicit deploy approval';
    case 'infrastructure':
      return run.pendingApprovals.some(
        (a) => a.kind === 'infrastructure' && a.status === 'approved'
      )
        ? null
        : 'Infrastructure changes require explicit approval';
    case 'credentials':
      return run.pendingApprovals.some(
        (a) => a.kind === 'credentials' && a.status === 'approved'
      )
        ? null
        : 'Credential changes require explicit approval';
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
