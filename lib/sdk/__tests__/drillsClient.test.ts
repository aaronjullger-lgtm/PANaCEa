/**
 * Tests for the PANaCEa SDK Drills Client
 *
 * Verifies the drillsClient.submitReview() delegates correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiClient } from '../core';
import { createDrillsClient } from '../drillsClient';

// ─── Mock fetch ───────────────────────────────────────────────────────────

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

const mockGetToken = vi.fn(() => Promise.resolve('drill-token'));

describe('drillsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submitReview sends correct payload and returns result', async () => {
    const serverResponse = {
      data: {
        isCorrect: true,
        isRapidGuess: false,
        nextReview: {
          intervalDays: 3,
          nextDueDate: '2026-04-09',
          stability: 4.2,
          difficulty: 5.1,
        },
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(serverResponse));

    const api = createApiClient(mockGetToken);
    const drills = createDrillsClient(api);

    const result = await drills.submitReview({
      questionId: 'q_abc123',
      selectedAnswer: 'B',
      timeSpentMs: 12000,
      timeToFirstClick: 3200,
      answerSwitches: 1,
      totalDwellTime: 11500,
      timezone: 'America/Chicago',
      sessionType: 'drill',
    });

    // The SDK unwraps the { data } envelope
    expect(result).toEqual(serverResponse.data);

    // Verify it hit the right endpoint
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/drills/submit-review');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      questionId: 'q_abc123',
      selectedAnswer: 'B',
      sessionType: 'drill',
    });
  });

  it('throws on server error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Question not found' }, 404)
    );

    const api = createApiClient(mockGetToken);
    const drills = createDrillsClient(api);

    await expect(
      drills.submitReview({
        questionId: 'q_invalid',
        selectedAnswer: 'A',
        timeSpentMs: 1000,
      })
    ).rejects.toThrow('Question not found');
  });
});
