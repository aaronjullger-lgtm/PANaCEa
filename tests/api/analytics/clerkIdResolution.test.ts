/**
 * Reconciliation tests: Clerk ID → internal User.id resolution
 *
 * Regression guard for the dashboard-trust audit finding (2026-04-17):
 * Several analytics/dashboard endpoints were passing `context.auth.userId`
 * (the Clerk id, from the JWT `sub` claim) directly into Prisma queries
 * against user-owned tables (UserProgress, QuestionAttempt, etc.). Those
 * tables' `userId` column stores the internal User.id, so the queries
 * silently returned zero rows and every affected widget rendered as if
 * the student had never studied.
 *
 * These tests assert, for each fixed endpoint:
 *   1. It calls `prisma.user.findUnique({ where: { clerkId }, select: { id } })`
 *   2. Downstream queries use the INTERNAL id, not the Clerk id
 *   3. When the user is not synced (findUnique → null), the endpoint returns
 *      404 with `meta.status === 'user_not_synced'` (explicit insufficient_data)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const CLERK_ID = 'user_clerk_2abc123XYZ';
const INTERNAL_ID = 'internal-uuid-1111-2222-3333';

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => handler),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../../../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    addContext: vi.fn(),
  })),
}));

vi.mock('../../../functions/api/_shared/env-validation', () => ({
  validateFunctionEnv: vi.fn(),
  MissingEnvError: class MissingEnvError extends Error {
    toResponse() {
      return new Response('missing env', { status: 500 });
    }
  },
}));

import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface FakePrismaOptions {
  userFound?: boolean; // default true
}

function makeFakePrisma(opts: FakePrismaOptions = {}) {
  const { userFound = true } = opts;

  const findUniqueUser = vi
    .fn()
    .mockResolvedValue(userFound ? { id: INTERNAL_ID } : null);

  return {
    user: {
      findUnique: findUniqueUser,
    },
    userProgress: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    questionAttempt: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    userStudyPhenotype: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userLearningProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userGoal: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    dailyUserAnalytics: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    drillSessionRecord: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    graphNode: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    graphEdge: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    performanceRecord: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    question: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function baseContext() {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: CLERK_ID },
    validated: {},
  };
}

async function parseBody(result: any): Promise<any> {
  // Endpoints may return either a Response (Response.json) or { data, status } shape
  if (result instanceof Response) {
    return { status: result.status, body: await result.json() };
  }
  return { status: result.status ?? 200, body: result.data ?? result };
}

/**
 * Assert that every Prisma call on user-owned tables used INTERNAL_ID
 * (not CLERK_ID) in its `where.userId` clause.
 */
function assertUsesInternalId(prisma: ReturnType<typeof makeFakePrisma>) {
  const allCalls = [
    ...prisma.userProgress.count.mock.calls,
    ...prisma.userProgress.findMany.mock.calls,
    ...prisma.questionAttempt.findMany.mock.calls,
    ...prisma.questionAttempt.count.mock.calls,
    ...prisma.userStudyPhenotype.findUnique.mock.calls,
    ...prisma.userLearningProfile.findUnique.mock.calls,
    ...prisma.userGoal.findFirst.mock.calls,
    ...prisma.dailyUserAnalytics.findMany.mock.calls,
    ...prisma.drillSessionRecord.findMany.mock.calls,
    ...prisma.performanceRecord.findMany.mock.calls,
  ];

  for (const [args] of allCalls) {
    const userIdInWhere = args?.where?.userId;
    if (userIdInWhere !== undefined) {
      expect(userIdInWhere).not.toBe(CLERK_ID);
      // If it's a primitive string it must be the internal id.
      if (typeof userIdInWhere === 'string') {
        expect(userIdInWhere).toBe(INTERNAL_ID);
      }
    }
  }
}

// ── Test fixtures (one per fixed endpoint) ──────────────────────────────────

const ENDPOINTS = [
  {
    name: 'GET /api/analytics/review-forecast',
    importPath: '../../../functions/api/analytics/review-forecast',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/readiness-projection',
    importPath: '../../../functions/api/analytics/readiness-projection',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/error-patterns',
    importPath: '../../../functions/api/analytics/error-patterns',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/learner-profile',
    importPath: '../../../functions/api/analytics/learner-profile',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/learner-analysis',
    importPath: '../../../functions/api/analytics/learner-analysis',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/knowledge-graph',
    importPath: '../../../functions/api/analytics/knowledge-graph',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/analytics/blueprint-gaps',
    importPath: '../../../functions/api/analytics/blueprint-gaps',
    exportName: 'onRequestGet',
  },
  {
    name: 'GET /api/study/daily-load',
    importPath: '../../../functions/api/study/daily-load',
    exportName: 'onRequestGet',
  },
] as const;

// ── Actual tests ────────────────────────────────────────────────────────────

describe('Clerk ID → internal User.id resolution (dashboard-trust regression guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const endpoint of ENDPOINTS) {
    describe(endpoint.name, () => {
      it('resolves clerkId to internal User.id before querying user-owned tables', async () => {
        const prisma = makeFakePrisma({ userFound: true });
        (createEdgePrismaClient as Mock).mockReturnValue(prisma);

        const mod = await import(endpoint.importPath);
        const handler = (mod as any)[endpoint.exportName] as (ctx: any) => Promise<any>;
        expect(handler).toBeTypeOf('function');

        await handler(baseContext());

        // 1. It looked up the user by clerkId
        expect(prisma.user.findUnique).toHaveBeenCalled();
        const firstCall = prisma.user.findUnique.mock.calls[0]?.[0];
        expect(firstCall?.where).toEqual({ clerkId: CLERK_ID });
        expect(firstCall?.select).toMatchObject({ id: true });

        // 2. Downstream queries on user-owned tables use the INTERNAL id
        assertUsesInternalId(prisma);
      });

      it('returns 404 with user_not_synced meta when the user is not resolvable', async () => {
        const prisma = makeFakePrisma({ userFound: false });
        (createEdgePrismaClient as Mock).mockReturnValue(prisma);

        const mod = await import(endpoint.importPath);
        const handler = (mod as any)[endpoint.exportName] as (ctx: any) => Promise<any>;
        const result = await handler(baseContext());
        const { status, body } = await parseBody(result);

        expect(status).toBe(404);

        // Body shape varies per endpoint; the invariant is that the response
        // either carries an explicit 'user_not_synced' status marker (possibly
        // nested under `data`) OR an error string — never silently successful zeros.
        const metaStatus =
          body?.meta?.status ?? body?.data?.meta?.status;
        const hasMeta = metaStatus === 'user_not_synced';
        const hasError =
          (typeof body?.error === 'string' && body.error.length > 0) ||
          (typeof body?.data?.error === 'string' && body.data.error.length > 0) ||
          typeof body?.message === 'string' ||
          typeof body?.data?.message === 'string';
        expect(hasMeta || hasError).toBe(true);

        // No user-owned table was queried (we short-circuited on resolution failure).
        expect(prisma.userProgress.count).not.toHaveBeenCalled();
        expect(prisma.userProgress.findMany).not.toHaveBeenCalled();
        expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
      });
    });
  }
});
