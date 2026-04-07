// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { onRequestPost } from '@/functions/api/mapping-enrichment/bulk-approve';

// Mock dependencies
vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    $disconnect: vi.fn(),
  })),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((schema, handler) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body = result.error != null
      ? JSON.stringify({ error: result.error })
      : JSON.stringify(result.data ?? result);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    return new Response(body, { status, headers });
  }),
  withCors: vi.fn(() => (request: Request) => new Response(null, { status: 204 })),
}));

vi.mock('../../../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../services/conditionContentService', () => ({
  clearContentCache: vi.fn(),
}));

describe('POST /api/mapping-enrichment/bulk-approve', () => {
  it('should export onRequestPost function', () => {
    expect(typeof onRequestPost).toBe('function');
  });
});