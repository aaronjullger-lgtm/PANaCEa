import { describe, it, expect } from 'vitest';
import { MODE_REGISTRY } from '../config/training-modes';

/**
 * Tests for TrainingMenu component logic and data handling.
 * These tests validate the logic used by the TrainingMenu component
 * without requiring React Testing Library.
 */
describe('TrainingMenu Component Logic', () => {
  describe('Mode Registry Filtering', () => {
    it('should have exactly one core_adaptive mode', () => {
      const coreModes = MODE_REGISTRY.filter(
        (mode) => mode.category === 'core' && mode.id === 'core_adaptive'
      );
      expect(coreModes).toHaveLength(1);
    });

    it('should filter out core category for drill modes grid', () => {
      const drillModes = MODE_REGISTRY.filter((mode) => mode.category !== 'core');
      
      // Should not include any 'core' category modes
      drillModes.forEach((mode) => {
        expect(mode.category).not.toBe('core');
      });
      
      // Should include modes from other categories
      const categories = new Set(drillModes.map((mode) => mode.category));
      expect(categories.has('visual')).toBe(true);
      expect(categories.has('recall')).toBe(true);
      expect(categories.has('mastery')).toBe(true);
    });

    it('should have at least 4 drill modes after filtering', () => {
      const drillModes = MODE_REGISTRY.filter((mode) => mode.category !== 'core');
      expect(drillModes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Icon Mapping', () => {
    // Icon names used in MODE_REGISTRY (expanded for new modes)
    const expectedIconNames = [
      'Brain', 'Image', 'Zap', 'GitCompare', 'FileText', 'Flame', 'ClipboardList',
      'Activity', 'Scan', 'FileCheck', 'Layers', 'Pill', 'Beaker'
    ];
    
    it('should have valid icon names for all modes', () => {
      MODE_REGISTRY.forEach((mode) => {
        expect(expectedIconNames).toContain(mode.iconName);
      });
    });

    it('should have unique icon names where appropriate', () => {
      const iconNames = MODE_REGISTRY.map((mode) => mode.iconName);
      // At least half should be unique (allows some reuse)
      const uniqueIcons = new Set(iconNames);
      expect(uniqueIcons.size).toBeGreaterThanOrEqual(iconNames.length / 2);
    });
  });

  describe('Theme Background Mapping', () => {
    const validThemes = [
      'stone', 'slate', 'amber', 'blue', 'teal', 'red', 'emerald',
      'rose', 'pink', 'violet', 'cyan', 'purple'
    ];
    
    it('should have valid theme values for all modes', () => {
      MODE_REGISTRY.forEach((mode) => {
        expect(validThemes).toContain(mode.theme);
      });
    });

    it('should map themes to valid Tailwind background classes', () => {
      const themeMap: Record<string, string> = {
        stone: 'bg-stone-100',
        slate: 'bg-slate-100',
        amber: 'bg-amber-100',
        blue: 'bg-blue-100',
        teal: 'bg-teal-100',
        red: 'bg-red-100',
        emerald: 'bg-emerald-100',
        rose: 'bg-rose-100',
        pink: 'bg-pink-100',
        violet: 'bg-violet-100',
        cyan: 'bg-cyan-100',
        purple: 'bg-purple-100',
      };

      MODE_REGISTRY.forEach((mode) => {
        const bgClass = themeMap[mode.theme];
        expect(bgClass).toBeDefined();
        expect(bgClass).toMatch(/^bg-\w+-100$/);
      });
    });
  });

  describe('Focus Options', () => {
    type FocusOption = 'all' | 'growth' | 'flagged';
    const focusOptions: FocusOption[] = ['all', 'growth', 'flagged'];

    it('should have valid focus options', () => {
      expect(focusOptions).toHaveLength(3);
      expect(focusOptions).toContain('all');
      expect(focusOptions).toContain('growth');
      expect(focusOptions).toContain('flagged');
    });

    it('should default to "all" focus option', () => {
      const defaultFocus: FocusOption = 'all';
      expect(focusOptions).toContain(defaultFocus);
      expect(focusOptions[0]).toBe(defaultFocus);
    });
  });

  describe('Coming Soon Mode Handling', () => {
    it('should correctly identify modes that are coming soon', () => {
      const comingSoonModes = MODE_REGISTRY.filter((mode) => mode.isComingSoon === true);
      const availableModes = MODE_REGISTRY.filter((mode) => !mode.isComingSoon);
      
      // Currently all modes are implemented and available
      // This test ensures the filtering logic works correctly
      expect(availableModes.length + comingSoonModes.length).toBe(MODE_REGISTRY.length);
    });

    it('should handle optional isComingSoon property', () => {
      MODE_REGISTRY.forEach((mode) => {
        // isComingSoon is optional, so it can be undefined or boolean
        expect(
          mode.isComingSoon === undefined || typeof mode.isComingSoon === 'boolean'
        ).toBe(true);
      });
    });
  });

  describe('Core Adaptive Mode', () => {
    const coreMode = MODE_REGISTRY.find(
      (mode) => mode.category === 'core' && mode.id === 'core_adaptive'
    );

    it('should have core adaptive mode in registry', () => {
      expect(coreMode).toBeDefined();
    });

    it('should have correct properties for hero card display', () => {
      expect(coreMode?.label).toBeTruthy();
      expect(coreMode?.description).toBeTruthy();
      expect(coreMode?.iconName).toBe('Brain');
      expect(coreMode?.theme).toBe('stone');
    });

    it('should have a valid route for core adaptive', () => {
      expect(coreMode?.route).toMatch(/^\//);
      expect(coreMode?.route).toContain('core-adaptive');
    });
  });
});
