// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/dashboardPersonalization.ts
 *
 * Pure functions tested:
 *   getDashboardConfig  — returns stage-specific DashboardConfig
 *   shouldShowWidget    — checks pilotWidgets ∪ dataWidgets membership
 *   shouldShowMode      — checks visibleModes membership
 *
 * All 6 stages verified: didactic_early, didactic_late, clinical_rotation,
 *   pance_prep, panre, general
 */

import { describe, it, expect } from 'vitest';
import {
  getDashboardConfig,
  shouldShowWidget,
  shouldShowMode,
  type WidgetId,
} from './dashboardPersonalization';
import type { LearnerStage } from './learnerStageBlueprint';

const ALL_STAGES: LearnerStage[] = [
  'didactic_early',
  'didactic_late',
  'clinical_rotation',
  'pance_prep',
  'panre',
  'general',
];

// ─── getDashboardConfig ───────────────────────────────────────────────────────

describe('getDashboardConfig', () => {
  it('returns a config with all required fields for every stage', () => {
    for (const stage of ALL_STAGES) {
      const cfg = getDashboardConfig(stage);
      expect(typeof cfg.examLabel).toBe('string');
      expect(typeof cfg.readinessLabel).toBe('string');
      expect(typeof cfg.sessionCTA).toBe('string');
      expect(typeof cfg.greetingSuffix).toBe('string');
      expect(Array.isArray(cfg.pilotWidgets)).toBe(true);
      expect(Array.isArray(cfg.dataWidgets)).toBe(true);
      expect(Array.isArray(cfg.visibleModes)).toBe(true);
      expect(typeof cfg.defaultSessionSize).toBe('number');
      expect(cfg.defaultSessionSize).toBeGreaterThan(0);
    }
  });

  it('returns correct stage field for each stage', () => {
    for (const stage of ALL_STAGES) {
      expect(getDashboardConfig(stage).stage).toBe(stage);
    }
  });

  // Stage-specific spot checks
  it('didactic_early has coverage as primary metric', () => {
    expect(getDashboardConfig('didactic_early').primaryMetric).toBe('coverage');
  });

  it('pance_prep has mastery as primary metric', () => {
    expect(getDashboardConfig('pance_prep').primaryMetric).toBe('mastery');
  });

  it('panre has retention as primary metric', () => {
    expect(getDashboardConfig('panre').primaryMetric).toBe('retention');
  });

  it('clinical_rotation shows EOR countdown', () => {
    expect(getDashboardConfig('clinical_rotation').showEorCountdown).toBe(true);
  });

  it('pance_prep shows PANCE countdown, not EOR', () => {
    const cfg = getDashboardConfig('pance_prep');
    expect(cfg.showPanceCountdown).toBe(true);
    expect(cfg.showEorCountdown).toBe(false);
  });

  it('panre has no streak pressure', () => {
    expect(getDashboardConfig('panre').showStreakPressure).toBe(false);
  });

  it('didactic_early does not show blueprint gaps', () => {
    expect(getDashboardConfig('didactic_early').showBlueprintGaps).toBe(false);
  });

  it('pance_prep shows blueprint gaps', () => {
    expect(getDashboardConfig('pance_prep').showBlueprintGaps).toBe(true);
  });

  it('pance_prep has larger default session size than panre', () => {
    const pance = getDashboardConfig('pance_prep').defaultSessionSize;
    const panre = getDashboardConfig('panre').defaultSessionSize;
    expect(pance).toBeGreaterThan(panre);
  });

  it('pance_prep pilot widgets include exam_countdown and blueprint_gaps', () => {
    const cfg = getDashboardConfig('pance_prep');
    expect(cfg.pilotWidgets).toContain('exam_countdown');
    expect(cfg.pilotWidgets).toContain('blueprint_gaps');
  });

  it('clinical_rotation pilot widgets include eor_countdown and rotation_context', () => {
    const cfg = getDashboardConfig('clinical_rotation');
    expect(cfg.pilotWidgets).toContain('eor_countdown');
    expect(cfg.pilotWidgets).toContain('rotation_context');
  });

  it('every stage has at least one pilot widget', () => {
    for (const stage of ALL_STAGES) {
      expect(getDashboardConfig(stage).pilotWidgets.length).toBeGreaterThan(0);
    }
  });

  it('every stage has at least one visible mode', () => {
    for (const stage of ALL_STAGES) {
      expect(getDashboardConfig(stage).visibleModes.length).toBeGreaterThan(0);
    }
  });

  it('pance_prep has cram_mode and pance_simulator available', () => {
    const cfg = getDashboardConfig('pance_prep');
    expect(cfg.visibleModes).toContain('cram_mode');
    expect(cfg.visibleModes).toContain('pance_simulator');
  });

  it('panre has panre_la mode', () => {
    expect(getDashboardConfig('panre').visibleModes).toContain('panre_la');
  });

  it('didactic_early does not have pance_simulator', () => {
    expect(getDashboardConfig('didactic_early').visibleModes).not.toContain('pance_simulator');
  });
});

