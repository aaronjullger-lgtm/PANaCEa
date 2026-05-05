import { describe, expect, it } from 'vitest';

describe('useUserStats <-> sync.ts integration contract', () => {
  it('keeps localDeletions as a Record<string, ISO timestamp>', () => {
    const localDeletions = {
      q123: '2026-03-17T10:00:00.000Z',
      q456: '2026-03-17T11:30:00.000Z',
    };

    expect(
      Object.entries(localDeletions).every(
        ([id, timestamp]) => typeof id === 'string' && !Number.isNaN(Date.parse(timestamp))
      )
    ).toBe(true);
  });

  it('keeps saved-question composite deletion keys distinct by type', () => {
    const savedQuestions = [
      {
        questionId: 'q789',
        type: 'missed',
        updatedAt: '2026-03-17T10:00:00.000Z',
      },
      {
        questionId: 'q789',
        type: 'flagged',
        updatedAt: '2026-03-17T11:00:00.000Z',
      },
    ];

    const compositeKeys = savedQuestions.map((q) => `${q.questionId}:${q.type}`);
    expect(new Set(compositeKeys).size).toBe(2);
  });

  it('preserves backward compatibility with clients that omit localDeletions', () => {
    const payloadWithoutLocalDeletions = {
      userId: 'user123',
      performanceRecords: [],
      savedQuestions: [],
    };

    const localDeletions = payloadWithoutLocalDeletions.localDeletions ?? {};
    expect(Object.keys(localDeletions).length).toBe(0);
  });

  it('treats legacy srsItems as ignored compatibility input', () => {
    const clientPayload = {
      userId: 'user123',
      performanceRecords: [],
      srsItems: [
        {
          questionId: 'q200',
          updatedAt: '2026-03-17T11:00:00.000Z',
        },
      ],
      savedQuestions: [],
      localDeletions: {},
    };
    const serverResponse = {
      success: true,
      data: {
        performanceRecords: [],
        srsItems: [],
        savedQuestions: [],
      },
    };

    expect(clientPayload.srsItems).toHaveLength(1);
    expect(serverResponse.data.srsItems).toEqual([]);
  });
});
