import { describe, it, expect } from 'vitest';
import {
  MODE_REGISTRY,
  TrainingModeId,
  TrainingModeConfig,
} from '../config/training-modes';

describe('Training Modes Configuration', () => {
  describe('MODE_REGISTRY', () => {
    it('should contain at least 15 training modes', () => {
      // Updated to allow for new engagement and accessibility modes
      expect(MODE_REGISTRY.length).toBeGreaterThanOrEqual(15);
    });

    it('should have unique ids for all modes', () => {
      const ids = MODE_REGISTRY.map((mode) => mode.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required TrainingModeId values', () => {
      const expectedIds: TrainingModeId[] = [
        'core_adaptive',
        'ecg_drill',
        'derm_drill',
        'imaging_drill',
        'rapid_recall',
        'ddx_compare',
        'guideline_drill',
        'mastery_drill',
        'mini_lab',
        'first_line_treatment',
        'pharmacology',
        'condition_drill',
      ];

      const actualIds = MODE_REGISTRY.map((mode) => mode.id);
      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id);
      });
    });

    it('should have valid category values for all modes', () => {
      const validCategories = ['core', 'visual', 'recall', 'mastery', 'pharmacology', 'clinical'];

      MODE_REGISTRY.forEach((mode) => {
        expect(validCategories).toContain(mode.category);
      });
    });

    it('should have non-empty label and description for all modes', () => {
      MODE_REGISTRY.forEach((mode) => {
        expect(mode.label).toBeTruthy();
        expect(mode.label.length).toBeGreaterThan(0);
        expect(mode.description).toBeTruthy();
        expect(mode.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid routes starting with "/" for all modes', () => {
      MODE_REGISTRY.forEach((mode) => {
        expect(mode.route).toMatch(/^\//);
      });
    });

    it('should have iconName and theme for all modes', () => {
      MODE_REGISTRY.forEach((mode) => {
        expect(mode.iconName).toBeTruthy();
        expect(mode.theme).toBeTruthy();
      });
    });
  });

  describe('TrainingModeConfig interface', () => {
    it('should allow optional isComingSoon property', () => {
      const modeWithComingSoon: TrainingModeConfig = {
        id: 'core_adaptive',
        label: 'Test Mode',
        description: 'Test description',
        category: 'core',
        intentGroup: 'core_adaptive',
        iconName: 'TestIcon',
        theme: 'blue',
        route: '/test',
        isComingSoon: true,
      };

      expect(modeWithComingSoon.isComingSoon).toBe(true);
    });

    it('should work without isComingSoon property', () => {
      const modeWithoutComingSoon: TrainingModeConfig = {
        id: 'ecg_drill',
        label: 'Test Mode',
        description: 'Test description',
        category: 'visual',
        intentGroup: 'visual_diagnostics',
        iconName: 'TestIcon',
        theme: 'green',
        route: '/test',
      };

      expect(modeWithoutComingSoon.isComingSoon).toBeUndefined();
    });
  });

  describe('Specific mode configurations', () => {
    it('should have Core Adaptive with stone theme', () => {
      const coreAdaptive = MODE_REGISTRY.find((m) => m.id === 'core_adaptive');
      expect(coreAdaptive).toBeDefined();
      expect(coreAdaptive?.theme).toBe('stone');
      expect(coreAdaptive?.category).toBe('core');
    });

    it('should have ECG Drill with rose theme', () => {
      const ecgDrill = MODE_REGISTRY.find((m) => m.id === 'ecg_drill');
      expect(ecgDrill).toBeDefined();
      expect(ecgDrill?.theme).toBe('rose');
      expect(ecgDrill?.category).toBe('visual');
    });

    it('should have Derm Drill with pink theme', () => {
      const dermDrill = MODE_REGISTRY.find((m) => m.id === 'derm_drill');
      expect(dermDrill).toBeDefined();
      expect(dermDrill?.theme).toBe('pink');
      expect(dermDrill?.category).toBe('visual');
    });

    it('should have Imaging Drill with slate theme', () => {
      const imagingDrill = MODE_REGISTRY.find((m) => m.id === 'imaging_drill');
      expect(imagingDrill).toBeDefined();
      expect(imagingDrill?.theme).toBe('slate');
      expect(imagingDrill?.category).toBe('visual');
    });

    it('should have Mini Lab Mode with emerald theme', () => {
      const miniLab = MODE_REGISTRY.find((m) => m.id === 'mini_lab');
      expect(miniLab).toBeDefined();
      expect(miniLab?.theme).toBe('emerald');
      expect(miniLab?.category).toBe('visual');
    });

    it('should have Rapid Recall with amber theme', () => {
      const rapidRecall = MODE_REGISTRY.find((m) => m.id === 'rapid_recall');
      expect(rapidRecall).toBeDefined();
      expect(rapidRecall?.theme).toBe('amber');
      expect(rapidRecall?.category).toBe('recall');
    });

    it('should have DDx Compare with blue theme', () => {
      const ddxCompare = MODE_REGISTRY.find((m) => m.id === 'ddx_compare');
      expect(ddxCompare).toBeDefined();
      expect(ddxCompare?.theme).toBe('blue');
    });

    it('should have Guideline Mode with teal theme', () => {
      const guidelineDrill = MODE_REGISTRY.find((m) => m.id === 'guideline_drill');
      expect(guidelineDrill).toBeDefined();
      expect(guidelineDrill?.theme).toBe('teal');
    });

    it('should have Streak Challenge with red theme', () => {
      const masteryDrill = MODE_REGISTRY.find((m) => m.id === 'mastery_drill');
      expect(masteryDrill).toBeDefined();
      expect(masteryDrill?.theme).toBe('red');
      expect(masteryDrill?.category).toBe('mastery');
    });

    it('should have pharmacology modes available (not coming soon)', () => {
      const firstLine = MODE_REGISTRY.find((m) => m.id === 'first_line_treatment');
      const pharm = MODE_REGISTRY.find((m) => m.id === 'pharmacology');
      // Pharmacology modes are now implemented and available
      expect(firstLine?.isComingSoon).toBeFalsy();
      expect(pharm?.isComingSoon).toBeFalsy();
    });
  });
});
