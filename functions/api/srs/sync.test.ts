import { describe, expect, it, vi } from 'vitest';

const { captured, mockLogger } = vi.hoisted(() => ({
  captured: { handler: null as any },
  mockLogger: {
    warn: vi.fn(),
  },
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    captured.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/secureLogger', () => ({
  logger: mockLogger,
}));

import './sync';

describe('POST /api/srs/sync legacy compatibility', () => {
  it('accepts legacy SRSItem payloads but no longer writes scheduler state', async () => {
    const result = await captured.handler({
      auth: { userId: 'clerk_user_123' },
      validated: {
        items: [
          {
            questionId: 'q-1',
            interval: 3,
            repetition: 2,
            easiness: 2.5,
            dueDate: '2026-04-02T00:00:00.000Z',
            lastReviewed: '2026-04-01T00:00:00.000Z',
            quality: 4,
            difficulty: 0.5,
            stabilityScore: 0.8,
          },
        ],
      },
    });

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      success: true,
      deprecated: true,
      synced: 0,
      skipped: 1,
      total: 1,
    });
    expect(result.data.message).toContain('Legacy SRSItem sync is deprecated');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Legacy SRSItem sync ignored',
      expect.objectContaining({
        userId: 'clerk_user_123',
        total: 1,
        canonicalPath: '/api/srs/submit',
      })
    );
  });
});
