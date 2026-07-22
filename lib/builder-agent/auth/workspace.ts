/**
 * Workspace isolation — callers cannot access workspaces outside the allowlist.
 */

import { AuthError } from './policy';

export const DEFAULT_WORKSPACE_ID = 'panacea';

export function parseAllowedWorkspaces(raw?: string): ReadonlySet<string> {
  const value = raw?.trim() || DEFAULT_WORKSPACE_ID;
  const workspaces = value
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
  return new Set(workspaces);
}

/**
 * Resolve the workspace for this request. Rejects cross-workspace access.
 * Client-provided workspaceId is honored only when it is in the allowlist.
 */
export function resolveAuthorizedWorkspace(
  requested: string | null | undefined,
  allowed: ReadonlySet<string>,
  fallback: string = DEFAULT_WORKSPACE_ID
): string {
  const candidate = (requested?.trim() || fallback).trim();
  if (!candidate) {
    throw new AuthError('Workspace is required', 400);
  }
  if (!allowed.has(candidate)) {
    throw new AuthError(`Workspace not authorized: ${candidate}`, 403);
  }
  return candidate;
}

/**
 * Bind intake to the authorized workspace — never trust client workspaceId alone.
 */
export function bindIntakeToWorkspace<T extends { workspaceId?: string }>(
  intake: T,
  authorizedWorkspaceId: string
): T {
  if (intake.workspaceId && intake.workspaceId !== authorizedWorkspaceId) {
    throw new AuthError(
      `Workspace mismatch: requested ${intake.workspaceId}, authorized ${authorizedWorkspaceId}`,
      403
    );
  }
  return { ...intake, workspaceId: authorizedWorkspaceId };
}
