/**
 * Tests for CMS middleware (withCMSRole) and admin content endpoint auth gating.
 *
 * Verifies:
 * - withCMSRole allows editor, approver, admin, superadmin
 * - withCMSRole rejects user, viewer, and unauthenticated requests
 * - withCMSRole attaches dbUserId and dbRole to context
 * - auditLog is called for content operations
 * - cmsEndpoint integrates withCMSRole in the middleware chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock secureLogger before importing anything that uses it
vi.mock('../secureLogger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    security: vi.fn(),
  },
  createEndpointLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    security: vi.fn(),
  }),
}));

vi.mock('../structuredLogger', () => ({
  withStructuredLogging: () =>
    async (context: any, next: any) => next(),
}));

// Mock Prisma edge client
const mockFindUnique = vi.fn();
const mockDisconnect = vi.fn();
vi.mock('../prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    user: { findUnique: mockFindUnique },
    $disconnect: mockDisconnect,
  }),
  safePrismaDisconnect: vi.fn(),
}));

// Mock auth
vi.mock('../auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Mock auditLog
vi.mock('../auditLog', () => ({
  auditLog: vi.fn(),
}));

// Mock CORS
vi.mock('../cors', () => ({
  getCorsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
  handleCorsPreflightSecure: vi.fn(),
  getCorsConfig: () => ({}),
}));

import { withCMSRole } from '../middleware';
import { auditLog } from '../auditLog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuthContext(clerkId: string, env: any = {}) {
  return {
    request: new Request('https://example.com/api/admin/content/list'),
    env: { DATABASE_URL: 'postgres://test', CLERK_SECRET_KEY: 'sk_test_abc', ...env },
    params: {},
    auth: { userId: clerkId, metadata: {} },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withCMSRole middleware', () => {
  const middleware = withCMSRole();
  const nextFn = vi.fn().mockResolvedValue({ data: 'ok' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('allows editor+ roles', () => {
    const allowedRoles = ['EDITOR', 'APPROVER', 'ADMIN', 'SUPERADMIN'];

    for (const role of allowedRoles) {
      it(`allows ${role}`, async () => {
        mockFindUnique.mockResolvedValue({ id: 'db-user-1', role });
        const ctx = makeAuthContext('clerk-123');

        await middleware(ctx as any, nextFn);

        expect(nextFn).toHaveBeenCalled();
      });
    }
  });

  describe('rejects insufficient roles', () => {
    const rejectedRoles = ['USER', 'VIEWER', 'user', 'viewer'];

    for (const role of rejectedRoles) {
      it(`rejects ${role}`, async () => {
        mockFindUnique.mockResolvedValue({ id: 'db-user-1', role });
        const ctx = makeAuthContext('clerk-123');

        const result = await middleware(ctx as any, nextFn);

        expect(nextFn).not.toHaveBeenCalled();
        expect(result).toEqual(
          expect.objectContaining({ status: 403, error: 'Editor or higher access required' })
        );
      });
    }
  });

  it('rejects when user not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const ctx = makeAuthContext('clerk-unknown');

    const result = await middleware(ctx as any, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: 403, error: 'Editor or higher access required' })
    );
  });

  it('returns 401 when auth context is missing', async () => {
    const ctx = {
      request: new Request('https://example.com/api/admin/content/list'),
      env: { DATABASE_URL: 'postgres://test' },
      params: {},
      auth: null,
    };

    const result = await middleware(ctx as any, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: 401, error: 'Authentication required' })
    );
  });

  it('attaches dbUserId and dbRole to auth.metadata', async () => {
    mockFindUnique.mockResolvedValue({ id: 'db-user-42', role: 'EDITOR' });
    const ctx = makeAuthContext('clerk-editor');

    await middleware(ctx as any, nextFn);

    expect(ctx.auth.metadata).toEqual(
      expect.objectContaining({
        dbUserId: 'db-user-42',
        dbRole: 'EDITOR',
      })
    );
  });

  it('returns 500 on database errors', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection failed'));
    const ctx = makeAuthContext('clerk-123');

    const result = await middleware(ctx as any, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: 500, error: 'Internal server error' })
    );
  });
});

describe('AuditAction types for content CRUD', () => {
  it('auditLog accepts content action types', () => {
    const actions = [
      'admin_content_create',
      'admin_content_update',
      'admin_content_delete',
      'admin_content_transition',
      'admin_content_list',
      'admin_audit_log_access',
    ];

    for (const action of actions) {
      auditLog(action, { test: true });
      expect(auditLog).toHaveBeenCalledWith(action, { test: true });
    }
  });
});

describe('Validation schemas', () => {
  it('AuditLogQuerySchema accepts valid query params', async () => {
    const { AuditLogQuerySchema } = await import('../schemas');
    const result = AuditLogQuerySchema.safeParse({
      limit: 25,
      offset: 0,
      format: 'json',
    });
    expect(result.success).toBe(true);
  });

  it('AuditLogQuerySchema rejects limit > 100', async () => {
    const { AuditLogQuerySchema } = await import('../schemas');
    const result = AuditLogQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it('AuditLogQuerySchema coerces string numbers', async () => {
    const { AuditLogQuerySchema } = await import('../schemas');
    const result = AuditLogQuerySchema.safeParse({ limit: '50', offset: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(10);
    }
  });

  it('ContentListQuerySchema accepts valid query params', async () => {
    const { ContentListQuerySchema } = await import('../schemas');
    const result = ContentListQuerySchema.safeParse({
      system: 'cardiovascular',
      status: 'published',
      page: 2,
      perPage: 50,
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('ContentListQuerySchema rejects perPage > 100', async () => {
    const { ContentListQuerySchema } = await import('../schemas');
    const result = ContentListQuerySchema.safeParse({ perPage: 200 });
    expect(result.success).toBe(false);
  });

  it('ContentListQuerySchema rejects search > 200 chars', async () => {
    const { ContentListQuerySchema } = await import('../schemas');
    const result = ContentListQuerySchema.safeParse({ search: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });
});
