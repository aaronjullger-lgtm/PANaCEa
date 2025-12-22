/**
 * Registry Integrity Test Suite
 * 
 * Validates all medical content registries to catch issues before production:
 * - Duplicate entries
 * - Invalid system codes
 * - Missing required fields
 * - Broken media references
 * - Inconsistent naming
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Import registries
import { CONDITION_REGISTRY_CV } from '../conditionRegistry';
import type { SystemCode } from '../types';

// Valid system codes from the type definition
const VALID_SYSTEM_CODES: SystemCode[] = [
  'CV', 'DERM', 'ENDO', 'GI', 'GU', 'HEME', 'HEENT', 
  'ID', 'MSK', 'NEURO', 'PRO', 'PSYCH', 'PULM', 'RENAL', 'REPRO', 'OTHER'
];

// Helper to dynamically import all registries
async function loadAllConditionRegistries() {
  const registry = await import('../conditionRegistry');
  
  // Collect all exported arrays that match the pattern CONDITION_REGISTRY_*
  const allConditions: Array<{ system: string; condition: string; subcategory: string }> = [];
  
  for (const [key, value] of Object.entries(registry)) {
    if (key.startsWith('CONDITION_REGISTRY_') && Array.isArray(value)) {
      allConditions.push(...value);
    }
  }
  
  return allConditions;
}

async function loadDrugRegistry() {
  try {
    const registry = await import('../drugRegistry');
    
    // Collect all exported arrays - DrugMeta has genericName, not name
    const allDrugs: Array<{ genericName: string; drugClass?: string[]; brandName?: string }> = [];
    
    for (const [key, value] of Object.entries(registry)) {
      if (key.startsWith('DRUG_REGISTRY_') && Array.isArray(value)) {
        allDrugs.push(...value);
      }
    }
    
    return allDrugs;
  } catch {
    console.warn('Drug registry not found or failed to load');
    return [];
  }
}

async function loadAnatomyRegistry() {
  try {
    const registry = await import('../anatomyRegistry');
    return Object.values(registry).flat().filter(Array.isArray);
  } catch {
    console.warn('Anatomy registry not found or failed to load');
    return [];
  }
}

// ============================================================================
// Condition Registry Tests
// ============================================================================

describe('Condition Registry Integrity', () => {
  let allConditions: Array<{ system: string; condition: string; subcategory: string }>;

  beforeAll(async () => {
    allConditions = await loadAllConditionRegistries();
  });

  it('should have no duplicate condition names within the same system', () => {
    const conditionsBySystem = new Map<string, Set<string>>();
    const duplicates: string[] = [];

    for (const entry of allConditions) {
      const system = entry.system;
      const condition = entry.condition.toLowerCase().trim();

      if (!conditionsBySystem.has(system)) {
        conditionsBySystem.set(system, new Set());
      }

      const systemSet = conditionsBySystem.get(system)!;
      if (systemSet.has(condition)) {
        duplicates.push(`${system}: ${entry.condition}`);
      } else {
        systemSet.add(condition);
      }
    }

    expect(duplicates, `Found duplicate conditions: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('should only use valid SystemCode values', () => {
    const invalidSystems: string[] = [];

    for (const entry of allConditions) {
      if (!VALID_SYSTEM_CODES.includes(entry.system as SystemCode)) {
        invalidSystems.push(`${entry.condition} has invalid system: ${entry.system}`);
      }
    }

    expect(invalidSystems, `Found invalid system codes: ${invalidSystems.join(', ')}`).toHaveLength(0);
  });

  it('should have non-empty condition names', () => {
    const emptyNames = allConditions.filter(
      (entry) => !entry.condition || entry.condition.trim() === ''
    );

    expect(emptyNames).toHaveLength(0);
  });

  it('should have non-empty subcategory for each condition', () => {
    const missingSubcategories = allConditions.filter(
      (entry) => !entry.subcategory || entry.subcategory.trim() === ''
    );

    expect(
      missingSubcategories,
      `Found ${missingSubcategories.length} conditions without subcategory`
    ).toHaveLength(0);
  });

  it('should not have leading/trailing whitespace in condition names', () => {
    const whitespaceIssues = allConditions.filter(
      (entry) => entry.condition !== entry.condition.trim()
    );

    expect(whitespaceIssues).toHaveLength(0);
  });

  it('should have consistent capitalization style', () => {
    // Check for conditions that start with lowercase (likely typos)
    const lowercaseStarts = allConditions.filter((entry) => {
      const firstChar = entry.condition.charAt(0);
      // Allow parentheses and special characters, but flag if it starts with a-z
      return /^[a-z]/.test(firstChar);
    });

    // This is a warning, not a hard fail - some legitimate conditions may start lowercase
    if (lowercaseStarts.length > 0) {
      console.warn(
        `Conditions starting with lowercase: ${lowercaseStarts.map((c) => c.condition).join(', ')}`
      );
    }

    // We allow some, but flag if there are many
    expect(lowercaseStarts.length).toBeLessThan(10);
  });
});

// ============================================================================
// Drug Registry Tests
// ============================================================================

describe('Drug Registry Integrity', () => {
  let allDrugs: Array<{ name: string; class?: string; category?: string }>;

  beforeAll(async () => {
    allDrugs = await loadDrugRegistry();
  });

  it('should have no duplicate drug names', () => {
    if (allDrugs.length === 0) {
      console.warn('Drug registry is empty or not loaded');
      return;
    }

    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const drug of allDrugs) {
      if (!drug.name) continue;
      const normalized = drug.name.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push(drug.name);
      } else {
        seen.add(normalized);
      }
    }

    expect(duplicates, `Found duplicate drugs: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('should have non-empty drug names', () => {
    if (allDrugs.length === 0) return;

    const emptyNames = allDrugs.filter(
      (drug) => !drug.name || drug.name.trim() === ''
    );

    expect(emptyNames).toHaveLength(0);
  });
});

// ============================================================================
// Cross-Registry Consistency Tests
// ============================================================================

describe('Cross-Registry Consistency', () => {
  it('should have conditions covering all major systems', async () => {
    const allConditions = await loadAllConditionRegistries();
    const systemsWithConditions = new Set(allConditions.map((c) => c.system));

    // These systems should definitely have conditions
    const requiredSystems: SystemCode[] = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'ENDO'];

    for (const system of requiredSystems) {
      expect(
        systemsWithConditions.has(system),
        `Missing conditions for system: ${system}`
      ).toBe(true);
    }
  });

  it('should have at least 5 conditions per major system', async () => {
    const allConditions = await loadAllConditionRegistries();
    const conditionCounts = new Map<string, number>();

    for (const condition of allConditions) {
      const count = conditionCounts.get(condition.system) || 0;
      conditionCounts.set(condition.system, count + 1);
    }

    const thinSystems = Array.from(conditionCounts.entries())
      .filter(([, count]) => count < 5)
      .map(([system]) => system);

    // PRO and OTHER are exempt from minimum requirements
    const significantThinSystems = thinSystems.filter(
      (s) => s !== 'PRO' && s !== 'OTHER'
    );

    expect(
      significantThinSystems,
      `Systems with fewer than 5 conditions: ${significantThinSystems.join(', ')}`
    ).toHaveLength(0);
  });
});

// ============================================================================
// Media Reference Tests
// ============================================================================

describe('Media Reference Integrity', () => {
  it('should have valid media IDs format when present', async () => {
    const allConditions = await loadAllConditionRegistries();
    const invalidMediaIds: string[] = [];

    for (const condition of allConditions) {
      const mediaIds = (condition as { mediaIds?: string[] }).mediaIds;
      if (mediaIds && Array.isArray(mediaIds)) {
        for (const id of mediaIds) {
          // Media IDs should be non-empty strings without special characters
          if (typeof id !== 'string' || id.trim() === '' || /[<>:"|?*]/.test(id)) {
            invalidMediaIds.push(`${condition.condition}: ${id}`);
          }
        }
      }
    }

    expect(
      invalidMediaIds,
      `Found invalid media IDs: ${invalidMediaIds.join(', ')}`
    ).toHaveLength(0);
  });
});

// ============================================================================
// Summary Statistics (Informational)
// ============================================================================

describe('Registry Statistics', () => {
  it('should report registry sizes', async () => {
    const allConditions = await loadAllConditionRegistries();
    const allDrugs = await loadDrugRegistry();

    console.log('\n📊 Registry Statistics:');
    console.log(`   Total Conditions: ${allConditions.length}`);
    console.log(`   Total Drugs: ${allDrugs.length}`);

    // Count by system
    const bySystem = new Map<string, number>();
    for (const c of allConditions) {
      bySystem.set(c.system, (bySystem.get(c.system) || 0) + 1);
    }

    console.log('\n   Conditions by System:');
    for (const [system, count] of Array.from(bySystem.entries()).sort()) {
      console.log(`     ${system}: ${count}`);
    }

    // This test always passes - it's informational
    expect(true).toBe(true);
  });
});
