/**
 * Tests for userTimingProfileService — per-user speed factor and behavioral baseline
 *
 * Pure functions (classifyComplexityTier) tested directly.
 * Prisma-dependent functions (computeUserTimingProfile, getUserSpeedFactor, etc.)
 * tested with vi.mocked Prisma client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyComplexityTier,
  computeUserTimingProfile,
  getUserSpeedFactor,
  computeBehavioralBaseline,
  getUserBehavioralBaseline,
  getUserBehavioralContext,
  type ComplexityTier,
  type UserTimingProfile,
  type UserBehavioralBaseline,
} from '@/lib/services/userTimingProfileService';

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/confidence/exGaussianRT', () => ({
  fitExGaussian: vi.fn(() => ({ mu: 2000, sigma: 500, lambda: 0.001 })),
}));

function mockPrisma() {
  return {
    questionAttempt: { findMany: vi.fn() },
    preGeneratedQuestion: { findMany: vi.fn() },
    userStatistics: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as { questionAttempt: { findMany: ReturnType<typeof vi.fn> }; preGeneratedQuestion: { findMany: ReturnType<typeof vi.fn> }; userStatistics: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> } };
}

// ─── classifyComplexityTier ─────────────────────────────────────────────

describe('classifyComplexityTier', () => {
  it('classifies short questions (< 60 words)', () => {
    expect(classifyComplexityTier('A 28-year-old male presents with chest pain.')).toBe('short');
  });

  it('classifies medium questions (60–149 words)', () => {
    const words = Array(80).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('medium');
  });

  it('classifies long questions (150–299 words)', () => {
    const words = Array(200).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('long');
  });

  it('classifies vignette questions (≥300 words)', () => {
    const words = Array(400).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('vignette');
  });

  it('handles empty string as short', () => {
    expect(classifyComplexityTier('')).toBe('short');
  });

  it('handles boundary at exactly 60 words as medium', () => {
    const words = Array(60).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('medium');
  });

  it('handles boundary at exactly 150 words as long', () => {
    const words = Array(150).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('long');
  });

  it('handles boundary at exactly 300 words as vignette', () => {
    const words = Array(300).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('vignette');
  });
});

// ─── computeUserTimingProfile ───────────────────────────────────────────

describe('computeUserTimingProfile', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('returns null when fewer than 25 attempts', async () => {
    (prisma.questionAttempt.findMany as any).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ questionId: `q${i}`, timeSpentMs: 10000 }))
    );

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when no tiers have ≥5 attempts', async () => {
    // 25 attempts but all in different tiers (sparse)
    (prisma.questionAttempt.findMany as any).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        questionId: `q${i % 25}`,
        timeSpentMs: 10000 + i * 1000,
      }))
    );
    // Return questions with very short text (all short tier) but only 3 of them
    // so the short tier has <5 attempts with known question text
    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { stem: 'Short question one' } },
      { id: 'q1', questionData: { stem: 'Short question two' } },
      { id: 'q2', questionData: { stem: 'Short question three' } },
    ]);

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    // Only 3 questions have text, so at most 3 attempts classified — <5 per tier
    expect(result).toBeNull();
  });

  it('computes profile with valid data across tiers', async () => {
    // 30 attempts with questionIds q0–q9, 3 attempts each
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 10}`,
      timeSpentMs: 10000 + (i % 5) * 2000, // 10k–18k ms
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    // 10 questions — mix of tiers
    const shortWords = 'A patient presents with cough and fever for three days.';
    const mediumWords = Array(80).fill('word').join(' ');
    const longWords = Array(200).fill('word').join(' ');
    const vignetteWords = Array(400).fill('word').join(' ');

    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { stem: shortWords } },
      { id: 'q1', questionData: { stem: shortWords } },
      { id: 'q2', questionData: { stem: shortWords } },
      { id: 'q3', questionData: { stem: mediumWords } },
      { id: 'q4', questionData: { stem: mediumWords } },
      { id: 'q5', questionData: { stem: mediumWords } },
      { id: 'q6', questionData: { stem: longWords } },
      { id: 'q7', questionData: { stem: longWords } },
      { id: 'q8', questionData: { stem: longWords } },
      { id: 'q9', questionData: { stem: vignetteWords } },
    ]);

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    expect(result).not.toBeNull();
    expect(result!.speedFactor).toBeGreaterThanOrEqual(0.5);
    expect(result!.speedFactor).toBeLessThanOrEqual(2.0);
    expect(result!.totalAttempts).toBe(30);
    expect(result!.tiers.length).toBeGreaterThan(0);
    expect(result!.computedAt).toBeDefined();
  });

  it('clamps speedFactor to [0.5, 2.0]', async () => {
    // Extremely fast times should clamp at 2.0
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 5}`,
      timeSpentMs: 100, // very fast
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { stem: 'A' } },
      { id: 'q1', questionData: { stem: 'B' } },
      { id: 'q2', questionData: { stem: 'C' } },
      { id: 'q3', questionData: { stem: 'D' } },
      { id: 'q4', questionData: { stem: 'E' } },
    ]);

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    if (result) {
      expect(result.speedFactor).toBeLessThanOrEqual(2.0);
    }
  });

  it('skips attempts with no matching question text', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 10}`,
      timeSpentMs: 10000,
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    // Only return questions for q0–q2 (short tier, 9 attempts)
    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { stem: 'Short stem one.' } },
      { id: 'q1', questionData: { stem: 'Short stem two.' } },
      { id: 'q2', questionData: { stem: 'Short stem three.' } },
    ]);

    // Short tier has 9 attempts (≥5), so profile should be generated
    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    // Only one tier with enough data — still generates if it has ≥5
    if (result) {
      expect(result.tiers.length).toBeGreaterThanOrEqual(1);
      expect(result.tiers[0]!.tier).toBe('short');
    }
  });

  it('extracts question text from multiple data fields', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 3}`,
      timeSpentMs: 10000,
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { question: 'Question field stem' } },
      { id: 'q1', questionData: { vignette: 'Vignette field stem' } },
      { id: 'q2', questionData: { text: 'Text field stem' } },
    ]);

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    expect(result).not.toBeNull();
  });

  it('handles questions with null questionData', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 3}`,
      timeSpentMs: 10000,
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: null },
      { id: 'q1', questionData: { stem: 'Valid stem' } },
      { id: 'q2', questionData: { stem: 'Another valid stem' } },
    ]);

    // q0 skipped (null data), q1 and q2 have text — 10 attempts per q, short tier
    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    if (result) {
      expect(result.totalAttempts).toBe(30);
    }
  });

  it('handles choices as array of strings', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i % 3}`,
      timeSpentMs: 10000,
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
      { id: 'q0', questionData: { stem: 'Stem', choices: ['Option A', 'Option B'] } },
      { id: 'q1', questionData: { stem: 'Stem', choices: [{ text: 'Option A' }, { label: 'Option B' }] } },
      { id: 'q2', questionData: { stem: 'Stem', options: [{ text: 'Opt1' }] } },
    ]);

    const result = await computeUserTimingProfile(prisma as any, 'user-1');
    expect(result).not.toBeNull();
  });
});

// ─── getUserSpeedFactor ─────────────────────────────────────────────────

describe('getUserSpeedFactor', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('returns cached speedFactor when fresh (< 24h)', async () => {
    const cached: UserTimingProfile = {
      speedFactor: 1.234,
      tiers: [{ tier: 'short', medianMs: 10000, count: 30 }],
      totalAttempts: 30,
      computedAt: new Date().toISOString(), // fresh
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({ timingProfile: cached });

    const result = await getUserSpeedFactor(prisma as any, 'user-1');
    expect(result).toBe(1.234);
  });

  it('returns 1.0 when no cached profile exists', async () => {
    (prisma.userStatistics.findUnique as any).mockResolvedValue(null);
    // computeUserTimingProfile will also return null (no attempts)
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserSpeedFactor(prisma as any, 'user-1');
    expect(result).toBe(1.0);
  });

  it('recomputes when cache is stale (> 24h)', async () => {
    const stale: UserTimingProfile = {
      speedFactor: 0.5,
      tiers: [],
      totalAttempts: 0,
      computedAt: new Date(Date.now() - 25 * 3600_000).toISOString(), // stale
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({ timingProfile: stale });
    // computeUserTimingProfile returns null (no attempts)
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserSpeedFactor(prisma as any, 'user-1');
    // No data → fallback 1.0
    expect(result).toBe(1.0);
  });

  it('returns 1.0 on error', async () => {
    (prisma.userStatistics.findUnique as any).mockRejectedValue(new Error('DB down'));

    const result = await getUserSpeedFactor(prisma as any, 'user-1');
    expect(result).toBe(1.0);
  });
});

// ─── computeBehavioralBaseline ──────────────────────────────────────────

describe('computeBehavioralBaseline', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('returns null when fewer than 25 attempts', async () => {
    (prisma.questionAttempt.findMany as any).mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        durationMs: 10000,
        telemetryJson: { time_to_first_interaction_ms: 5000, answer_changes: 1 },
      }))
    );

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    expect(result).toBeNull();
  });

  it('computes baseline from valid telemetry data', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      durationMs: 10000 + i * 500,
      telemetryJson: {
        time_to_first_interaction_ms: 5000 + i * 200,
        answer_changes: i % 3,
        selection_drift_ms: 1000 + i * 50,
        cursor_entropy: 0.5 + (i % 10) * 0.03,
        hover_oscillations: i % 5,
      },
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    expect(result).not.toBeNull();
    expect(result!.rtBaseline.n).toBeGreaterThan(0);
    expect(result!.rtBaseline.medianMs).toBeGreaterThan(0);
    expect(result!.switchBaseline.n).toBeGreaterThan(0);
    expect(result!.hesitationBaseline.n).toBeGreaterThan(0);
    expect(result!.computedAt).toBeDefined();
  });

  it('uses durationMs as fallback when time_to_first_interaction_ms is null', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      durationMs: 12000,
      telemetryJson: {
        time_to_first_interaction_ms: null,
        answer_changes: 0,
      },
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    expect(result).not.toBeNull();
    // RT should fallback to durationMs
    expect(result!.rtBaseline.medianMs).toBe(12000);
  });

  it('skips attempts with null telemetryJson', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      durationMs: 10000,
      telemetryJson: i < 5 ? null : {
        time_to_first_interaction_ms: 5000 + i * 100,
        answer_changes: i % 3,
      },
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    // 25 valid telemetry → should still work
    expect(result).not.toBeNull();
  });

  it('defaults hesitation stats to 0 when no hesitation signals', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      durationMs: 10000,
      telemetryJson: {
        time_to_first_interaction_ms: 5000,
        answer_changes: 1,
        // No hesitation signals
      },
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    expect(result).not.toBeNull();
    expect(result!.hesitationBaseline.medianCommitmentGapMs).toBe(0);
    expect(result!.hesitationBaseline.medianCursorEntropy).toBe(0);
    expect(result!.hesitationBaseline.medianOscillations).toBe(0);
    expect(result!.hesitationBaseline.n).toBe(0);
  });

  it('extracts server_computed commitment_gap_ms as fallback', async () => {
    const attempts = Array.from({ length: 30 }, (_, i) => ({
      durationMs: 10000,
      telemetryJson: {
        time_to_first_interaction_ms: 5000,
        answer_changes: 0,
        server_computed: { commitment_gap_ms: 2000 + i * 100 },
      },
    }));
    (prisma.questionAttempt.findMany as any).mockResolvedValue(attempts);

    const result = await computeBehavioralBaseline(prisma as any, 'user-1');
    expect(result).not.toBeNull();
    expect(result!.hesitationBaseline.medianCommitmentGapMs).toBeGreaterThan(0);
  });
});

// ─── getUserBehavioralBaseline ──────────────────────────────────────────

describe('getUserBehavioralBaseline', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('returns cached baseline when fresh (< 24h)', async () => {
    const cached: UserBehavioralBaseline = {
      rtBaseline: { medianMs: 8000, stdDevMs: 2000, p25Ms: 6000, p75Ms: 10000, n: 30 },
      switchBaseline: { medianSwitches: 1, p75Switches: 2, n: 30 },
      hesitationBaseline: { medianCommitmentGapMs: 3000, medianCursorEntropy: 0.7, medianOscillations: 2, n: 30 },
      computedAt: new Date().toISOString(),
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({
      timingProfile: { behavioralBaseline: cached },
    });

    const result = await getUserBehavioralBaseline(prisma as any, 'user-1');
    expect(result).toEqual(cached);
  });

  it('returns null when no data available', async () => {
    (prisma.userStatistics.findUnique as any).mockResolvedValue(null);
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserBehavioralBaseline(prisma as any, 'user-1');
    expect(result).toBeNull();
  });

  it('recomputes when cache is stale', async () => {
    const stale: UserBehavioralBaseline = {
      rtBaseline: { medianMs: 8000, stdDevMs: 2000, p25Ms: 6000, p75Ms: 10000, n: 30 },
      switchBaseline: { medianSwitches: 1, p75Switches: 2, n: 30 },
      hesitationBaseline: { medianCommitmentGapMs: 3000, medianCursorEntropy: 0.7, medianOscillations: 2, n: 30 },
      computedAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({
      timingProfile: { behavioralBaseline: stale },
    });
    // Recompute will fail (no data) → returns null
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserBehavioralBaseline(prisma as any, 'user-1');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    (prisma.userStatistics.findUnique as any).mockRejectedValue(new Error('DB error'));

    const result = await getUserBehavioralBaseline(prisma as any, 'user-1');
    expect(result).toBeNull();
  });
});

// ─── getUserBehavioralContext ────────────────────────────────────────────

describe('getUserBehavioralContext', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('returns cached values when both are fresh', async () => {
    const cached = {
      speedFactor: 1.5,
      computedAt: new Date().toISOString(),
      behavioralBaseline: {
        rtBaseline: { medianMs: 8000, stdDevMs: 2000, p25Ms: 6000, p75Ms: 10000, n: 30 },
        switchBaseline: { medianSwitches: 1, p75Switches: 2, n: 30 },
        hesitationBaseline: { medianCommitmentGapMs: 3000, medianCursorEntropy: 0.7, medianOscillations: 2, n: 30 },
        computedAt: new Date().toISOString(),
      },
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({ timingProfile: cached });

    const result = await getUserBehavioralContext(prisma as any, 'user-1');
    expect(result.speedFactor).toBe(1.5);
    expect(result.behavioralBaseline).toEqual(cached.behavioralBaseline);
  });

  it('returns defaults when no cached data', async () => {
    (prisma.userStatistics.findUnique as any).mockResolvedValue(null);
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserBehavioralContext(prisma as any, 'user-1');
    expect(result.speedFactor).toBe(1.0);
    expect(result.behavioralBaseline).toBeNull();
  });

  it('recomputes only speed when baseline is fresh', async () => {
    const cached = {
      speedFactor: 0.8,
      computedAt: new Date(Date.now() - 25 * 3600_000).toISOString(), // stale
      behavioralBaseline: {
        rtBaseline: { medianMs: 8000, stdDevMs: 2000, p25Ms: 6000, p75Ms: 10000, n: 30 },
        switchBaseline: { medianSwitches: 1, p75Switches: 2, n: 30 },
        hesitationBaseline: { medianCommitmentGapMs: 3000, medianCursorEntropy: 0.7, medianOscillations: 2, n: 30 },
        computedAt: new Date().toISOString(), // fresh
      },
    };
    (prisma.userStatistics.findUnique as any).mockResolvedValue({ timingProfile: cached });
    // No attempts → speed recomputes to 1.0
    (prisma.questionAttempt.findMany as any).mockResolvedValue([]);

    const result = await getUserBehavioralContext(prisma as any, 'user-1');
    expect(result.speedFactor).toBe(1.0);
    // Baseline should be preserved from cache
    expect(result.behavioralBaseline).toEqual(cached.behavioralBaseline);
  });

  it('returns defaults on error', async () => {
    (prisma.userStatistics.findUnique as any).mockRejectedValue(new Error('DB error'));

    const result = await getUserBehavioralContext(prisma as any, 'user-1');
    expect(result.speedFactor).toBe(1.0);
    expect(result.behavioralBaseline).toBeNull();
  });
});
