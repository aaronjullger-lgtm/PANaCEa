import { describe, it, expect } from 'vitest';

/**
 * Tests for the session clustering logic used in generate-daily-insights.ts
 * 
 * Sessions are identified by clustering attempts where gaps > 30min indicate a new session.
 * Average session length is computed as total session time / session count.
 */

// Inline the clustering algorithm for testing
function computeAvgSessionLength(createdAts: number[]): number {
  if (createdAts.length < 2) return 0;

  const sorted = [...createdAts].sort((a, b) => a - b);
  const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

  let totalSessionMs = 0;
  let sessionCount = 0;
  let sessionStart = sorted[0]!;
  let lastAttempt = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i]!;
    if (t - lastAttempt > SESSION_GAP_MS) {
      totalSessionMs += lastAttempt - sessionStart;
      sessionCount++;
      sessionStart = t;
    }
    lastAttempt = t;
  }
  totalSessionMs += lastAttempt - sessionStart;
  sessionCount++;

  return Math.round(totalSessionMs / sessionCount / 60000); // minutes
}

describe('Session clustering for daily insights', () => {
  it('returns 0 for fewer than 2 attempts', () => {
    expect(computeAvgSessionLength([])).toBe(0);
    expect(computeAvgSessionLength([Date.now()])).toBe(0);
  });

  it('computes single session correctly', () => {
    const base = Date.now();
    // 5 attempts over 20 minutes
    const attempts = [
      base,
      base + 5 * 60 * 1000,   // +5min
      base + 10 * 60 * 1000,  // +10min
      base + 15 * 60 * 1000,  // +15min
      base + 20 * 60 * 1000,  // +20min
    ];
    expect(computeAvgSessionLength(attempts)).toBe(20);
  });

  it('splits into multiple sessions at 30+ min gaps', () => {
    const base = Date.now();
    // Session 1: 0-10min (10min duration)
    // Gap: 45min
    // Session 2: 55-65min (10min duration)
    const attempts = [
      base,
      base + 10 * 60 * 1000,    // +10min (session 1 end)
      base + 55 * 60 * 1000,    // +55min (session 2 start, 45min gap)
      base + 65 * 60 * 1000,    // +65min (session 2 end)
    ];
    // Total: (10 + 10) / 2 = 10 min average
    expect(computeAvgSessionLength(attempts)).toBe(10);
  });

  it('handles unsorted input', () => {
    const base = Date.now();
    const attempts = [
      base + 10 * 60 * 1000,
      base,
      base + 5 * 60 * 1000,
    ];
    expect(computeAvgSessionLength(attempts)).toBe(10);
  });

  it('computes 3 sessions correctly', () => {
    const base = Date.now();
    const HOUR = 60 * 60 * 1000;
    // Session 1: 0-15min (15min)
    // Session 2: 2h-2h10min (10min)
    // Session 3: 4h-4h30min (30min)
    const attempts = [
      base,
      base + 15 * 60 * 1000,
      base + 2 * HOUR,
      base + 2 * HOUR + 10 * 60 * 1000,
      base + 4 * HOUR,
      base + 4 * HOUR + 30 * 60 * 1000,
    ];
    // Total: (15 + 10 + 30) / 3 = 18.33 → 18 min
    expect(computeAvgSessionLength(attempts)).toBe(18);
  });
});
