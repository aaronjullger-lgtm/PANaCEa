// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/mediaTypes.ts
 *
 * Pure functions tested:
 *   categoryToType(category)          — MediaCategory → MediaType (DB column)
 *   typeToCategory(type)              — DB type string → MediaCategory (API slug)
 *   typeToModality(type)              — DB type string → DrillModality (UI)
 *   modalityToTypeFilters(modality)   — DrillModality → DB type[] for WHERE IN
 *   allDrillTypes()                   — full list of drill-eligible DB type strings
 *
 * Constants:
 *   MEDIA_CATEGORIES — ordered ['ecg','derm','radiology','labs','diagrams']
 */

import { describe, it, expect } from 'vitest';
import {
  MEDIA_CATEGORIES,
  categoryToType,
  typeToCategory,
  typeToModality,
  modalityToTypeFilters,
  allDrillTypes,
} from './mediaTypes';

// ─── MEDIA_CATEGORIES ─────────────────────────────────────────────────────────

describe('MEDIA_CATEGORIES', () => {
  it('contains exactly the 5 expected categories', () => {
    expect(MEDIA_CATEGORIES).toEqual(['ecg', 'derm', 'radiology', 'labs', 'diagrams']);
  });

  it('has 5 entries', () => {
    expect(MEDIA_CATEGORIES).toHaveLength(5);
  });
});

// ─── categoryToType ───────────────────────────────────────────────────────────

describe('categoryToType', () => {
  it('maps ecg → ekg', () => {
    expect(categoryToType('ecg')).toBe('ekg');
  });

  it('maps derm → photo', () => {
    expect(categoryToType('derm')).toBe('photo');
  });

  it('maps radiology → imaging', () => {
    expect(categoryToType('radiology')).toBe('imaging');
  });

  it('maps labs → labs (identity)', () => {
    expect(categoryToType('labs')).toBe('labs');
  });

  it('maps diagrams → diagram', () => {
    expect(categoryToType('diagrams')).toBe('diagram');
  });

  it('covers all MEDIA_CATEGORIES without returning "other"', () => {
    for (const cat of MEDIA_CATEGORIES) {
      expect(categoryToType(cat)).not.toBe('other');
    }
  });
});

// ─── typeToCategory ───────────────────────────────────────────────────────────

describe('typeToCategory', () => {
  // ECG variants
  it('maps "ekg" → "ecg"', () => {
    expect(typeToCategory('ekg')).toBe('ecg');
  });

  it('maps "ecg" → "ecg"', () => {
    expect(typeToCategory('ecg')).toBe('ecg');
  });

  // Derm variants
  it('maps "photo" → "derm"', () => {
    expect(typeToCategory('photo')).toBe('derm');
  });

  it('maps "derm" → "derm"', () => {
    expect(typeToCategory('derm')).toBe('derm');
  });

  // Radiology variants
  it('maps "imaging" → "radiology"', () => {
    expect(typeToCategory('imaging')).toBe('radiology');
  });

  it('maps "xray" → "radiology"', () => {
    expect(typeToCategory('xray')).toBe('radiology');
  });

  it('maps "radiology" → "radiology"', () => {
    expect(typeToCategory('radiology')).toBe('radiology');
  });

  // Labs
  it('maps "labs" → "labs"', () => {
    expect(typeToCategory('labs')).toBe('labs');
  });

  // Diagram
  it('maps "diagram" → "diagrams"', () => {
    expect(typeToCategory('diagram')).toBe('diagrams');
  });

  // Case normalization
  it('is case-insensitive (EKG → ecg)', () => {
    expect(typeToCategory('EKG')).toBe('ecg');
  });

  it('is case-insensitive (PHOTO → derm)', () => {
    expect(typeToCategory('PHOTO')).toBe('derm');
  });

  // Unknown fallback
  it('returns "derm" for unknown type strings', () => {
    expect(typeToCategory('unknown')).toBe('derm');
    expect(typeToCategory('')).toBe('derm');
  });
});

// ─── typeToModality ───────────────────────────────────────────────────────────

describe('typeToModality', () => {
  it('maps "ekg" → "ecg"', () => {
    expect(typeToModality('ekg')).toBe('ecg');
  });

  it('maps "ecg" → "ecg"', () => {
    expect(typeToModality('ecg')).toBe('ecg');
  });

  it('maps "imaging" → "xray"', () => {
    expect(typeToModality('imaging')).toBe('xray');
  });

  it('maps "xray" → "xray"', () => {
    expect(typeToModality('xray')).toBe('xray');
  });

  it('maps "radiology" → "xray"', () => {
    expect(typeToModality('radiology')).toBe('xray');
  });

  it('maps "photo" → "derm"', () => {
    expect(typeToModality('photo')).toBe('derm');
  });

  it('maps "derm" → "derm"', () => {
    expect(typeToModality('derm')).toBe('derm');
  });

  it('is case-insensitive (EKG → ecg)', () => {
    expect(typeToModality('EKG')).toBe('ecg');
  });

  it('defaults to "xray" for unknown types', () => {
    expect(typeToModality('unknown')).toBe('xray');
    expect(typeToModality('')).toBe('xray');
  });
});

// ─── modalityToTypeFilters ────────────────────────────────────────────────────

describe('modalityToTypeFilters', () => {
  it('ecg → includes ekg and ecg variants', () => {
    const filters = modalityToTypeFilters('ecg');
    expect(filters).toContain('ekg');
    expect(filters).toContain('ecg');
    expect(filters).toContain('ECG');
    expect(filters).toContain('EKG');
  });

  it('derm → includes photo and derm variants', () => {
    const filters = modalityToTypeFilters('derm');
    expect(filters).toContain('photo');
    expect(filters).toContain('derm');
    expect(filters).toContain('PHOTO');
    expect(filters).toContain('DERM');
  });

  it('xray → includes imaging and xray variants', () => {
    const filters = modalityToTypeFilters('xray');
    expect(filters).toContain('imaging');
    expect(filters).toContain('xray');
    expect(filters).toContain('IMAGING');
    expect(filters).toContain('XRAY');
    expect(filters).toContain('radiology');
  });

  it('ecg filters do not include photo or imaging', () => {
    const filters = modalityToTypeFilters('ecg');
    expect(filters).not.toContain('photo');
    expect(filters).not.toContain('imaging');
  });

  it('returns an array for all DrillModality values', () => {
    for (const mod of ['ecg', 'derm', 'xray'] as const) {
      expect(Array.isArray(modalityToTypeFilters(mod))).toBe(true);
    }
  });

  it('all returned values are non-empty strings', () => {
    for (const mod of ['ecg', 'derm', 'xray'] as const) {
      for (const f of modalityToTypeFilters(mod)) {
        expect(typeof f).toBe('string');
        expect(f.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── allDrillTypes ────────────────────────────────────────────────────────────

describe('allDrillTypes', () => {
  it('returns an array', () => {
    expect(Array.isArray(allDrillTypes())).toBe(true);
  });

  it('includes ekg, photo, imaging', () => {
    const all = allDrillTypes();
    expect(all).toContain('ekg');
    expect(all).toContain('photo');
    expect(all).toContain('imaging');
  });

  it('returns a non-empty array with at least 10 entries', () => {
    expect(allDrillTypes().length).toBeGreaterThanOrEqual(10);
  });

  it('contains ECG and EKG uppercase variants', () => {
    const all = allDrillTypes();
    expect(all).toContain('ECG');
    expect(all).toContain('EKG');
  });

  it('all entries are non-empty strings', () => {
    for (const t of allDrillTypes()) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  });
});
