/**
 * Authentication and authorization for Builder Agent HTTP/RPC.
 */

export type BuilderPermission = 'read' | 'write' | 'merge' | 'deploy' | 'infrastructure' | 'credentials';

export interface AuthContext {
  authenticated: boolean;
  principal: string;
  permissions: Set<BuilderPermission>;
}

const DEFAULT_SERVICE_PERMISSIONS: BuilderPermission[] = ['read', 'write'];

export function verifyApiKey(
  provided: string | null | undefined,
  expected: string
): AuthContext {
  if (!expected?.trim()) {
    throw new AuthError('BUILDER_AGENT_API_KEY is not configured', 503);
  }

  if (!provided?.trim()) {
    return { authenticated: false, principal: 'anonymous', permissions: new Set() };
  }

  const normalized = provided.replace(/^Bearer\s+/i, '').trim();
  if (!timingSafeEqual(normalized, expected)) {
    return { authenticated: false, principal: 'invalid', permissions: new Set() };
  }

  return {
    authenticated: true,
    principal: 'service',
    permissions: new Set(DEFAULT_SERVICE_PERMISSIONS),
  };
}

export function requirePermission(
  ctx: AuthContext,
  permission: BuilderPermission
): void {
  if (!ctx.authenticated) {
    throw new AuthError('Unauthorized', 401);
  }
  if (!ctx.permissions.has(permission)) {
    throw new AuthError(`Missing permission: ${permission}`, 403);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function grantApprovalPermission(
  ctx: AuthContext,
  kinds: BuilderPermission[]
): AuthContext {
  const permissions = new Set(ctx.permissions);
  for (const k of kinds) permissions.add(k);
  return { ...ctx, permissions };
}
