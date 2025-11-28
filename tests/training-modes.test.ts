import { describe, it, expect } from 'vitest';
import {
  MODE_REGISTRY,
  TrainingModeId,
  TrainingModeConfig,
} from '../config/training-modes';

describe('Training Modes Configuration', () => {
  describe('MODE_REGISTRY', () => {
    it('should contain exactly 6 training modes', () => {
      expect(MODE_REGISTRY).toHaveLength(6);
    });

    it('should have unique ids for all modes', () => {
      const ids = MODE_REGISTRY.map((mode) => mode.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required TrainingModeId values', () => {
      const expectedIds: TrainingModeId[] = [
        'core_adaptive',
        'photo_drill',
        'rapid_recall',
        'ddx_compare',
        'guideline_drill',
        'mastery_drill',
      ];

      const actualIds = MODE_REGISTRY.map((mode) => mode.id);
      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id);
      });
    });

    it('should have valid category values for all modes', () => {
      const validCategories = ['core', 'visual', 'recall', 'mastery'];

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
        iconName: 'TestIcon',
        theme: 'blue',
        route: '/test',
        isComingSoon: true,
      };

      expect(modeWithComingSoon.isComingSoon).toBe(true);
    });

    it('should work without isComingSoon property', () => {
      const modeWithoutComingSoon: TrainingModeConfig = {
        id: 'photo_drill',
        label: 'Test Mode',
        description: 'Test description',
        category: 'visual',
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

    it('should have Global Photo Mode with slate theme', () => {
      const photoDrill = MODE_REGISTRY.find((m) => m.id === 'photo_drill');
      expect(photoDrill).toBeDefined();
      expect(photoDrill?.theme).toBe('slate');
      expect(photoDrill?.category).toBe('visual');
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
  });
});
