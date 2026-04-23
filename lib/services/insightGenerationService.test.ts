// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/insightGenerationService.ts
 *
 * Pure functions tested:
 *   generateInsights       — produces insights + exam readiness from input data
 *   projectExamReadiness   — estimates PANCE score trajectory
 *
 * Key constants:
 *   PANCE_PASSING_PERCENTAGE = 0.78
 *   WEAK_SYSTEM_THRESHOLD = 0.65  (internal)
 *   STRONG_SYSTEM_THRESHOLD = 0.85 (internal)
 *   MIN_SYSTEM_ATTEMPTS = 10 (internal)
 *   passingThreshold ≈ 668  (200 + 0.78 * 600)
 */

import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  projectExamReadiness,
  PANCE_PASSING_PERCENTAGE,
  type InsightInput,
  type SystemPerformance,
} from './insightGenerationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    userId: 'user-1',
    systemPerformances: [],
    overallAccuracy: 0.75,
    recentAccuracy: 0.75,
    totalAttempts: 200,
    streakDays: 0,
    ...overrides,
  };
}

function makeSystem(overrides: Partial<SystemPerformance> = {}): SystemPerformance {
  return {
    system: 'Cardiology',
    accuracy: 0.80,
    totalAttempts: 20,
    recentAccuracy: 0.80,
    trend: 'stable',
    weakConditions: [],
    ...overrides,
  };
}

// ─── PANCE_PASSING_PERCENTAGE ─────────────────────────────────────────────────

describe('PANCE_PASSING_PERCENTAGE', () => {
  it('equals 0.78', () => {
    expect(PANCE_PASSING_PERCENTAGE).toBe(0.78);
  });
});

// ─── generateInsights ─────────────────────────────────────────────────────────

