/**
 * Tests for proactive fatigue detection in the wellness engine.
 */
import { describe, it, expect } from 'vitest';
import { detectProactiveFatigue, type SessionAttempt } from '../wellnessEngine';

function makeAttempts(
  count: number,
  opts: {
    correctRate?: number;
    baseRtMs?: number;
    rtIncreasePerQ?: number;
    startTime?: Date;
    intervalMs?: number;
  } = {}
): SessionAttempt[] {
  const {
    correctRate = 0.8,
    baseRtMs = 5000,
    rtIncreasePerQ = 0,
    startTime = new Date('2026-04-06T10:00:00Z'),
    intervalMs = 60_000,
  } = opts;

  const attempts: SessionAttempt[] = [];
  for (let i = 0; i < count; i++) {
    attempts.push({
      wasCorrect: Math.random() < correctRate,
      responseTimeMs: baseRtMs + rtIncreasePerQ * i,
      timestamp: new Date(startTime.getTime() + i * intervalMs),
    });
  }
  return attempts;
}

/** Deterministic attempt generator (no randomness) */
function deterministicAttempts(
  sequence: { correct: boolean; rtMs: number }[],
  startTime = new Date('2026-04-06T10:00:00Z'),
  intervalMs = 60_000
): SessionAttempt[] {
  return sequence.map((s, i) => ({
    wasCorrect: s.correct,
    responseTimeMs: s.rtMs,
    timestamp: new Date(startTime.getTime() + i * intervalMs),
  }));
}

describe('detectProactiveFatigue', () => {
  it('returns fresh for fewer than 8 attempts', () => {
    const attempts = makeAttempts(5);
    const result = detectProactiveFatigue(attempts);
    expect(result.fatigueLevel).toBe('fresh');
    expect(result.nudgeMessage).toBeNull();
  });

  it('returns fresh for consistent good performance', () => {
    const attempts = deterministicAttempts(
      Array.from({ length: 15 }, () => ({ correct: true, rtMs: 5000 }))
    );
    const result = detectProactiveFatigue(attempts);
    expect(result.fatigueLevel).toBe('fresh');
  });

  it('detects warming when RT is trending up', () => {
    // 12 questions: first 7 fast, last 5 with increasing RT
    const seq = [
      ...Array.from({ length: 7 }, () => ({ correct: true, rtMs: 4000 })),
      { correct: true, rtMs: 5000 },
      { correct: true, rtMs: 6000 },
      { correct: true, rtMs: 7000 },
      { correct: true, rtMs: 8000 },
      { correct: true, rtMs: 9000 },
    ];
    const attempts = deterministicAttempts(seq);
    const result = detectProactiveFatigue(attempts);
    // Rolling window of last 5 has strong positive slope
    expect(['warming', 'break_suggested']).toContain(result.fatigueLevel);
  });

  it('detects break_suggested when accuracy drops sharply in rolling window', () => {
    // 15 questions: first 10 correct, last 5 all wrong
    const seq = [
      ...Array.from({ length: 10 }, () => ({ correct: true, rtMs: 5000 })),
      ...Array.from({ length: 5 }, () => ({ correct: false, rtMs: 7000 })),
    ];
    const attempts = deterministicAttempts(seq);
    const result = detectProactiveFatigue(attempts);
    expect(result.fatigueLevel).toBe('break_suggested');
    expect(result.nudgeMessage).not.toBeNull();
    expect(result.suggestedBreakMinutes).toBeGreaterThan(0);
  });

  it('provides recentAccuracy and recentRtSlope values', () => {
    const seq = [
      ...Array.from({ length: 8 }, () => ({ correct: true, rtMs: 4000 })),
      ...Array.from({ length: 5 }, () => ({ correct: false, rtMs: 6000 })),
    ];
    const attempts = deterministicAttempts(seq);
    const result = detectProactiveFatigue(attempts);
    expect(result.recentAccuracy).toBeDefined();
    expect(typeof result.recentAccuracy).toBe('number');
    expect(result.recentRtSlope).toBeDefined();
  });

  it('detects warming for long session even with good accuracy', () => {
    // 50 questions over 50 minutes — crosses the 45-min threshold
    const seq = Array.from({ length: 50 }, () => ({ correct: true, rtMs: 5500 }));
    const attempts = deterministicAttempts(seq);
    const result = detectProactiveFatigue(attempts);
    expect(['warming', 'break_suggested']).toContain(result.fatigueLevel);
  });
});
