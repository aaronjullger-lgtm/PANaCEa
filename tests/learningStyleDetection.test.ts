import { describe, it, expect } from 'vitest';
import {
  detectLearningStyle,
  hasSufficientDataForDetection,
  type LearningBehaviorData,
} from '../lib/learningStyleDetection';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build an array of N question attempts with configurable timing + correctness.
 * Timestamps spaced 1 minute apart starting from `startDate`.
 */
function makeAttempts(
  count: number,
  opts: {
    timeToFirstClick: number;
    answerChanges: number;
    dwellTime: number;
    correctRate?: number;
    startDate?: Date;
    spacingMs?: number;
  }
): LearningBehaviorData['attempts'] {
  const {
    timeToFirstClick,
    answerChanges,
    dwellTime,
    correctRate = 0.7,
    startDate = new Date('2026-01-01T00:00:00Z'),
    spacingMs = 60_000,
  } = opts;

  // Interleaved correct/incorrect pattern (avoids ordering artifacts)
  const correctCount = Math.round(count * correctRate);
  return Array.from({ length: count }, (_, i) => {
    const isCorrect =
      Math.floor(((i + 1) * correctCount) / count) > Math.floor((i * correctCount) / count);
    return {
      timeToFirstClick,
      answerChanges,
      dwellTime,
      wasCorrect: isCorrect,
      createdAt: new Date(startDate.getTime() + i * spacingMs),
    };
  });
}

function emptyData(): LearningBehaviorData {
  return { attempts: [], sessions: [] };
}

// ─── detectLearningStyle: pace detection ────────────────────────────────────

describe('detectLearningStyle — pace preference', () => {
  it('defaults to "balanced" with low confidence under 10 attempts', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(5, { timeToFirstClick: 2000, answerChanges: 0, dwellTime: 5000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.pacePreference).toBe('balanced');
    expect(profile.confidence.pace).toBe(0.3);
  });

  it('classifies fast + few changes as "fast-decider"', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(25, { timeToFirstClick: 2000, answerChanges: 0, dwellTime: 5000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.pacePreference).toBe('fast-decider');
    expect(profile.confidence.pace).toBeGreaterThan(0);
  });

  it('classifies slow + long dwell as "thorough-analyzer"', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(25, { timeToFirstClick: 10_000, answerChanges: 2, dwellTime: 80_000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.pacePreference).toBe('thorough-analyzer');
  });

  it('classifies middle-ground timing as "balanced"', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(25, { timeToFirstClick: 5000, answerChanges: 1, dwellTime: 30_000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.pacePreference).toBe('balanced');
  });

  it('caps fast-decider confidence at 0.9 (50+ attempts)', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(100, { timeToFirstClick: 2000, answerChanges: 0, dwellTime: 5000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.confidence.pace).toBeLessThanOrEqual(0.9);
  });
});

// ─── detectLearningStyle: explanation engagement ────────────────────────────

describe('detectLearningStyle — explanation engagement', () => {
  it('returns "minimal" when no explanation views are tracked', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(20, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
      explanationViews: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.explanationEngagement).toBe('minimal');
  });

  it('classifies deep-dive (>70% view rate, >45s duration, >50% pre-answer)', () => {
    const attempts = makeAttempts(10, {
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
    });
    // 8 views out of 10 attempts = 80% rate, 50s duration, 6 before answer = 75%
    const explanationViews = Array.from({ length: 8 }, (_, i) => ({
      viewedBeforeAnswer: i < 6,
      viewDurationMs: 50_000,
    }));
    const data: LearningBehaviorData = {
      attempts,
      sessions: [],
      explanationViews,
    };
    const profile = detectLearningStyle(data);
    expect(profile.explanationEngagement).toBe('deep-dive');
  });

  it('classifies minimal (<20% view rate)', () => {
    const attempts = makeAttempts(20, {
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
    });
    // 2 views / 20 attempts = 10% → minimal
    const explanationViews = Array.from({ length: 2 }, () => ({
      viewedBeforeAnswer: false,
      viewDurationMs: 30_000,
    }));
    const data: LearningBehaviorData = {
      attempts,
      sessions: [],
      explanationViews,
    };
    const profile = detectLearningStyle(data);
    expect(profile.explanationEngagement).toBe('minimal');
  });

  it('classifies moderate (middle range)', () => {
    const attempts = makeAttempts(20, {
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
    });
    // 8 views / 20 attempts = 40%, 30s duration → moderate
    const explanationViews = Array.from({ length: 8 }, () => ({
      viewedBeforeAnswer: false,
      viewDurationMs: 30_000,
    }));
    const data: LearningBehaviorData = {
      attempts,
      sessions: [],
      explanationViews,
    };
    const profile = detectLearningStyle(data);
    expect(profile.explanationEngagement).toBe('moderate');
  });
});

// ─── detectLearningStyle: repetition pattern ────────────────────────────────

