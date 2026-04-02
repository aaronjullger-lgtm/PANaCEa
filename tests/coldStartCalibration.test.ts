/**
 * Tests for coldStartCalibrationService — Sprint 2E
 *
 * Tests pure constants and type contracts.
 * DB-integrated functions (getColdStartStatus, computeBaseline,
 * generateCalibrationSession) require Prisma.
 */

import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_THRESHOLD,
  CALIBRATION_SET_SIZE,
  TOTAL_CALIBRATION_QUESTIONS,
  type ColdStartStatus,
  type CalibrationBaseline,
} from '../lib/services/coldStartCalibrationService';

describe('Cold-Start Calibration — Constants', () => {
  it('calibration threshold is reasonable for baseline measurement', () => {
    // Need at least 20 answers for statistical significance, but not so many it's tedious
    expect(CALIBRATION_THRESHOLD).toBeGreaterThanOrEqual(20);
    expect(CALIBRATION_THRESHOLD).toBeLessThanOrEqual(60);
  });

  it('calibration set has all three tiers', () => {
    expect(CALIBRATION_SET_SIZE.easy).toBeGreaterThan(0);
    expect(CALIBRATION_SET_SIZE.medium).toBeGreaterThan(0);
    expect(CALIBRATION_SET_SIZE.hard).toBeGreaterThan(0);
  });
  it('total calibration questions equals sum of tiers', () => {
    expect(TOTAL_CALIBRATION_QUESTIONS).toBe(
      CALIBRATION_SET_SIZE.easy + CALIBRATION_SET_SIZE.medium + CALIBRATION_SET_SIZE.hard
    );
  });

  it('medium tier is the largest (most diagnostic)', () => {
    expect(CALIBRATION_SET_SIZE.medium).toBeGreaterThanOrEqual(CALIBRATION_SET_SIZE.easy);
    expect(CALIBRATION_SET_SIZE.medium).toBeGreaterThanOrEqual(CALIBRATION_SET_SIZE.hard);
  });
});

describe('Cold-Start Calibration — Type Contracts', () => {
  it('ColdStartStatus shape is valid for uncalibrated user', () => {
    const status: ColdStartStatus = {
      isCalibrated: false,
      totalAttempts: 5,
      remaining: 25,
      progress: 5 / 30,
    };
    expect(status.isCalibrated).toBe(false);
    expect(status.remaining).toBeGreaterThan(0);
    expect(status.progress).toBeLessThan(1);
    expect(status.baseline).toBeUndefined();
  });

  it('ColdStartStatus shape is valid for calibrated user', () => {
    const baseline: CalibrationBaseline = {
      accuracy: 0.73,
      medianResponseTimeMs: 28000,
      difficultyMix: { easy: 0.35, medium: 0.40, hard: 0.25 },
      zone: 'optimal',
      systemAccuracies: {
        'Cardiovascular': { correct: 8, total: 10, accuracy: 0.80 },
        'Pulmonary': { correct: 5, total: 10, accuracy: 0.50 },
      },
      weakSystems: ['Pulmonary'],
      strongSystems: ['Cardiovascular'],
    };

    const status: ColdStartStatus = {
      isCalibrated: true,
      totalAttempts: 35,
      remaining: 0,
      progress: 1,
      baseline,
    };
    expect(status.isCalibrated).toBe(true);
    expect(status.baseline!.weakSystems).toContain('Pulmonary');
    expect(status.baseline!.strongSystems).toContain('Cardiovascular');
    expect(status.baseline!.accuracy).toBeCloseTo(0.73);
  });
});
