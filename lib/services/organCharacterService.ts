/**
 * Organ Character Service
 * 
 * Manages organ character progression, unlocks, and customization
 * Tracks which variants and accessories users have unlocked
 */

import type { SystemCode, PerformanceRecord } from '../../types';
import {
  ORGAN_VARIANTS,
  ORGAN_ACCESSORIES,
  ORGAN_CHARACTERS,
  getVariantById,
  getAccessoryById,
  getVariantsForSystem,
  type OrganVariantId,
  type OrganAccessoryId,
} from '../../config/organ-characters';

const STORAGE_KEY = 'panceai_organ_characters_v1';
const CUSTOMIZATION_KEY = 'panceai_character_customization_v1';

export interface UserOrganProgress {
  unlockedVariants: Set<OrganVariantId>;
  unlockedAccessories: Set<OrganAccessoryId>;
  systemProgress: Map<SystemCode, {
    questionsAnswered: number;
    correct: number;
    accuracy: number;
  }>;
  specialModeProgress: Map<string, number>; // For easter egg tracking (e.g., ecg_drill: 50)
}

export interface CharacterCustomization {
  system: SystemCode | 'SPECIAL';
  activeVariant: OrganVariantId;
  equippedAccessories: OrganAccessoryId[];
}

/**
 * Load user's organ character progress from localStorage
 */
export function loadOrganProgress(): UserOrganProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return initializeOrganProgress();
    }

    const data = JSON.parse(stored);
    return {
      unlockedVariants: new Set(data.unlockedVariants || []),
      unlockedAccessories: new Set(data.unlockedAccessories || []),
      systemProgress: new Map(Object.entries(data.systemProgress || {})),
      specialModeProgress: new Map(Object.entries(data.specialModeProgress || {})),
    };
  } catch (error) {
    console.error('Failed to load organ progress:', error);
    return initializeOrganProgress();
  }
}

/**
 * Initialize organ character progress with base variants unlocked
 */
function initializeOrganProgress(): UserOrganProgress {
  const baseVariants = ORGAN_VARIANTS
    .filter(v => v.isBase)
    .map(v => v.id);

  return {
    unlockedVariants: new Set(baseVariants),
    unlockedAccessories: new Set(),
    systemProgress: new Map(),
    specialModeProgress: new Map(),
  };
}

/**
 * Save organ character progress to localStorage
 */
