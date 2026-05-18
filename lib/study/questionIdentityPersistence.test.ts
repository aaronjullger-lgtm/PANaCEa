import { describe, expect, it, vi } from 'vitest';
import {
  normalizeQuestionIdentityInput,
  questionIdentityLookupKey,
  resolveOrCreateQuestionIdentity,
  resolveOrCreateQuestionIdentityIds,
} from './questionIdentityPersistence';

describe('questionIdentityPersistence', () => {
  it('normalizes pre-generated identity inputs with provenance', () => {
    expect(
      normalizeQuestionIdentityInput(
        {
          questionSource: 'pre_generated',
          sourceQuestionId: 'pgq_1',
          canonicalQuestionId: 'q_1',
          medicalContentId: 'mc_1',
          system: 'Cardiovascular',
        },
        { provenance: { writer: 'test' } }
      )
    ).toEqual({
      questionSource: 'pre_generated',
      sourceQuestionId: 'pgq_1',
      canonicalQuestionId: 'q_1',
      provenance: {
        writer: 'test',
        medicalContentId: 'mc_1',
        system: 'Cardiovascular',
      },
    });
  });

  it('upserts a single identity and returns its database id', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'qid_1' });

    await expect(
      resolveOrCreateQuestionIdentity(
        {
          questionIdentity: { upsert },
        },
        {
          questionSource: 'pre_generated',
          sourceQuestionId: 'pgq_1',
          canonicalQuestionId: 'q_1',
          provenance: { writer: 'drill-review-service' },
        }
      )
    ).resolves.toBe('qid_1');

    expect(upsert).toHaveBeenCalledWith({
      where: {
        questionSource_sourceQuestionId: {
          questionSource: 'pre_generated',
          sourceQuestionId: 'pgq_1',
        },
      },
      create: expect.objectContaining({
        questionSource: 'pre_generated',
        sourceQuestionId: 'pgq_1',
        canonicalQuestionId: 'q_1',
        preGeneratedQuestionId: 'pgq_1',
        provenance: { writer: 'drill-review-service' },
      }),
      update: expect.objectContaining({
        canonicalQuestionId: 'q_1',
        preGeneratedQuestionId: 'pgq_1',
        provenance: { writer: 'drill-review-service' },
      }),
      select: { id: true },
    });
  });

  it('falls back to a source-only identity if source FKs are unavailable', async () => {
    const upsert = vi
      .fn()
      .mockRejectedValueOnce(new Error('foreign key constraint'))
      .mockResolvedValueOnce({ id: 'qid_source_only' });

    await expect(
      resolveOrCreateQuestionIdentity(
        {
          questionIdentity: { upsert },
        },
        {
          questionSource: 'pre_generated',
          sourceQuestionId: 'pgq_missing',
          canonicalQuestionId: 'q_missing',
        }
      )
    ).resolves.toBe('qid_source_only');

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        create: expect.not.objectContaining({
          canonicalQuestionId: expect.anything(),
          preGeneratedQuestionId: expect.anything(),
        }),
      })
    );
  });

  it('creates and reads a batch identity map', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const findMany = vi.fn().mockResolvedValue([
      { id: 'qid_q_1', questionSource: 'question', sourceQuestionId: 'q_1' },
      { id: 'qid_pgq_1', questionSource: 'pre_generated', sourceQuestionId: 'pgq_1' },
    ]);

    const ids = await resolveOrCreateQuestionIdentityIds(
      {
        questionIdentity: { createMany, findMany },
      },
      [
        { questionSource: 'question', sourceQuestionId: 'q_1' },
        { questionSource: 'pre_generated', sourceQuestionId: 'pgq_1', canonicalQuestionId: 'q_1' },
        { questionSource: 'pre_generated', sourceQuestionId: 'pgq_1', canonicalQuestionId: 'q_1' },
      ]
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          questionSource: 'question',
          sourceQuestionId: 'q_1',
          canonicalQuestionId: 'q_1',
        }),
        expect.objectContaining({
          questionSource: 'pre_generated',
          sourceQuestionId: 'pgq_1',
          preGeneratedQuestionId: 'pgq_1',
        }),
      ],
      skipDuplicates: true,
    });
    expect(ids.get('question:q_1')).toBe('qid_q_1');
    expect(ids.get('pre_generated:pgq_1')).toBe('qid_pgq_1');
    expect(
      questionIdentityLookupKey({ questionSource: 'pre_generated', sourceQuestionId: 'pgq_1' })
    ).toBe('pre_generated:pgq_1');
  });
});
