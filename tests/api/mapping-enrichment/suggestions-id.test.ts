// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { onRequestPut } from '@/functions/api/mapping-enrichment/suggestions/[id]';

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

describe('PUT /api/mapping-enrichment/suggestions/:id', () => {
  it('should export onRequestPut function', () => {
    expect(typeof onRequestPut).toBe('function');
  });
});