// ─── shouldShowWidget ─────────────────────────────────────────────────────────

describe('shouldShowWidget', () => {
  it('returns true for a widget in pilotWidgets', () => {
    expect(shouldShowWidget('pance_prep', 'exam_countdown')).toBe(true);
  });

  it('returns true for a widget in dataWidgets', () => {
    expect(shouldShowWidget('pance_prep', 'algorithm_status')).toBe(true);
  });

  it('returns false for a widget not in either list', () => {
    // didactic_early has no exam_countdown
    expect(shouldShowWidget('didactic_early', 'exam_countdown')).toBe(false);
  });

  it('returns false for eor_countdown in pance_prep stage', () => {
    expect(shouldShowWidget('pance_prep', 'eor_countdown')).toBe(false);
  });

  it('daily_triad is shown in every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(shouldShowWidget(stage, 'daily_triad')).toBe(true);
    }
  });

  it('wellness_status is shown in clinical_rotation', () => {
    expect(shouldShowWidget('clinical_rotation', 'wellness_status')).toBe(true);
  });

  it('rotation_context is only shown for clinical_rotation', () => {
    expect(shouldShowWidget('clinical_rotation', 'rotation_context')).toBe(true);
    for (const stage of ALL_STAGES.filter(s => s !== 'clinical_rotation')) {
      expect(shouldShowWidget(stage, 'rotation_context')).toBe(false);
    }
  });
});

// ─── shouldShowMode ───────────────────────────────────────────────────────────

describe('shouldShowMode', () => {
  it('returns true for core_adaptive in every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(shouldShowMode(stage, 'core_adaptive')).toBe(true);
    }
  });

  it('returns false for pance_simulator in didactic_early', () => {
    expect(shouldShowMode('didactic_early', 'pance_simulator')).toBe(false);
  });

  it('returns true for pance_simulator in pance_prep', () => {
    expect(shouldShowMode('pance_prep', 'pance_simulator')).toBe(true);
  });

  it('returns true for panre_la only in panre stage', () => {
    expect(shouldShowMode('panre', 'panre_la')).toBe(true);
    for (const stage of ALL_STAGES.filter(s => s !== 'panre')) {
      expect(shouldShowMode(stage, 'panre_la')).toBe(false);
    }
  });

  it('returns true for patient_encounter in clinical_rotation', () => {
    expect(shouldShowMode('clinical_rotation', 'patient_encounter')).toBe(true);
  });

  it('returns false for patient_encounter in didactic_early', () => {
    expect(shouldShowMode('didactic_early', 'patient_encounter')).toBe(false);
  });

  it('grand_rounds is available in clinical_rotation and pance_prep', () => {
    expect(shouldShowMode('clinical_rotation', 'grand_rounds')).toBe(true);
    expect(shouldShowMode('pance_prep', 'grand_rounds')).toBe(true);
  });

  it('grand_rounds is not available in panre', () => {
    expect(shouldShowMode('panre', 'grand_rounds')).toBe(false);
  });
});
