import type { ApprovalKind, PendingApproval } from '../state/types';

export function createApprovalRequest(
  kind: ApprovalKind,
  opts?: { expiresInHours?: number }
): PendingApproval {
  const now = new Date();
  const expiresInHours = opts?.expiresInHours ?? 168; // 7 days
  const expiresAt = new Date(now.getTime() + expiresInHours * 3600_000).toISOString();

  return {
    id: `appr_${crypto.randomUUID()}`,
    kind,
    status: 'pending',
    requestedAt: now.toISOString(),
    expiresAt,
  };
}

export function resolveApproval(
  approval: PendingApproval,
  approved: boolean,
  resolvedBy: string,
  reason?: string
): PendingApproval {
  if (approval.status !== 'pending') {
    throw new Error(`Approval ${approval.id} is not pending (status=${approval.status})`);
  }

  const now = new Date();
  if (approval.expiresAt && now > new Date(approval.expiresAt)) {
    throw new Error(`Approval ${approval.id} has expired`);
  }

  return {
    ...approval,
    status: approved ? 'approved' : 'rejected',
    resolvedAt: now.toISOString(),
    resolvedBy,
    reason,
  };
}

export function findPendingApproval(
  approvals: PendingApproval[],
  kind: ApprovalKind
): PendingApproval | undefined {
  return approvals.find((a) => a.kind === kind && a.status === 'pending');
}

export function hasApproved(
  approvals: PendingApproval[],
  kind: ApprovalKind
): boolean {
  return approvals.some((a) => a.kind === kind && a.status === 'approved');
}
