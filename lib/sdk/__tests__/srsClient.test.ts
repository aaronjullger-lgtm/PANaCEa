/**
 * Tests for the PANaCEa SDK SRS client.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../core';
import { createSrsClient } from '../srsClient';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

const mockGetToken = vi.fn(() => Promise.resolve('srs-token'));

describe('srsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes due item date strings from the API into Date objects', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          items: [
            {
              id: 'card-1',
              source: 'card',
              dueDate: '2026-04-01T12:00:00.000Z',
            },
          ],
          totalDue: 1,
        },
      })
    );

    const api = createApiClient(mockGetToken);
    const srs = createSrsClient(api);

    const result = await srs.getDueItems();

    expect(result.totalDue).toBe(1);
    expect(result.items[0]?.dueDate).toBeInstanceOf(Date);
    expect(result.items[0]?.dueDate.toISOString()).toBe('2026-04-01T12:00:00.000Z');
  });

  it('posts the canonical SRS submit payload shape', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          success: true,
          nextReviewDate: '2026-04-02T12:00:00.000Z',
          questionId: 'question-1',
        },
      })
    );

    const api = createApiClient(mockGetToken);
    const srs = createSrsClient(api);

    const result = await srs.submitReview({
      questionId: 'question-1',
      rating: 3,
      isCorrect: true,
      userAnswer: 'Aspirin',
      timeSpent: 12000,
      progressContext: 'TARGETED',
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        nextReviewDate: '2026-04-02T12:00:00.000Z',
        questionId: 'question-1',
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/srs/submit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          questionId: 'question-1',
          rating: 3,
          isCorrect: true,
          userAnswer: 'Aspirin',
          timeSpent: 12000,
          progressContext: 'TARGETED',
        }),
      })
    );
  });
});
