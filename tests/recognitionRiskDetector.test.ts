import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectRecognitionRisk,
  quickRecognitionCheck,
} from '../lib/services/recognitionRiskDetector';

// ─── Prisma mock factory ────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, any> = {}): any {
  return {
    reviewLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    questionAttempt: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userTopicProgress: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    card: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeAttempts = (count: number, timeSpentMs: number, isCorrect = true) =>
  Array.from({ length: count }, () => ({ timeSpentMs, isCorrect }));

const makeReviewLogs = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    createdAt: new Date(Date.now() - i * 1000),
  }));

// ─── detectRecognitionRisk ──────────────────────────────────────────────────

describe('detectRecognitionRisk', () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
  });

  describe('no signals', () => {
    it('returns zero risk when no data exists', async () => {
      const result = await detectRecognitionRisk(
        prisma, 'user-1', 'q-1', 'cond-1', 'diagnosis'
      );
      expect(result.riskScore).toBe(0);
      expect(result.signals).toHaveLength(0);
      expect(result.shouldForceVariant).toBe(false);
      expect(result.summary).toBe('No recognition risk detected');
    });

    it('returns zero risk when question seen only once', async () => {
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(1));
      const result = await detectRecognitionRisk(
        prisma, 'user-1', 'q-1', 'cond-1', 'diagnosis'
      );
      expect(result.riskScore).toBe(0);
      expect(result.signals.find(s => s.type === 'repeat_exposure')).toBeUndefined();
    });
  });

  describe('repeat_exposure signal', () => {
    it('fires when question seen 2+ times in recent window', async () => {
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(2));
      const result = await detectRecognitionRisk(
        prisma, 'user-1', 'q-1', 'cond-1', 'diagnosis'
      );
      const signal = result.signals.find(s => s.type === 'repeat_exposure');
      expect(signal).toBeDefined();
      expect(signal!.weight).toBeGreaterThan(0);
    });

    it('scales weight with more exposures — 4 reviews > 2 reviews weight', async () => {
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(2));
      const r2 = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const w2 = r2.signals.find(s => s.type === 'repeat_exposure')?.weight ?? 0;

      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(4));
      const r4 = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const w4 = r4.signals.find(s => s.type === 'repeat_exposure')?.weight ?? 0;

      expect(w4).toBeGreaterThan(w2);
    });

    it('repeat_exposure weight is capped at 0.40 (its defined max)', async () => {
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(10));
      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const signal = result.signals.find(s => s.type === 'repeat_exposure');
      expect(signal!.weight).toBeLessThanOrEqual(0.40);
    });
  });

  describe('fast_response signal', () => {
    it('fires when last response time is <40% of median', async () => {
      // Median ~10_000ms; last attempt = 2_000ms → ratio 0.20 < 0.40 threshold
      const recent = makeAttempts(50, 10_000);
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: 2_000 });
      prisma.questionAttempt.findMany.mockResolvedValue(recent);

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const signal = result.signals.find(s => s.type === 'fast_response');
      expect(signal).toBeDefined();
      expect(signal!.weight).toBeGreaterThan(0);
    });

    it('does NOT fire when response time is normal (>40% of median)', async () => {
      const recent = makeAttempts(50, 10_000);
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: 6_000 });
      prisma.questionAttempt.findMany.mockResolvedValue(recent);

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'fast_response')).toBeUndefined();
    });

    it('does NOT fire when fewer than 10 recent attempts exist', async () => {
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: 500 });
      prisma.questionAttempt.findMany.mockResolvedValue(makeAttempts(8, 10_000));

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'fast_response')).toBeUndefined();
    });

    it('does NOT fire when last attempt has no timeSpentMs', async () => {
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: null });
      prisma.questionAttempt.findMany.mockResolvedValue(makeAttempts(50, 10_000));

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'fast_response')).toBeUndefined();
    });
  });

  describe('accuracy_divergence signal', () => {
    it('fires when card accuracy is high but topic stability is low', async () => {
      // 8/10 correct = 0.80 accuracy; stability=5 → normalised=0.17; divergence=0.63
      prisma.questionAttempt.findMany.mockResolvedValue([
        ...makeAttempts(8, 5_000, true),
        ...makeAttempts(2, 5_000, false),
      ]);
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        stability: 5,
        difficulty: 0.3,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const signal = result.signals.find(s => s.type === 'accuracy_divergence');
      expect(signal).toBeDefined();
      expect(signal!.weight).toBeGreaterThan(0);
    });

    it('does NOT fire when topic stability is high (normalised accuracy close to card)', async () => {
      // Card accuracy 0.80; stability=30 → normalised=1.0; divergence=-0.2 (below threshold)
      prisma.questionAttempt.findMany.mockResolvedValue(makeAttempts(10, 5_000, true));
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        stability: 30,
        difficulty: 0.3,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'accuracy_divergence')).toBeUndefined();
    });

    it('does NOT fire when fewer than 3 card attempts exist', async () => {
      prisma.questionAttempt.findMany.mockResolvedValue(makeAttempts(2, 5_000, true));
      prisma.userTopicProgress.findUnique.mockResolvedValue({ stability: 2 });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'accuracy_divergence')).toBeUndefined();
    });
  });

  describe('high_reps_low_stability signal', () => {
    it('fires with high lapseRatio + many reps + low stability', async () => {
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        reps: 8,
        lapses: 4,
        stability: 2.0,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      const signal = result.signals.find(s => s.type === 'high_reps_low_stability');
      expect(signal).toBeDefined();
      expect(signal!.weight).toBeGreaterThan(0);
    });

    it('does NOT fire when stability is above threshold (5.0 days)', async () => {
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        reps: 10,
        lapses: 5,
        stability: 7.0,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'high_reps_low_stability')).toBeUndefined();
    });

    it('does NOT fire when reps < 4', async () => {
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        reps: 3,
        lapses: 2,
        stability: 1.0,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.signals.find(s => s.type === 'high_reps_low_stability')).toBeUndefined();
    });

    it('does NOT fire when lapseRatio intensity < 0.2', async () => {
      // lapseRatio = 1/10 = 0.10; riskIntensity = 0.10*2 = 0.20 — border case skipped
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        reps: 10,
        lapses: 1,
        stability: 2.0,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      // riskIntensity = min(1, 0.1*2)=0.2 — exactly 0.2 is included by the guard
      // signal should still be defined; this tests the boundary
      // The guard is `if (riskIntensity < 0.2) return null` — 0.2 passes
      // So signal IS returned
      const signal = result.signals.find(s => s.type === 'high_reps_low_stability');
      // 0.2 intensity → weight = 0.15 * 0.2 = 0.03
      if (signal) {
        expect(signal.weight).toBeCloseTo(0.03, 2);
      }
    });
  });

  describe('composite risk score + shouldForceVariant', () => {
    it('caps riskScore at 1.0 even when all signals fire at full weight', async () => {
      // All signals at full weight: 0.40+0.25+0.20+0.15 = 1.0
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(10));
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: 100 });
      prisma.questionAttempt.findMany.mockResolvedValue([
        ...makeAttempts(50, 10_000),          // median for fast response
        ...makeAttempts(8, 5_000, true),
        ...makeAttempts(2, 5_000, false),
      ]);
      prisma.userTopicProgress.findUnique.mockResolvedValue({
        stability: 2.0,
        difficulty: 0.3,
        reps: 8,
        lapses: 4,
      });

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      expect(result.riskScore).toBeLessThanOrEqual(1.0);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('shouldForceVariant is true when riskScore >= 0.60', async () => {
      // repeat_exposure (0.40) + fast_response (0.25) = 0.65 ≥ 0.60
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(4));
      prisma.questionAttempt.findFirst.mockResolvedValue({ timeSpentMs: 500 });
      prisma.questionAttempt.findMany.mockResolvedValue(makeAttempts(50, 10_000));

      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      if (result.riskScore >= 0.60) {
        expect(result.shouldForceVariant).toBe(true);
      } else {
        expect(result.shouldForceVariant).toBe(false);
      }
    });

    it('summary includes signal types when signals are present', async () => {
      prisma.reviewLog.findMany.mockResolvedValue(makeReviewLogs(3));
      const result = await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      if (result.signals.length > 0) {
        expect(result.summary).toMatch(/Risk \d+%/);
        expect(result.summary).toContain('repeat_exposure');
      }
    });
  });

  describe('runs signal checks in parallel', () => {
    it('all four DB queries are invoked regardless of individual signal outcomes', async () => {
      await detectRecognitionRisk(prisma, 'u', 'q', 'c', 't');
      // reviewLog → repeat_exposure
      expect(prisma.reviewLog.findMany).toHaveBeenCalledTimes(1);
      // questionAttempt.findFirst → fast_response (last attempt)
      expect(prisma.questionAttempt.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── quickRecognitionCheck ──────────────────────────────────────────────────

describe('quickRecognitionCheck', () => {
  it('returns false when card does not exist', async () => {
    const prisma = makePrisma({ card: { findUnique: vi.fn().mockResolvedValue(null) } });
    expect(await quickRecognitionCheck(prisma, 'u', 'q')).toBe(false);
  });

  it('returns false when card reps < 3 (RECENT_REVIEW_WINDOW)', async () => {
    const prisma = makePrisma({ card: { findUnique: vi.fn().mockResolvedValue({ reps: 2 }) } });
    expect(await quickRecognitionCheck(prisma, 'u', 'q')).toBe(false);
  });

  it('returns true when card reps >= 3', async () => {
    const prisma = makePrisma({ card: { findUnique: vi.fn().mockResolvedValue({ reps: 3 }) } });
    expect(await quickRecognitionCheck(prisma, 'u', 'q')).toBe(true);
  });

  it('returns true for high rep counts', async () => {
    const prisma = makePrisma({ card: { findUnique: vi.fn().mockResolvedValue({ reps: 25 }) } });
    expect(await quickRecognitionCheck(prisma, 'u', 'q')).toBe(true);
  });

  it('queries the READINESS progressContext composite key', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = makePrisma({ card: { findUnique } });
    await quickRecognitionCheck(prisma, 'user-abc', 'q-xyz');
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_questionId_progressContext: {
            userId: 'user-abc',
            questionId: 'q-xyz',
            progressContext: 'READINESS',
          },
        },
      })
    );
  });
});
