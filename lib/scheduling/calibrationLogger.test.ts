/**
 * Sprint 3.6 — CalibrationLog Writer Unit Tests
 *
 * The writer is pure telemetry: it MUST NEVER throw. These tests exercise the
 * three critical paths — delegate-missing, delegate-present, delegate-throws —
 * and guarantee the return contract (always a boolean, never an exception).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  writeCalibrationLog,
  writeV7ShadowPrediction,
  type CalibrationLogInput,
  type V7ShadowLogInput,
} from './calibrationLogger';
import { v7AlphaDefaultParameters, computeRetrievabilityV7 } from '../fsrs-v7';
import { defaultParameters } from '../fsrs';

function baseInput(overrides: Partial<CalibrationLogInput> = {}): CalibrationLogInput {
  return {
    userId: 'user_123',
    questionId: 'q_abc',
    conditionId: 'cond_xyz',
    predictedRetrievability: 0.85,
    stabilityAtPrediction: 12.3,
    difficultyAtPrediction: 4.2,
    intervalDaysAtPrediction: 7,
    ratingFed: 3,
    elapsedDaysAtOutcome: 7.5,
    actualOutcome: true,
    implicitConfidence: 0.72,
    rapidGuess: false,
    telemetryQuality: 'full',
    hypercorrectionEligible: false,
    ...overrides,
  };
}

describe('writeCalibrationLog', () => {
  it('returns false when the Prisma delegate is missing (pre-`prisma generate`)', async () => {
    const warn = vi.fn();
    const fakePrisma = {}; // no calibrationLog delegate
    const ok = await writeCalibrationLog(fakePrisma, baseInput(), { warn });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/delegate missing/);
  });

  it('returns true and passes structured data when the delegate creates successfully', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'cal_1' });
    const fakePrisma = { calibrationLog: { create } };

    const ok = await writeCalibrationLog(fakePrisma, baseInput(), {});
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);

    const arg = create.mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    expect(arg.data.userId).toBe('user_123');
    expect(arg.data.predictedRetrievability).toBe(0.85);
    expect(arg.data.ratingFed).toBe(3);
    expect(arg.data.actualOutcome).toBe(true);
    expect(arg.data.fsrsVersion).toBe('6.0');
    expect(arg.data.sessionType).toBe('MAIN');
  });

  it('never throws when the delegate throws — returns false and logs', async () => {
    const warn = vi.fn();
    const create = vi.fn().mockRejectedValue(new Error('DB offline'));
    const fakePrisma = { calibrationLog: { create } };

    const ok = await writeCalibrationLog(fakePrisma, baseInput(), { warn });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]?.error).toMatch(/DB offline/);
  });

  it('clamps predictedRetrievability to [0, 1] and guards NaN', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    await writeCalibrationLog(
      fakePrisma,
      baseInput({ predictedRetrievability: 1.7 }),
      {}
    );
    await writeCalibrationLog(
      fakePrisma,
      baseInput({ predictedRetrievability: -0.3 }),
      {}
    );
    await writeCalibrationLog(
      fakePrisma,
      baseInput({ predictedRetrievability: Number.NaN }),
      {}
    );

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[0]?.[0].data.predictedRetrievability).toBe(1);
    expect(create.mock.calls[1]?.[0].data.predictedRetrievability).toBe(0);
    expect(create.mock.calls[2]?.[0].data.predictedRetrievability).toBe(0);
  });

  it('defaults sessionType to MAIN and fsrsVersion to 6.0 when not provided', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    await writeCalibrationLog(fakePrisma, baseInput(), {});
    const arg = create.mock.calls[0]?.[0];
    expect(arg.data.sessionType).toBe('MAIN');
    expect(arg.data.fsrsVersion).toBe('6.0');
  });

  it('coerces nullable fields correctly (questionId null, ghostGraderRule null)', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    await writeCalibrationLog(
      fakePrisma,
      {
        ...baseInput({ questionId: null, conditionId: null }),
        ghostGraderRule: null,
        wilsonLower: null,
        isMastered: null,
      },
      {}
    );
    const arg = create.mock.calls[0]?.[0];
    expect(arg.data.questionId).toBe(null);
    expect(arg.data.conditionId).toBe(null);
    expect(arg.data.ghostGraderRule).toBe(null);
    expect(arg.data.wilsonLower).toBe(null);
    expect(arg.data.isMastered).toBe(null);
  });

  it('tolerates a completely missing logger (undefined) on all paths', async () => {
    // delegate missing + no logger
    await expect(writeCalibrationLog({}, baseInput())).resolves.toBe(false);

    // delegate throws + no logger
    const brokenPrisma = {
      calibrationLog: {
        create: vi.fn().mockRejectedValue(new Error('nope')),
      },
    };
    await expect(writeCalibrationLog(brokenPrisma, baseInput())).resolves.toBe(false);
  });
});

describe('writeV7ShadowPrediction', () => {
  function v7Input(overrides: Partial<V7ShadowLogInput> = {}): V7ShadowLogInput {
    return {
      ...baseInput(),
      v7Params: v7AlphaDefaultParameters,
      elapsedDaysAtPrediction: 7,
      ...overrides,
    };
  }

  it('tags the written row with fsrsVersion=7-alpha', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };
    const ok = await writeV7ShadowPrediction(fakePrisma, v7Input(), {});
    expect(ok).toBe(true);
    const data = create.mock.calls[0]?.[0].data;
    expect(data.fsrsVersion).toBe('7-alpha');
  });

  it('substitutes v7-computed retrievability (not the v6 value passed in)', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    const v6PredictionWouldBe = 0.85; // baseInput default
    const input = v7Input({
      predictedRetrievability: v6PredictionWouldBe, // v6 prediction (ignored)
      stabilityAtPrediction: 12.3,
      elapsedDaysAtPrediction: 7,
    });
    await writeV7ShadowPrediction(fakePrisma, input, {});
    const data = create.mock.calls[0]?.[0].data;

    const expectedV7 = computeRetrievabilityV7(7, 12.3, v7AlphaDefaultParameters);
    expect(data.predictedRetrievability).toBeCloseTo(expectedV7, 10);
    // Prove it's actually different from the v6 value (sanity check)
    expect(data.predictedRetrievability).not.toBeCloseTo(v6PredictionWouldBe, 3);
  });

  it('refuses to log when v7Params is not 29-length (safety guard)', async () => {
    const warn = vi.fn();
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    const ok = await writeV7ShadowPrediction(
      fakePrisma,
      v7Input({ v7Params: defaultParameters }), // v6 params (21-length) — should reject
      { warn }
    );
    expect(ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/refusing to log/),
      expect.objectContaining({ paramCount: 21 })
    );
  });

  it('never throws when prisma delegate throws — returns false', async () => {
    const warn = vi.fn();
    const create = vi.fn().mockRejectedValue(new Error('nope'));
    const fakePrisma = { calibrationLog: { create } };

    const ok = await writeV7ShadowPrediction(fakePrisma, v7Input(), { warn });
    expect(ok).toBe(false);
  });

  it('preserves all other fields from the input verbatim', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    await writeV7ShadowPrediction(
      fakePrisma,
      v7Input({
        userId: 'shadow_user',
        actualOutcome: false,
        ratingFed: 1,
        ghostGraderRule: 'indecision',
      }),
      {}
    );
    const data = create.mock.calls[0]?.[0].data;
    expect(data.userId).toBe('shadow_user');
    expect(data.actualOutcome).toBe(false);
    expect(data.ratingFed).toBe(1);
    expect(data.ghostGraderRule).toBe('indecision');
  });

  it('can be stratified by fsrsVersion in a subsequent report', async () => {
    // This is an integration-shape test — proves that writing one v6 row and
    // one v7 row for the same review produces two differently-tagged rows
    // that stratifiedReport() in shadowValidator can separate.
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = { calibrationLog: { create } };

    // v6 emission (normal path)
    await writeCalibrationLog(
      fakePrisma,
      { ...baseInput(), fsrsVersion: '6' },
      {}
    );
    // v7 shadow emission (same review)
    await writeV7ShadowPrediction(fakePrisma, v7Input(), {});

    expect(create).toHaveBeenCalledTimes(2);
    const versions = create.mock.calls.map((c) => c[0].data.fsrsVersion);
    expect(versions).toEqual(['6', '7-alpha']);
  });
});