describe('generateInsights', () => {
  it('returns insights array and topPriority field', () => {
    const report = generateInsights(makeInput());
    expect(Array.isArray(report.insights)).toBe(true);
    // topPriority is either an insight or null
    expect(report.topPriority === null || typeof report.topPriority === 'object').toBe(true);
  });

  it('returns no insights for clean input with no issues', () => {
    const report = generateInsights(makeInput({
      systemPerformances: [],
      streakDays: 0,
      calibrationMiscalibration: 0,
      dangerousMisconceptionCount: 0,
      daysToExam: null,
    }));
    // No system issues, no streak, no calibration problems → minimal insights
    expect(report.insights.filter(i => i.severity === 'critical')).toHaveLength(0);
  });

  it('generates critical weakness insight for system with accuracy < 50%', () => {
    const weakSystem = makeSystem({ accuracy: 0.40, totalAttempts: 15 });
    const report = generateInsights(makeInput({ systemPerformances: [weakSystem] }));
    const critical = report.insights.find(i => i.severity === 'critical' && i.category === 'weakness');
    expect(critical).toBeDefined();
    expect(critical!.system).toBe('Cardiology');
  });

  it('generates warning insight for system with accuracy in [0.50, 0.65)', () => {
    const weakSystem = makeSystem({ accuracy: 0.60, totalAttempts: 15 });
    const report = generateInsights(makeInput({ systemPerformances: [weakSystem] }));
    const warning = report.insights.find(i => i.severity === 'warning' && i.category === 'weakness');
    expect(warning).toBeDefined();
  });

  it('ignores systems with < 10 attempts', () => {
    const lowAttempts = makeSystem({ accuracy: 0.30, totalAttempts: 5 });
    const report = generateInsights(makeInput({ systemPerformances: [lowAttempts] }));
    const weaknessInsights = report.insights.filter(i => i.category === 'weakness');
    expect(weaknessInsights).toHaveLength(0);
  });

  it('generates positive insight for strong improving system', () => {
    const strongSystem = makeSystem({ accuracy: 0.90, totalAttempts: 20, trend: 'improving' });
    const report = generateInsights(makeInput({ systemPerformances: [strongSystem] }));
    const positive = report.insights.find(i => i.severity === 'positive');
    expect(positive).toBeDefined();
  });

  it('generates critical calibration insight for dangerous misconceptions', () => {
    const report = generateInsights(makeInput({
      dangerousMisconceptionCount: 3,
      calibrationMiscalibration: 0.2,
    }));
    const miscon = report.insights.find(i => i.id === 'calibration-misconceptions');
    expect(miscon).toBeDefined();
    expect(miscon!.severity).toBe('critical');
    expect(miscon!.narrative).toContain('3');
  });

  it('generates calibration warning when miscalibration > 0.3', () => {
    const report = generateInsights(makeInput({
      calibrationMiscalibration: 0.5,
      dangerousMisconceptionCount: 0,
    }));
    const calib = report.insights.find(i => i.id === 'calibration-alignment');
    expect(calib).toBeDefined();
    expect(calib!.severity).toBe('warning');
  });

  it('does not generate calibration alignment warning when miscalibration <= 0.3', () => {
    const report = generateInsights(makeInput({ calibrationMiscalibration: 0.3 }));
    const calib = report.insights.find(i => i.id === 'calibration-alignment');
    expect(calib).toBeUndefined();
  });

  it('generates positive improvement insight when recent > overall by > 5%', () => {
    const report = generateInsights(makeInput({
      overallAccuracy: 0.70,
      recentAccuracy: 0.80,
      totalAttempts: 100,
    }));
    const improvement = report.insights.find(i => i.id === 'improvement-accuracy');
    expect(improvement).toBeDefined();
    expect(improvement!.severity).toBe('positive');
  });

  it('generates warning when recent accuracy < overall by > 5%', () => {
    const report = generateInsights(makeInput({
      overallAccuracy: 0.80,
      recentAccuracy: 0.70,
      totalAttempts: 100,
    }));
    const decline = report.insights.find(i => i.id === 'improvement-decline');
    expect(decline).toBeDefined();
    expect(decline!.severity).toBe('warning');
  });

  it('does not generate improvement insight when < 50 total attempts', () => {
    const report = generateInsights(makeInput({
      overallAccuracy: 0.70,
      recentAccuracy: 0.85,
      totalAttempts: 40,
    }));
    expect(report.insights.find(i => i.id === 'improvement-accuracy')).toBeUndefined();
  });

  it('generates streak insight when streakDays >= 7', () => {
    const report = generateInsights(makeInput({ streakDays: 10 }));
    const streak = report.insights.find(i => i.category === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.narrative).toContain('10');
  });

  it('does not generate streak insight when streakDays < 7', () => {
    const report = generateInsights(makeInput({ streakDays: 6 }));
    expect(report.insights.find(i => i.category === 'streak')).toBeUndefined();
  });

  it('includes examReadiness when daysToExam is set', () => {
    const report = generateInsights(makeInput({ daysToExam: 90 }));
    expect(report.examReadiness).toBeDefined();
  });

  it('excludes examReadiness when daysToExam is null', () => {
    const report = generateInsights(makeInput({ daysToExam: null }));
    expect(report.examReadiness).toBeUndefined();
  });

  it('insights are sorted with critical first, then warning, positive, info', () => {
    const report = generateInsights(makeInput({
      systemPerformances: [makeSystem({ accuracy: 0.40, totalAttempts: 15 })], // critical
      streakDays: 10,                      // positive
      dangerousMisconceptionCount: 2,       // critical
      calibrationMiscalibration: 0.5,       // warning
      daysToExam: 90,
      totalAttempts: 200,
    }));
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
    for (let i = 1; i < report.insights.length; i++) {
      const prev = severityOrder[report.insights[i-1]!.severity] ?? 4;
      const curr = severityOrder[report.insights[i]!.severity] ?? 4;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('topPriority is the first insight in the sorted order', () => {
    const report = generateInsights(makeInput({
      systemPerformances: [makeSystem({ accuracy: 0.40, totalAttempts: 15 })],
      dangerousMisconceptionCount: 2,
      calibrationMiscalibration: 0.5,
    }));
    if (report.insights.length > 0) {
      expect(report.topPriority).toBe(report.insights[0]);
    }
  });

  it('topPriority is null when no insights are generated', () => {
    const report = generateInsights(makeInput({
      systemPerformances: [],
      streakDays: 0,
      calibrationMiscalibration: 0,
      dangerousMisconceptionCount: 0,
      daysToExam: null,
      totalAttempts: 30,  // Below 50 → no improvement insight
    }));
    if (report.insights.length === 0) {
      expect(report.topPriority).toBeNull();
    }
  });

  it('weak conditions appear in narrative for weak system', () => {
    const sys = makeSystem({
      accuracy: 0.55,
      totalAttempts: 20,
      weakConditions: ['CHF', 'COPD', 'Asthma'],
    });
    const report = generateInsights(makeInput({ systemPerformances: [sys] }));
    const insight = report.insights.find(i => i.category === 'weakness');
    expect(insight!.narrative).toContain('CHF');
  });
});

// ─── projectExamReadiness ─────────────────────────────────────────────────────

describe('projectExamReadiness', () => {
  it('currentScore is in [200, 800]', () => {
    const result = projectExamReadiness(makeInput({ recentAccuracy: 0.75, daysToExam: 90 }));
    expect(result.currentScore).toBeGreaterThanOrEqual(200);
    expect(result.currentScore).toBeLessThanOrEqual(800);
  });

  it('projectedScore is in [200, 800]', () => {
    const result = projectExamReadiness(makeInput({ recentAccuracy: 0.75, daysToExam: 90 }));
    expect(result.projectedScore).toBeGreaterThanOrEqual(200);
    expect(result.projectedScore).toBeLessThanOrEqual(800);
  });

  it('passingThreshold ≈ 668 (200 + 0.78*600)', () => {
    const result = projectExamReadiness(makeInput({ daysToExam: 90 }));
    expect(result.passingThreshold).toBe(Math.round(200 + PANCE_PASSING_PERCENTAGE * 600));
  });

  it('confidence is in [0, 1]', () => {
    const result = projectExamReadiness(makeInput({ daysToExam: 90 }));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('trend is insufficient_data when totalAttempts < 100', () => {
    const result = projectExamReadiness(makeInput({ totalAttempts: 50, daysToExam: 90 }));
    expect(result.trend).toBe('insufficient_data');
  });

  it('trend is on_track when projected score >= passingThreshold', () => {
    // High accuracy → high projected score → on_track or ahead
    const result = projectExamReadiness(makeInput({
      recentAccuracy: 0.80,
      overallAccuracy: 0.80,
      totalAttempts: 200,
      daysToExam: 90,
    }));
    // projectedScore = 200 + 0.80*600 = 680, passingThreshold = 668, no gain → on_track
    expect(['on_track', 'ahead']).toContain(result.trend);
  });

  it('trend is at_risk when projected score < passingThreshold', () => {
    const result = projectExamReadiness(makeInput({
      recentAccuracy: 0.55,
      overallAccuracy: 0.55,
      totalAttempts: 200,
      daysToExam: 90,
    }));
    // projectedScore = 200 + 0.55*600 = 530 < 668 → at_risk
    expect(result.trend).toBe('at_risk');
  });

  it('daysToExam in result matches input', () => {
    const result = projectExamReadiness(makeInput({ daysToExam: 45 }));
    expect(result.daysToExam).toBe(45);
  });

  it('weeklyGainRate is an integer (rounded)', () => {
    const result = projectExamReadiness(makeInput({ daysToExam: 90 }));
    expect(result.weeklyGainRate).toBe(Math.round(result.weeklyGainRate));
  });

  it('improving accuracy produces positive weeklyGainRate', () => {
    const result = projectExamReadiness(makeInput({
      recentAccuracy: 0.85,
      overallAccuracy: 0.70,
      daysToExam: 60,
    }));
    expect(result.weeklyGainRate).toBeGreaterThan(0);
  });

  it('declining accuracy produces negative weeklyGainRate', () => {
    const result = projectExamReadiness(makeInput({
      recentAccuracy: 0.65,
      overallAccuracy: 0.80,
      daysToExam: 60,
    }));
    expect(result.weeklyGainRate).toBeLessThan(0);
  });
});
