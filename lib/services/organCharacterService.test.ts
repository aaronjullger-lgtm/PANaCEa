/**
 * Tests for organCharacterService.ts — pure functions only.
 * Mocks localStorage and imported config constants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock config ───────────────────────────────────────────────────────
vi.mock('../../config/organ-characters', () => ({
  ORGAN_VARIANTS: [
    { id: 'heart_base', name: 'Heart Base', system: 'CV', isBase: true, unlockCondition: { type: 'default' }, rarity: 'common', icon: '♥', displayOrder: 0 },
    { id: 'heart_golden', name: 'Golden Heart', system: 'CV', isBase: false, unlockCondition: { type: 'questions_answered', value: 50 }, rarity: 'rare', icon: '💛', displayOrder: 1 },
    { id: 'lungs_base', name: 'Lungs Base', system: 'PULM', isBase: true, unlockCondition: { type: 'default' }, rarity: 'common', icon: '◉◉', displayOrder: 2 },
    { id: 'lungs_toxic', name: 'Toxic Lungs', system: 'PULM', isBase: false, unlockCondition: { type: 'accuracy_threshold', value: 80 }, rarity: 'epic', icon: '☠', displayOrder: 3 },
    { id: 'egg_mystery', name: 'Mystery', system: 'SPECIAL', isBase: false, unlockCondition: { type: 'easter_egg', condition: 'ecg_drill', value: 10 }, rarity: 'legendary', icon: '🥚', displayOrder: 4 },
  ],
  ORGAN_ACCESSORIES: [
    { id: 'stethoscope', name: 'Stethoscope', compatibleSystems: ['ALL'], unlockCondition: { type: 'total_questions', value: 10 }, rarity: 'common', icon: '🩺', displayOrder: 0 },
    { id: 'golden_steth', name: 'Golden Stethoscope', compatibleSystems: ['ALL'], unlockCondition: { type: 'streak', value: 7 }, rarity: 'rare', icon: '✨', displayOrder: 1 },
  ],
  ORGAN_CHARACTERS: [
    { system: 'CV', name: 'Heart', baseVariant: 'heart_base', emoji: '♥', description: 'Cardiovascular' },
    { system: 'PULM', name: 'Lungs', baseVariant: 'lungs_base', emoji: '◉◉', description: 'Pulmonary' },
  ],
  getVariantById: vi.fn(),
  getAccessoryById: vi.fn(),
  getVariantsForSystem: vi.fn((system: string) => {
    const variants = [
      { id: 'heart_base', system: 'CV', isBase: true },
      { id: 'heart_golden', system: 'CV', isBase: false },
      { id: 'lungs_base', system: 'PULM', isBase: true },
      { id: 'lungs_toxic', system: 'PULM', isBase: false },
    ];
    return variants.filter(v => v.system === system);
  }),
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Import after mocks ────────────────────────────────────────────────
import {
  updateSystemProgress,
  checkVariantUnlocks,
  checkAccessoryUnlocks,
  unlockItems,
  incrementSpecialModeProgress,
  getSystemCompletion,
  getOverallCompletion,
  changeActiveVariant,
  toggleAccessory,
  getNewItems,
  type UserOrganProgress,
} from './organCharacterService';

// ─── Helpers ───────────────────────────────────────────────────────────
function makeProgress(overrides?: Partial<UserOrganProgress>): UserOrganProgress {
  return {
    unlockedVariants: new Set<string>(['heart_base', 'lungs_base']),
    unlockedAccessories: new Set<string>(),
    systemProgress: new Map(),
    specialModeProgress: new Map(),
    ...overrides,
  };
}

function makeRecord(
  system: string,
  isCorrect: boolean,
): { system: string; isCorrect: boolean } {
  return { system, isCorrect };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('organCharacterService', () => {
  describe('updateSystemProgress', () => {
    it('aggregates by system and calculates accuracy', () => {
      const progress = makeProgress();
      const records = [
        makeRecord('CV', true),
        makeRecord('CV', true),
        makeRecord('CV', false),
      ];
      const result = updateSystemProgress(progress, records);
      const cv = result.systemProgress.get('CV');
      expect(cv).toBeDefined();
      expect(cv!.questionsAnswered).toBe(3);
      expect(cv!.correct).toBe(2);
      expect(cv!.accuracy).toBe(67);
    });

    it('handles empty records', () => {
      const progress = makeProgress();
      const result = updateSystemProgress(progress, []);
      expect(result.systemProgress.size).toBe(0);
    });

    it('skips records without system', () => {
      const progress = makeProgress();
      const records = [{ system: '', isCorrect: true }];
      const result = updateSystemProgress(progress, records);
      expect(result.systemProgress.size).toBe(0);
    });

    it('preserves other systems', () => {
      const existing = new Map([['GI', { questionsAnswered: 5, correct: 4, accuracy: 80 }]]);
      const progress = makeProgress({ systemProgress: existing });
      const result = updateSystemProgress(progress, [makeRecord('CV', true)]);
      expect(result.systemProgress.get('GI')).toEqual({ questionsAnswered: 5, correct: 4, accuracy: 80 });
      expect(result.systemProgress.get('CV')!.questionsAnswered).toBe(1);
    });

    it('accuracy rounds to nearest integer', () => {
      const progress = makeProgress();
      const records = [makeRecord('CV', true), makeRecord('CV', false), makeRecord('CV', false)];
      const result = updateSystemProgress(progress, records);
      expect(result.systemProgress.get('CV')!.accuracy).toBe(33);
    });
  });

  describe('checkVariantUnlocks', () => {
    it('unlocks variant when questions_answered threshold met', () => {
      const systemProgress = new Map([
        ['CV', { questionsAnswered: 50, correct: 35, accuracy: 70 }],
      ]);
      const progress = makeProgress({ systemProgress });
      const unlocks = checkVariantUnlocks(progress, 0, 0);
      expect(unlocks).toContain('heart_golden');
    });

    it('unlocks variant when accuracy_threshold met', () => {
      const systemProgress = new Map([
        ['PULM', { questionsAnswered: 20, correct: 18, accuracy: 90 }],
      ]);
      const progress = makeProgress({ systemProgress });
      const unlocks = checkVariantUnlocks(progress, 0, 0);
      expect(unlocks).toContain('lungs_toxic');
    });

    it('unlocks easter_egg variant when mode progress met', () => {
      const specialModeProgress = new Map([['ecg_drill', 10]]);
      const progress = makeProgress({ specialModeProgress });
      const unlocks = checkVariantUnlocks(progress, 0, 0);
      expect(unlocks).toContain('egg_mystery');
    });

    it('does not re-unlock already unlocked variants', () => {
      const progress = makeProgress({ unlockedVariants: new Set(['heart_base', 'heart_golden', 'lungs_base', 'lungs_toxic', 'egg_mystery']) });
      const unlocks = checkVariantUnlocks(progress, 0, 0);
      expect(unlocks).toHaveLength(0);
    });

    it('returns empty for insufficient progress', () => {
      const progress = makeProgress();
      const unlocks = checkVariantUnlocks(progress, 0, 0);
      expect(unlocks).toHaveLength(0);
    });
  });

  describe('checkAccessoryUnlocks', () => {
    it('unlocks by total_questions', () => {
      const unlocks = checkAccessoryUnlocks(makeProgress(), 0, 10);
      expect(unlocks).toContain('stethoscope');
    });

    it('unlocks by streak', () => {
      const unlocks = checkAccessoryUnlocks(makeProgress(), 7, 0);
      expect(unlocks).toContain('golden_steth');
    });

    it('does not re-unlock', () => {
      const progress = makeProgress({ unlockedAccessories: new Set(['stethoscope', 'golden_steth']) });
      const unlocks = checkAccessoryUnlocks(progress, 10, 100);
      expect(unlocks).toHaveLength(0);
    });

    it('returns empty for insufficient totals', () => {
      const unlocks = checkAccessoryUnlocks(makeProgress(), 0, 0);
      expect(unlocks).toHaveLength(0);
    });
  });

  describe('unlockItems', () => {
    it('adds variants and accessories to progress', () => {
      const progress = makeProgress();
      const result = unlockItems(progress, ['heart_golden'], ['stethoscope']);
      expect(result.unlockedVariants.has('heart_golden')).toBe(true);
      expect(result.unlockedAccessories.has('stethoscope')).toBe(true);
    });

    it('handles empty arrays', () => {
      const progress = makeProgress();
      const result = unlockItems(progress, [], []);
      expect(result.unlockedVariants.size).toBe(2); // heart_base, lungs_base
      expect(result.unlockedAccessories.size).toBe(0);
    });

    it('is idempotent (does not duplicate)', () => {
      const progress = makeProgress();
      unlockItems(progress, ['heart_golden'], []);
      const result = unlockItems(progress, ['heart_golden'], []);
      expect(result.unlockedVariants.size).toBe(3); // 2 base + heart_golden
    });
  });

  describe('incrementSpecialModeProgress', () => {
    it('increments from zero', () => {
      const progress = makeProgress();
      const result = incrementSpecialModeProgress(progress, 'ecg_drill');
      expect(result.specialModeProgress.get('ecg_drill')).toBe(1);
    });

    it('increments existing value', () => {
      const specialModeProgress = new Map([['ecg_drill', 5]]);
      const progress = makeProgress({ specialModeProgress });
      const result = incrementSpecialModeProgress(progress, 'ecg_drill', 3);
      expect(result.specialModeProgress.get('ecg_drill')).toBe(8);
    });

    it('defaults increment to 1', () => {
      const progress = makeProgress();
      const result = incrementSpecialModeProgress(progress, 'mode_a');
      expect(result.specialModeProgress.get('mode_a')).toBe(1);
    });

    it('preserves other modes', () => {
      const specialModeProgress = new Map([['mode_a', 10]]);
      const progress = makeProgress({ specialModeProgress });
      const result = incrementSpecialModeProgress(progress, 'mode_b', 5);
      expect(result.specialModeProgress.get('mode_a')).toBe(10);
      expect(result.specialModeProgress.get('mode_b')).toBe(5);
    });
  });

  describe('getSystemCompletion', () => {
    it('returns percentage of unlocked variants', () => {
      const progress = makeProgress({ unlockedVariants: new Set(['heart_base', 'heart_golden', 'lungs_base']) });
      // CV has 2 variants, PULM has 2 variants — but only heart_base + heart_golden are CV
      // CV: 2/2 = 100%, PULM: 1/2 = 50%
      expect(getSystemCompletion(progress, 'CV' as any)).toBe(100);
      expect(getSystemCompletion(progress, 'PULM' as any)).toBe(50);
    });

    it('returns 0 for no unlocked variants in system', () => {
      const progress = makeProgress({ unlockedVariants: new Set() });
      expect(getSystemCompletion(progress, 'CV' as any)).toBe(0);
    });
  });

  describe('getOverallCompletion', () => {
    it('calculates percentage across all items', () => {
      // 5 variants total + 2 accessories = 7 items
      const progress = makeProgress({
        unlockedVariants: new Set(['heart_base', 'lungs_base']),
        unlockedAccessories: new Set(),
      });
      const result = getOverallCompletion(progress);
      expect(result.totalVariants).toBe(5);
      expect(result.totalAccessories).toBe(2);
      expect(result.variantsUnlocked).toBe(2);
      expect(result.accessoriesUnlocked).toBe(0);
      expect(result.percentage).toBe(Math.round((2 / 7) * 100));
    });

    it('returns 0 for empty progress', () => {
      const progress = makeProgress({
        unlockedVariants: new Set(),
        unlockedAccessories: new Set(),
      });
      const result = getOverallCompletion(progress);
      expect(result.percentage).toBe(0);
    });
  });

  describe('changeActiveVariant', () => {
    it('updates active variant for a system', () => {
      const customization = new Map([
        ['CV', { system: 'CV' as any, activeVariant: 'heart_base', equippedAccessories: [] }],
      ]);
      const result = changeActiveVariant(customization, 'CV' as any, 'heart_golden');
      expect(result.get('CV')!.activeVariant).toBe('heart_golden');
    });

    it('returns map unchanged if system not found', () => {
      const customization = new Map();
      const result = changeActiveVariant(customization, 'CV' as any, 'heart_golden');
      expect(result.has('CV')).toBe(false);
    });
  });

  describe('toggleAccessory', () => {
    it('adds accessory if not equipped', () => {
      const customization = new Map([
        ['CV', { system: 'CV' as any, activeVariant: 'heart_base', equippedAccessories: [] }],
      ]);
      const result = toggleAccessory(customization, 'CV' as any, 'stethoscope');
      expect(result.get('CV')!.equippedAccessories).toContain('stethoscope');
    });

    it('removes accessory if already equipped', () => {
      const customization = new Map([
        ['CV', { system: 'CV' as any, activeVariant: 'heart_base', equippedAccessories: ['stethoscope'] }],
      ]);
      const result = toggleAccessory(customization, 'CV' as any, 'stethoscope');
      expect(result.get('CV')!.equippedAccessories).not.toContain('stethoscope');
    });

    it('returns map unchanged if system not found', () => {
      const customization = new Map();
      const result = toggleAccessory(customization, 'CV' as any, 'stethoscope');
      expect(result.size).toBe(0);
    });

    it('does not affect other accessories', () => {
      const customization = new Map([
        ['CV', { system: 'CV' as any, activeVariant: 'heart_base', equippedAccessories: ['stethoscope', 'golden_steth'] }],
      ]);
      const result = toggleAccessory(customization, 'CV' as any, 'stethoscope');
      expect(result.get('CV')!.equippedAccessories).toEqual(['golden_steth']);
    });
  });

  describe('getNewItems', () => {
    it('returns variants not in lastSeen', () => {
      const progress = makeProgress({
        unlockedVariants: new Set(['heart_base', 'heart_golden', 'lungs_base']),
      });
      const result = getNewItems(progress, new Set(['heart_base']), new Set());
      expect(result.newVariants).toContain('heart_golden');
      expect(result.newVariants).toContain('lungs_base');
      expect(result.newVariants).not.toContain('heart_base');
    });

    it('returns accessories not in lastSeen', () => {
      const progress = makeProgress({
        unlockedAccessories: new Set(['stethoscope', 'golden_steth']),
      });
      const result = getNewItems(progress, new Set(), new Set(['stethoscope']));
      expect(result.newAccessories).toContain('golden_steth');
      expect(result.newAccessories).not.toContain('stethoscope');
    });

    it('returns empty when everything has been seen', () => {
      const progress = makeProgress({
        unlockedVariants: new Set(['heart_base']),
        unlockedAccessories: new Set(['stethoscope']),
      });
      const result = getNewItems(progress, new Set(['heart_base']), new Set(['stethoscope']));
      expect(result.newVariants).toHaveLength(0);
      expect(result.newAccessories).toHaveLength(0);
    });

    it('returns empty for empty progress', () => {
      const progress = makeProgress({
        unlockedVariants: new Set(),
        unlockedAccessories: new Set(),
      });
      const result = getNewItems(progress, new Set(), new Set());
      expect(result.newVariants).toHaveLength(0);
      expect(result.newAccessories).toHaveLength(0);
    });
  });
});
