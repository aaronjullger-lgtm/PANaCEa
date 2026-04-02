/**
 * Tests for insightGenerationService — Sprint 3E
 * All functions are pure — fully testable.
 */

import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  projectExamReadiness,
  PANCE_PASSING_PERCENTAGE,
  type InsightInput,
  type SystemPerformance,
} from '../lib/services/insightGenerationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides?: Partial<InsightInput>): InsightInput {
  return {
    userId: 'test-user',
    systemPerformances: [],
    overallAccuracy: 0.70,
    recentAccuracy: 0.75,
    totalAttempts: 200,
    streakDays: 3,
    daysToExam: 60,
    ...overrides,
  };
}

function makeSystemPerf(overrides?: Partial<SystemPerformance>): SystemPerformance {
  return {
    system: 'Cardiovascular',
    accuracy: 0.80,
    totalAttempts: 50,
    recentAccuracy: 0.82,
    trend: 'stable',
    weakConditions: [],
    ...overrides,
  };
}
// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Insight Generation — Weakness Detection', () => {
  it('flags systems below 65% as weak', () => {
    const input = makeInput({
      systemPerformances: [
        makeSystemPerf({ system: 'Pulmonary', accuracy: 0.45, totalAttempts: 20, trend: 'declining' }),
      ],
    });
    const report = generateInsights(input);
    const weakness = report.insights.find(i => i.category === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.system).toBe('Pulmonary');
    expect(weakness!.severity).toBe('critical'); // accuracy 0.45 < 0.50 → critical
  });

  it('does not flag systems with < 10 attempts', () => {
    const input = makeInput({
      systemPerformances: [
        makeSystemPerf({ system: 'Dermatology', accuracy: 0.40, totalAttempts: 5 }),
      ],
    });
    const report = generateInsights(input);
    expect(report.insights.filter(i => i.category === 'weakness')).toHaveLength(0);
  });

  it('highlights strong improving systems as positive', () => {
    const input = makeInput({
      systemPerformances: [
        makeSystemPerf({ system: 'Neuro', accuracy: 0.90, totalAttempts: 40, trend: 'improving' }),
      ],
    });
    const report = generateInsights(input);
    const positive = report.insights.find(i => i.category === 'improvement' && i.system === 'Neuro');
    expect(positive).toBeDefined();
    expect(positive!.severity).toBe('positive');
  });
});
describe('Insight Generation — Calibration', () => {
  it('flags dangerous misconceptions', () => {
    const input = makeInput({ dangerousMisconceptionCount: 3, calibrationMiscalibration: 0.4 });
    const report = generateInsights(input);
    const misconception = report.insights.find(i => i.id === 'calibration-misconceptions');
    expect(misconception).toBeDefined();
    expect(misconception!.severity).toBe('critical');
  });

  it('flags high miscalibration', () => {
    const input = makeInput({ calibrationMiscalibration: 0.45 });
    const report = generateInsights(input);
    const cal = report.insights.find(i => i.id === 'calibration-alignment');
    expect(cal).toBeDefined();
    expect(cal!.severity).toBe('warning');
  });
});

describe('Insight Generation — Streaks and Improvement', () => {
  it('generates streak insight for 7+ day streaks', () => {
    const input = makeInput({ streakDays: 12 });
    const report = generateInsights(input);
    const streak = report.insights.find(i => i.category === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.title).toContain('12');
  });

  it('detects accuracy improvement', () => {
    const input = makeInput({ overallAccuracy: 0.65, recentAccuracy: 0.78, totalAttempts: 100 });
    const report = generateInsights(input);
    const improvement = report.insights.find(i => i.id === 'improvement-accuracy');
    expect(improvement).toBeDefined();
    expect(improvement!.severity).toBe('positive');
  });

  it('detects accuracy decline', () => {
    const input = makeInput({ overallAccuracy: 0.80, recentAccuracy: 0.68, totalAttempts: 100 });
    const report = generateInsights(input);
    const decline = report.insights.find(i => i.id === 'improvement-decline');
    expect(decline).toBeDefined();
    expect(decline!.severity).toBe('warning');
  });
});
describe('Insight Generation — Exam Readiness Projection', () => {
  it('classifies at_risk when projected below passing', () => {
    const input = makeInput({ overallAccuracy: 0.55, recentAccuracy: 0.58, daysToExam: 30, totalAttempts: 200 });
    const readiness = projectExamReadiness(input);
    // currentScore = 200 + 0.58*600 = 548; passing = 200 + 0.78*600 = 668
    expect(readiness.currentScore).toBeLessThan(readiness.passingThreshold);
    expect(readiness.trend).toBe('at_risk');
  });

  it('classifies ahead when well above passing', () => {
    const input = makeInput({ overallAccuracy: 0.85, recentAccuracy: 0.92, daysToExam: 60, totalAttempts: 500 });
    const readiness = projectExamReadiness(input);
    // currentScore = 200 + 0.92*600 = 752; passing = 668
    expect(readiness.currentScore).toBeGreaterThan(readiness.passingThreshold);
    expect(readiness.trend).toBe('ahead');
  });

  it('returns insufficient_data for < 100 attempts', () => {
    const input = makeInput({ totalAttempts: 50, daysToExam: 60 });
    const readiness = projectExamReadiness(input);
    expect(readiness.trend).toBe('insufficient_data');
  });

  it('passing threshold maps to PANCE 78%', () => {
    const input = makeInput({ daysToExam: 30 });
    const readiness = projectExamReadiness(input);
    // passing = 200 + 0.78 * 600 = 668
    expect(readiness.passingThreshold).toBe(Math.round(200 + PANCE_PASSING_PERCENTAGE * 600));
  });

  it('confidence increases with more data', () => {
    const low = projectExamReadiness(makeInput({ totalAttempts: 50, daysToExam: 30 }));
    const high = projectExamReadiness(makeInput({ totalAttempts: 500, daysToExam: 30 }));
    expect(high.confidence).toBeGreaterThan(low.confidence);
  });
});

describe('Insight Generation — Sorting and Priority', () => {
  it('sorts critical insights first', () => {
    const input = makeInput({
      systemPerformances: [
        makeSystemPerf({ system: 'Cardio', accuracy: 0.45, totalAttempts: 30, trend: 'declining' }),
      ],
      streakDays: 10,
      dangerousMisconceptionCount: 2,
      calibrationMiscalibration: 0.5,
    });
    const report = generateInsights(input);
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.insights[0]!.severity).toBe('critical');
    expect(report.topPriority).toBeDefined();
    expect(report.topPriority!.severity).toBe('critical');
  });
});
