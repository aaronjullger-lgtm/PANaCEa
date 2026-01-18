import { describe, it, expect } from 'vitest';
import {
  SPECIALTY_CAQ_PACKS,
  isSpecialtyPackUnlocked,
  getAvailableSpecialtyPacks,
} from '../config/specialty-caq';

describe('Specialty CAQ Packs', () => {
  it('should have 4 specialty packs', () => {
    expect(SPECIALTY_CAQ_PACKS.length).toBe(4);
  });

  it('should have orthopedics, dermatology, psychiatry, and ER packs', () => {
    const ids = SPECIALTY_CAQ_PACKS.map((pack) => pack.id);

    expect(ids).toContain('orthopedics');
    expect(ids).toContain('dermatology');
    expect(ids).toContain('psychiatry');
    expect(ids).toContain('emergency_medicine');
  });

  it('should have proper metadata for each pack', () => {
    SPECIALTY_CAQ_PACKS.forEach((pack) => {
      expect(pack.name).toBeDefined();
      expect(pack.description).toBeDefined();
      expect(pack.description.length).toBeGreaterThan(20);
    });
  });

  it('should check if pack is unlocked correctly', () => {
    const userPurchases = ['orthopedics', 'dermatology'];

    expect(isSpecialtyPackUnlocked('orthopedics', userPurchases)).toBe(true);
    expect(isSpecialtyPackUnlocked('psychiatry', userPurchases)).toBe(false);
  });

  it('should return empty array when no purchases', () => {
    expect(isSpecialtyPackUnlocked('orthopedics', [])).toBe(false);
  });

  it('should get available specialty packs', () => {
    const available = getAvailableSpecialtyPacks();

    // All packs should be available (release dates in past or future)
    expect(available.length).toBeGreaterThan(0);
    expect(available.length).toBeLessThanOrEqual(SPECIALTY_CAQ_PACKS.length);
  });
});
