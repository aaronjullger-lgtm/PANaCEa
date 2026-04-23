// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/calibrationEngine.ts
 *
 * Pure functions tested:
 *   analyzeCalibration     — classifies entries into 2×2 quadrants, finds misconceptions
 *   checkForMisconception  — detects confident-but-wrong patterns for one condition
 *   getCalibrationFeedback — returns state + message + emoji for a single answer
 *
 * Constants:
 *   CONFIDENCE_THRESHOLD = 0.6         (isConfident gate)
 *   MIN_ENTRIES_FOR_MISCONCEPTION = 3  (condition must have >= 3 entries)
 *   MISCONCEPTION_THRESHOLD = 0.6      (60% of entries must be confident-wrong)
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeCalibration,
  checkForMisconception,
  getCalibrationFeedback,
  type CalibrationEntry,
} from './calibrationEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _id = 0;
function makeEntry(
  wasCorrect: boolean,
  confidence: number,
  overrides: Partial<CalibrationEntry> = {}
): CalibrationEntry {
  return {
    questionId: `q${++_id}`,
    conditionId: 'cond-default',
    system: 'Cardiology',
    wasCorrect,
    confidence,
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── analyzeCalibration ───────────────────────────────────────────────────────

describe('analyzeCalibration', () => {
  it('returns empty report for zero entries', () => {
    const report = analyzeCalibration([]);
    expect(report.totalEntries).toBe(0);
    expect(report.dangerousMisconceptions).toHaveLength(0);
    expect(report.underconfidentAreas).toHaveLength(0);
    expect(report.miscalibrationScore).toBe(0);
    expect(report.brierScore).toBe(0);
  });

  it('totalEntries equals input length', () => {
    const entries = [makeEntry(true, 0.9), makeEntry(false, 0.3)];
    expect(analyzeCalibration(entries).totalEntries).toBe(2);
  });

  it('classifies correct + confident as mastered', () => {
    const report = analyzeCalibration([makeEntry(true, 0.9)]);
    expect(report.quadrants.mastered.count).toBe(1);
  });

  it('classifies incorrect + confident as dangerous_misconception', () => {
    const report = analyzeCalibration([makeEntry(false, 0.8)]);
    expect(report.quadrants.dangerous_misconception.count).toBe(1);
  });

  it('classifies correct + not confident as underconfident_mastery', () => {
    const report = analyzeCalibration([makeEntry(true, 0.3)]);
    expect(report.quadrants.underconfident_mastery.count).toBe(1);
  });

  it('classifies incorrect + not confident as acknowledged_gap', () => {
    const report = analyzeCalibration([makeEntry(false, 0.2)]);
    expect(report.quadrants.acknowledged_gap.count).toBe(1);
  });

  it('confidence exactly at threshold (0.6) is treated as confident', () => {
    // confident (>= 0.6) + correct → mastered
    const report = analyzeCalibration([makeEntry(true, 0.6)]);
    expect(report.quadrants.mastered.count).toBe(1);
  });

  it('confidence just below threshold (0.599) is not confident', () => {
    const report = analyzeCalibration([makeEntry(true, 0.599)]);
    expect(report.quadrants.underconfident_mastery.count).toBe(1);
  });

  it('quadrant fractions sum to 1', () => {
    const entries = [
      makeEntry(true, 0.9), makeEntry(false, 0.8),
      makeEntry(true, 0.3), makeEntry(false, 0.2),
    ];
    const report = analyzeCalibration(entries);
    const total =
      report.quadrants.mastered.fraction +
      report.quadrants.dangerous_misconception.fraction +
      report.quadrants.underconfident_mastery.fraction +
      report.quadrants.acknowledged_gap.fraction;
    expect(total).toBeCloseTo(1.0, 9);
  });

  it('detects dangerous misconceptions when >= 3 confident-wrong entries for a condition', () => {
    const condId = 'cond-mi';
    const entries = [
      makeEntry(false, 0.8, { conditionId: condId }),
      makeEntry(false, 0.7, { conditionId: condId }),
      makeEntry(false, 0.9, { conditionId: condId }),
      makeEntry(false, 0.75, { conditionId: condId }),
    ];
    const report = analyzeCalibration(entries);
    expect(report.dangerousMisconceptions.length).toBeGreaterThan(0);
    expect(report.dangerousMisconceptions[0]!.conditionId).toBe(condId);
  });

  it('does not flag misconceptions when fewer than 3 confident-wrong entries', () => {
    const condId = 'cond-safe';
    const entries = [
      makeEntry(false, 0.8, { conditionId: condId }),
      makeEntry(false, 0.7, { conditionId: condId }),
      makeEntry(true, 0.9, { conditionId: condId }),
    ];
    // 2 confident-wrong / 3 total = 0.667 but < MIN_ENTRIES_FOR_MISCONCEPTION in confident-wrong count
    const report = analyzeCalibration(entries);
    // 2 is below MIN_ENTRIES_FOR_MISCONCEPTION (3) → no alert
    expect(report.dangerousMisconceptions).toHaveLength(0);
  });

  it('miscalibrationScore is 0 for perfectly calibrated entries', () => {
    // All correct with confidence=1 and all wrong with confidence=0 → |conf - actual| = 0
    const entries = [
      makeEntry(true, 1.0),
      makeEntry(false, 0.0),
    ];
    const report = analyzeCalibration(entries);
    expect(report.miscalibrationScore).toBeCloseTo(0, 9);
  });

  it('miscalibrationScore is 1 for maximally miscalibrated entries', () => {
    // Confident wrong: |1.0 - 0| = 1
    const entries = [makeEntry(false, 1.0), makeEntry(true, 0.0)];
    const report = analyzeCalibration(entries);
    expect(report.miscalibrationScore).toBeCloseTo(1.0, 9);
  });

  it('report has all four quadrant keys', () => {
    const report = analyzeCalibration([makeEntry(true, 0.8)]);
    expect('mastered' in report.quadrants).toBe(true);
    expect('dangerous_misconception' in report.quadrants).toBe(true);
    expect('underconfident_mastery' in report.quadrants).toBe(true);
    expect('acknowledged_gap' in report.quadrants).toBe(true);
  });
});

// ─── checkForMisconception ────────────────────────────────────────────────────

describe('checkForMisconception', () => {
  it('returns null when fewer than 3 entries', () => {
    const entries = [makeEntry(false, 0.9), makeEntry(false, 0.8)];
    expect(checkForMisconception(entries)).toBeNull();
  });

  it('returns null when confident-wrong rate < 60%', () => {
    const entries = [
      makeEntry(false, 0.9),  // confident-wrong
      makeEntry(true, 0.8),   // correct
      makeEntry(true, 0.7),   // correct
    ];
    // 1/3 = 33% < 60% → no misconception
    expect(checkForMisconception(entries)).toBeNull();
  });

  it('returns MisconceptionAlert when >= 60% confident-wrong with >= 3 entries', () => {
    const entries = [
      makeEntry(false, 0.8),
      makeEntry(false, 0.9),
      makeEntry(false, 0.75),
    ];
    // 3/3 = 100% → misconception
    const alert = checkForMisconception(entries);
    expect(alert).not.toBeNull();
    expect(alert!.incorrectCount).toBe(3);
  });

  it('alert includes average confidence of confident-wrong entries', () => {
    const entries = [
      makeEntry(false, 0.8, { conditionId: 'c1', system: 'Cards' }),
      makeEntry(false, 1.0, { conditionId: 'c1', system: 'Cards' }),
      makeEntry(false, 0.9, { conditionId: 'c1', system: 'Cards' }),
    ];
    const alert = checkForMisconception(entries);
    expect(alert!.avgConfidence).toBeCloseTo((0.8 + 1.0 + 0.9) / 3, 5);
  });

  it('alert uses system and conditionId from first entry', () => {
    const entries = [
      makeEntry(false, 0.8, { conditionId: 'cond-htn', system: 'Cardiology' }),
      makeEntry(false, 0.7, { conditionId: 'cond-htn', system: 'Cardiology' }),
      makeEntry(false, 0.9, { conditionId: 'cond-htn', system: 'Cardiology' }),
    ];
    const alert = checkForMisconception(entries);
    expect(alert!.conditionId).toBe('cond-htn');
    expect(alert!.system).toBe('Cardiology');
  });

  it('alert message mentions the incorrect count', () => {
    const entries = [
      makeEntry(false, 0.9),
      makeEntry(false, 0.8),
      makeEntry(false, 0.95),
    ];
    const alert = checkForMisconception(entries);
    expect(alert!.message).toContain('3');
  });

  it('correct entries within the condition do not count toward confident-wrong', () => {
    // 3 confident-wrong, 3 correct: 3/6 = 50% < 60% → no misconception
    const entries = [
      makeEntry(false, 0.8),
      makeEntry(false, 0.9),
      makeEntry(false, 0.75),
      makeEntry(true, 0.8),
      makeEntry(true, 0.7),
      makeEntry(true, 0.9),
    ];
    expect(checkForMisconception(entries)).toBeNull();
  });
});

// ─── getCalibrationFeedback ───────────────────────────────────────────────────

describe('getCalibrationFeedback', () => {
  it('returns mastered state for correct + confident', () => {
    const fb = getCalibrationFeedback(true, 0.8);
    expect(fb.state).toBe('mastered');
  });

  it('returns dangerous_misconception state for incorrect + confident', () => {
    const fb = getCalibrationFeedback(false, 0.9);
    expect(fb.state).toBe('dangerous_misconception');
  });

  it('returns underconfident_mastery state for correct + not confident', () => {
    const fb = getCalibrationFeedback(true, 0.3);
    expect(fb.state).toBe('underconfident_mastery');
  });

  it('returns acknowledged_gap state for incorrect + not confident', () => {
    const fb = getCalibrationFeedback(false, 0.2);
    expect(fb.state).toBe('acknowledged_gap');
  });

  it('every state returns a non-empty message', () => {
    const cases: [boolean, number][] = [[true, 0.9], [false, 0.9], [true, 0.3], [false, 0.3]];
    for (const [correct, conf] of cases) {
      const fb = getCalibrationFeedback(correct, conf);
      expect(typeof fb.message).toBe('string');
      expect(fb.message.length).toBeGreaterThan(0);
    }
  });

  it('every state returns an emoji', () => {
    const cases: [boolean, number][] = [[true, 0.9], [false, 0.9], [true, 0.3], [false, 0.3]];
    for (const [correct, conf] of cases) {
      const fb = getCalibrationFeedback(correct, conf);
      expect(typeof fb.emoji).toBe('string');
      expect(fb.emoji.length).toBeGreaterThan(0);
    }
  });

  it('at confidence threshold (0.6) + correct → mastered', () => {
    const fb = getCalibrationFeedback(true, 0.6);
    expect(fb.state).toBe('mastered');
  });

  it('just below confidence threshold (0.599) + incorrect → acknowledged_gap', () => {
    const fb = getCalibrationFeedback(false, 0.599);
    expect(fb.state).toBe('acknowledged_gap');
  });
});