describe('detectLearningStyle — repetition pattern', () => {
  it('returns "mixed" with low confidence under 20 review entries', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(20, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
      reviewHistory: [{ cardId: 'c1', interval: 5, wasReview: true }],
    };
    const profile = detectLearningStyle(data);
    expect(profile.repetitionPattern).toBe('mixed');
    expect(profile.confidence.repetition).toBeCloseTo(0.4, 1);
  });

  it('classifies spaced-repetition (avg interval > 5, stddev > 3)', () => {
    const intervals = [3, 7, 14, 21, 5, 10, 2, 30, 6, 12, 4, 8, 15, 9, 18, 11, 13, 25, 7, 6, 5, 4];
    const reviewHistory = intervals.map((i, idx) => ({
      cardId: `c${idx}`,
      interval: i,
      wasReview: true,
    }));
    const data: LearningBehaviorData = {
      attempts: makeAttempts(20, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
      reviewHistory,
    };
    const profile = detectLearningStyle(data);
    expect(profile.repetitionPattern).toBe('spaced-repetition');
  });

  it('classifies mass-practice (avg interval < 2, stddev < 1)', () => {
    const reviewHistory = Array.from({ length: 25 }, (_, i) => ({
      cardId: `c${i}`,
      interval: 1, // all intervals = 1
      wasReview: true,
    }));
    const data: LearningBehaviorData = {
      attempts: makeAttempts(20, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
      reviewHistory,
    };
    const profile = detectLearningStyle(data);
    expect(profile.repetitionPattern).toBe('mass-practice');
  });

  it('classifies mixed (no clear pattern: moderate interval OR low stddev with high interval)', () => {
    // Medium interval (3-4) with moderate variance → falls into mixed
    const reviewHistory = Array.from({ length: 25 }, (_, i) => ({
      cardId: `c${i}`,
      interval: i % 2 === 0 ? 3 : 4,
      wasReview: true,
    }));
    const data: LearningBehaviorData = {
      attempts: makeAttempts(20, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
      reviewHistory,
    };
    const profile = detectLearningStyle(data);
    expect(profile.repetitionPattern).toBe('mixed');
  });
});

// ─── detectLearningStyle: error recovery ────────────────────────────────────

describe('detectLearningStyle — error recovery', () => {
  it('defaults to "reflective" with low confidence under 20 attempts', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(10, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.errorRecovery).toBe('reflective');
  });

  it('classifies persistent when post-error delay < 2 minutes', () => {
    // 30 attempts spaced 30s apart → post-error delay = 30s = 0.5 min
    const data: LearningBehaviorData = {
      attempts: makeAttempts(30, {
        timeToFirstClick: 5000,
        answerChanges: 0,
        dwellTime: 20_000,
        correctRate: 0.5,
        spacingMs: 30_000,
      }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    expect(profile.errorRecovery).toBe('persistent');
  });

  it('does not flag persistent when all attempts are correct (no error events)', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(30, {
        timeToFirstClick: 5000,
        answerChanges: 0,
        dwellTime: 20_000,
        correctRate: 1.0,
      }),
      sessions: [],
    };
    const profile = detectLearningStyle(data);
    // With no errors, returns reflective with 0.5 confidence
    expect(profile.errorRecovery).toBe('reflective');
  });
});

// ─── detectLearningStyle: overall profile shape ─────────────────────────────

describe('detectLearningStyle — profile structure', () => {
  it('produces a non-empty overallStyle combining pace + engagement', () => {
    const attempts = makeAttempts(25, {
      timeToFirstClick: 2000,
      answerChanges: 0,
      dwellTime: 5000,
    });
    const profile = detectLearningStyle({ attempts, sessions: [] });
    // "Intuitive Efficient Learner" (fast-decider + minimal)
    expect(profile.overallStyle).toContain('Intuitive');
    expect(profile.overallStyle).toContain('Efficient');
  });

  it('returns recommendations array with at least one entry', () => {
    const attempts = makeAttempts(25, {
      timeToFirstClick: 2000,
      answerChanges: 0,
      dwellTime: 5000,
    });
    const profile = detectLearningStyle({ attempts, sessions: [] });
    expect(Array.isArray(profile.recommendations)).toBe(true);
    expect(profile.recommendations.length).toBeGreaterThan(0);
  });

  it('counts unique days from attempts', () => {
    // 3 attempts on day 1, 3 on day 2, 3 on day 3 → 3 unique days
    const day1 = new Date('2026-01-01T10:00:00Z');
    const day2 = new Date('2026-01-02T10:00:00Z');
    const day3 = new Date('2026-01-03T10:00:00Z');
    const attempts = [day1, day1, day1, day2, day2, day2, day3, day3, day3].map((d) => ({
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
      wasCorrect: true,
      createdAt: d,
    }));
    const profile = detectLearningStyle({ attempts, sessions: [] });
    expect(profile.dataPoints.days).toBe(3);
    expect(profile.dataPoints.questions).toBe(9);
  });

  it('sets lastAnalyzed to a Date', () => {
    const profile = detectLearningStyle(emptyData());
    expect(profile.lastAnalyzed).toBeInstanceOf(Date);
  });
});

// ─── hasSufficientDataForDetection ──────────────────────────────────────────

describe('hasSufficientDataForDetection', () => {
  it('reports insufficient when attempts < 20', () => {
    const data: LearningBehaviorData = {
      attempts: makeAttempts(5, { timeToFirstClick: 5000, answerChanges: 0, dwellTime: 20_000 }),
      sessions: [],
    };
    const result = hasSufficientDataForDetection(data);
    expect(result.sufficient).toBe(false);
    expect(result.missing.some((s) => s.includes('question attempts'))).toBe(true);
  });

  it('reports insufficient when sessions < 3', () => {
    const attempts = makeAttempts(25, {
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
    });
    const data: LearningBehaviorData = {
      attempts,
      sessions: [
        { questionsAnswered: 10, durationMs: 600_000, avgAccuracy: 0.7, createdAt: new Date() },
      ],
    };
    const result = hasSufficientDataForDetection(data);
    expect(result.sufficient).toBe(false);
    expect(result.missing.some((s) => s.includes('study sessions'))).toBe(true);
  });

  it('reports insufficient when unique days < 3', () => {
    // 25 attempts all same day
    const attempts = makeAttempts(25, {
      timeToFirstClick: 5000,
      answerChanges: 0,
      dwellTime: 20_000,
      spacingMs: 60_000, // all within ~25 min of start
    });
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      questionsAnswered: 10,
      durationMs: 600_000,
      avgAccuracy: 0.7,
      createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
    }));
    const data: LearningBehaviorData = { attempts, sessions };
    const result = hasSufficientDataForDetection(data);
    expect(result.sufficient).toBe(false);
    expect(result.missing.some((s) => s.includes('more days'))).toBe(true);
  });

  it('returns sufficient + "low" confidence at minimal thresholds', () => {
    const startDate = new Date('2026-01-01T00:00:00Z');
    // 20 attempts spread across 3 days: spacingMs = 1.5 days → 30 attempts would span 30 days
    // Easier: build attempts manually, 7 per day for 3 days = 21 attempts
    const attempts: LearningBehaviorData['attempts'] = [];
    for (let day = 0; day < 3; day++) {
      for (let i = 0; i < 7; i++) {
        attempts.push({
          timeToFirstClick: 5000,
          answerChanges: 0,
          dwellTime: 20_000,
          wasCorrect: true,
          createdAt: new Date(startDate.getTime() + day * 86_400_000 + i * 60_000),
        });
      }
    }
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      questionsAnswered: 7,
      durationMs: 600_000,
      avgAccuracy: 0.7,
      createdAt: new Date(startDate.getTime() + i * 86_400_000),
    }));
    const result = hasSufficientDataForDetection({ attempts, sessions });
    expect(result.sufficient).toBe(true);
    expect(result.confidence).toBe('low');
  });

  it('returns "medium" confidence at 50 attempts / 5 sessions / 5 days', () => {
    const startDate = new Date('2026-01-01T00:00:00Z');
    const attempts: LearningBehaviorData['attempts'] = [];
    for (let day = 0; day < 5; day++) {
      for (let i = 0; i < 10; i++) {
        attempts.push({
          timeToFirstClick: 5000,
          answerChanges: 0,
          dwellTime: 20_000,
          wasCorrect: true,
          createdAt: new Date(startDate.getTime() + day * 86_400_000 + i * 60_000),
        });
      }
    }
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      questionsAnswered: 10,
      durationMs: 600_000,
      avgAccuracy: 0.7,
      createdAt: new Date(startDate.getTime() + i * 86_400_000),
    }));
    const result = hasSufficientDataForDetection({ attempts, sessions });
    expect(result.sufficient).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('returns "high" confidence at 100 attempts / 10 sessions / 7 days', () => {
    const startDate = new Date('2026-01-01T00:00:00Z');
    const attempts: LearningBehaviorData['attempts'] = [];
    for (let day = 0; day < 7; day++) {
      for (let i = 0; i < 15; i++) {
        attempts.push({
          timeToFirstClick: 5000,
          answerChanges: 0,
          dwellTime: 20_000,
          wasCorrect: true,
          createdAt: new Date(startDate.getTime() + day * 86_400_000 + i * 60_000),
        });
      }
    }
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      questionsAnswered: 15,
      durationMs: 600_000,
      avgAccuracy: 0.7,
      createdAt: new Date(startDate.getTime() + i * 86_400_000),
    }));
    const result = hasSufficientDataForDetection({ attempts, sessions });
    expect(result.sufficient).toBe(true);
    expect(result.confidence).toBe('high');
  });
});