export function saveOrganProgress(progress: UserOrganProgress): void {
  try {
    const data = {
      unlockedVariants: Array.from(progress.unlockedVariants),
      unlockedAccessories: Array.from(progress.unlockedAccessories),
      systemProgress: Object.fromEntries(progress.systemProgress),
      specialModeProgress: Object.fromEntries(progress.specialModeProgress),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save organ progress:', error);
  }
}

/**
 * Load character customization (which variants/accessories are equipped)
 */
export function loadCharacterCustomization(): Map<SystemCode | 'SPECIAL', CharacterCustomization> {
  try {
    const stored = localStorage.getItem(CUSTOMIZATION_KEY);
    if (!stored) {
      return initializeCustomization();
    }

    const data = JSON.parse(stored);
    return new Map(Object.entries(data));
  } catch (error) {
    console.error('Failed to load character customization:', error);
    return initializeCustomization();
  }
}

/**
 * Initialize default customization (base variants, no accessories)
 */
function initializeCustomization(): Map<SystemCode | 'SPECIAL', CharacterCustomization> {
  const customization = new Map<SystemCode | 'SPECIAL', CharacterCustomization>();
  
  ORGAN_CHARACTERS.forEach(character => {
    customization.set(character.system, {
      system: character.system,
      activeVariant: character.baseVariant,
      equippedAccessories: [],
    });
  });

  return customization;
}

/**
 * Save character customization
 */
export function saveCharacterCustomization(
  customization: Map<SystemCode | 'SPECIAL', CharacterCustomization>
): void {
  try {
    const data = Object.fromEntries(customization);
    localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save character customization:', error);
  }
}

/**
 * Update system progress based on performance data
 */
export function updateSystemProgress(
  progress: UserOrganProgress,
  performanceData: PerformanceRecord[]
): UserOrganProgress {
  // Start with existing progress to preserve any manually tracked data
  const systemProgress = new Map(progress.systemProgress);

  // Recalculate from performance data
  const calculatedProgress = new Map<SystemCode, {
    questionsAnswered: number;
    correct: number;
    accuracy: number;
  }>();

  // Group by system
  performanceData.forEach(record => {
    if (!record.system) return;

    const existing = calculatedProgress.get(record.system) || {
      questionsAnswered: 0,
      correct: 0,
      accuracy: 0,
    };

    calculatedProgress.set(record.system, {
      questionsAnswered: existing.questionsAnswered + 1,
      correct: existing.correct + (record.isCorrect ? 1 : 0),
      accuracy: 0, // Will calculate after
    });
  });

  // Calculate accuracy and merge with existing
  calculatedProgress.forEach((data, system) => {
    data.accuracy = data.questionsAnswered > 0
      ? Math.round((data.correct / data.questionsAnswered) * 100)
      : 0;
    systemProgress.set(system, data);
  });

  return {
    ...progress,
    systemProgress,
  };
}

/**
 * Check for newly unlocked variants based on progress
 */
export function checkVariantUnlocks(
  progress: UserOrganProgress,
  currentStreak: number,
  totalQuestions: number
): OrganVariantId[] {
  const newUnlocks: OrganVariantId[] = [];

  ORGAN_VARIANTS.forEach(variant => {
    // Skip if already unlocked
    if (progress.unlockedVariants.has(variant.id)) return;

    let shouldUnlock = false;

    switch (variant.unlockCondition.type) {
      case 'default':
        shouldUnlock = true;
        break;

      case 'questions_answered':
        if (variant.system !== 'SPECIAL' && variant.system) {
          const systemData = progress.systemProgress.get(variant.system);
          shouldUnlock = (systemData?.questionsAnswered || 0) >= (variant.unlockCondition.value || 0);
        }
        break;

      case 'accuracy_threshold':
        if (variant.system !== 'SPECIAL' && variant.system) {
          const systemData = progress.systemProgress.get(variant.system);
          shouldUnlock = (systemData?.accuracy || 0) >= (variant.unlockCondition.value || 0);
        }
        break;

      case 'specific_condition':
        // This would require tracking specific condition performance
        // For now, we'll use system progress as a proxy
        if (variant.system !== 'SPECIAL' && variant.system) {
          const systemData = progress.systemProgress.get(variant.system);
          shouldUnlock = (systemData?.questionsAnswered || 0) >= (variant.unlockCondition.value || 0);
        }
        break;

      case 'easter_egg':
        const modeProgress = progress.specialModeProgress.get(variant.unlockCondition.condition || '');
        shouldUnlock = (modeProgress || 0) >= (variant.unlockCondition.value || 0);
        break;

      case 'achievement':
        // Check if achievement is unlocked (would integrate with achievement system)
        // For now, we'll leave this as false
        break;
    }

    if (shouldUnlock) {
      newUnlocks.push(variant.id);
    }
  });

  return newUnlocks;
}

/**
 * Check for newly unlocked accessories
 */
export function checkAccessoryUnlocks(
  progress: UserOrganProgress,
  currentStreak: number,
  totalQuestions: number
): OrganAccessoryId[] {
  const newUnlocks: OrganAccessoryId[] = [];

  ORGAN_ACCESSORIES.forEach(accessory => {
    // Skip if already unlocked
    if (progress.unlockedAccessories.has(accessory.id)) return;

    let shouldUnlock = false;

    switch (accessory.unlockCondition.type) {
      case 'total_questions':
        shouldUnlock = totalQuestions >= (accessory.unlockCondition.value || 0);
        break;

      case 'streak':
        shouldUnlock = currentStreak >= (accessory.unlockCondition.value || 0);
        break;

      case 'achievement':
        // Check if achievement is unlocked (would integrate with achievement system)
        // For now, we'll leave this as false
        break;

      case 'special_event':
        // These are manually unlocked or through special events
        break;
    }

    if (shouldUnlock) {
      newUnlocks.push(accessory.id);
    }
  });

  return newUnlocks;
}

/**
 * Unlock variants and accessories
 */
export function unlockItems(
  progress: UserOrganProgress,
  variants: OrganVariantId[],
  accessories: OrganAccessoryId[]
): UserOrganProgress {
  const updated = { ...progress };
  
  variants.forEach(id => updated.unlockedVariants.add(id));
  accessories.forEach(id => updated.unlockedAccessories.add(id));

  return updated;
}

/**
 * Increment special mode progress (for easter eggs)
 */
export function incrementSpecialModeProgress(
  progress: UserOrganProgress,
  modeId: string,
  increment: number = 1
): UserOrganProgress {
  const current = progress.specialModeProgress.get(modeId) || 0;
  const newProgress = new Map(progress.specialModeProgress);
  newProgress.set(modeId, current + increment);
  
  return {
    ...progress,
    specialModeProgress: newProgress,
  };
}

/**
 * Get completion percentage for a system
 */
export function getSystemCompletion(
  progress: UserOrganProgress,
  system: SystemCode
): number {
  const systemVariants = getVariantsForSystem(system);
  const unlockedCount = systemVariants.filter(v => 
    progress.unlockedVariants.has(v.id)
  ).length;
  
  return systemVariants.length > 0
    ? Math.round((unlockedCount / systemVariants.length) * 100)
    : 0;
}

/**
 * Get overall collection completion
 */
export function getOverallCompletion(progress: UserOrganProgress): {
  variantsUnlocked: number;
  totalVariants: number;
  accessoriesUnlocked: number;
  totalAccessories: number;
  percentage: number;
} {
  const totalItems = ORGAN_VARIANTS.length + ORGAN_ACCESSORIES.length;
  const unlockedItems = progress.unlockedVariants.size + progress.unlockedAccessories.size;

  return {
    variantsUnlocked: progress.unlockedVariants.size,
    totalVariants: ORGAN_VARIANTS.length,
    accessoriesUnlocked: progress.unlockedAccessories.size,
    totalAccessories: ORGAN_ACCESSORIES.length,
    percentage: totalItems > 0 ? Math.round((unlockedItems / totalItems) * 100) : 0,
  };
}

/**
 * Change active variant for a system
 */
export function changeActiveVariant(
  customization: Map<SystemCode | 'SPECIAL', CharacterCustomization>,
  system: SystemCode | 'SPECIAL',
  variantId: OrganVariantId
): Map<SystemCode | 'SPECIAL', CharacterCustomization> {
  const current = customization.get(system);
  if (!current) return customization;

  customization.set(system, {
    ...current,
    activeVariant: variantId,
  });

  return customization;
}

/**
 * Equip/unequip accessory for a system
 */
export function toggleAccessory(
  customization: Map<SystemCode | 'SPECIAL', CharacterCustomization>,
  system: SystemCode | 'SPECIAL',
  accessoryId: OrganAccessoryId
): Map<SystemCode | 'SPECIAL', CharacterCustomization> {
  const current = customization.get(system);
  if (!current) return customization;

  const equipped = current.equippedAccessories;
  const index = equipped.indexOf(accessoryId);

  customization.set(system, {
    ...current,
    equippedAccessories: index >= 0
      ? equipped.filter(id => id !== accessoryId)
      : [...equipped, accessoryId],
  });

  return customization;
}

/**
 * Get newly available items (not yet seen by user)
 */
export function getNewItems(
  progress: UserOrganProgress,
  lastSeenVariants: Set<OrganVariantId>,
  lastSeenAccessories: Set<OrganAccessoryId>
): {
  newVariants: OrganVariantId[];
  newAccessories: OrganAccessoryId[];
} {
  const newVariants = Array.from(progress.unlockedVariants).filter(
    id => !lastSeenVariants.has(id)
  );
  
  const newAccessories = Array.from(progress.unlockedAccessories).filter(
    id => !lastSeenAccessories.has(id)
  );

  return { newVariants, newAccessories };
}
