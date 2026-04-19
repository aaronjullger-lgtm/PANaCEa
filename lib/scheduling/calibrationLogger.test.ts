/**
 * Sprint 3.6 — CalibrationLog Writer Unit Tests
 *
 * The writer is pure telemetry: it MUST NEVER throw. These tests exercise the
 * three critical paths — delegate-missing, delegate-present, delegate-throws —
 * and guarantee the return contract (always a boolean, never an exception).
 */

import { describe, it, expect, vi } from 'vitest';
import { writeCalibrationLog, type CalibrationLogInput } from './calibrationLogger';

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
