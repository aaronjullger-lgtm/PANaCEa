import { describe, it, expect, vi, beforeEach } from 'vitest';
import { balanceBlueprintPriorities } from './blueprintBalancedSelector';

// Mock NCCPA_2025_BLUEPRINT
vi.mock('@/lib/constants/blueprint', () => ({
  NCCPA_2025_BLUEPRINT: {
    Cardiovascular: 11,
    Pulmonary: 9,
    'Gastrointestinal/Nutrition': 8,
    Musculoskeletal: 8,
    'Neurology/Psychiatry': 7,
    'Genitourinary/Renal': 6,
    'Ear/Nose/Throat': 5,
    'Dermatology/Integumentary': 5,
    'Hematology/Oncology': 5,
    'Endocrine/Metabolic': 5,
    'Infectious Disease/Immunology': 5,
    'Preventive Medicine/Public Health': 5,
    'Professional Practice/Ethics': 5,
    'Research/Evidence-Based Medicine': 5,
  },
}));

describe('Blueprint‑Balanced Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return items sorted by priority score', async () => {
    const gaps = [
      { taxonomyCode: 'Cardiovascular', gap: 0.3 },
      { taxonomyCode: 'Pulmonary', gap: 0.1 },
    ];
    const scheduledReviews = [];

    const balanced = await balanceBlueprintPriorities(
      gaps,
      scheduledReviews,
      undefined, // no Prisma
      undefined, // no userId
      { distributionSource: 'upcoming' }
    );

    expect(balanced).toHaveLength(2);
    expect(balanced[0].priorityScore).toBeGreaterThanOrEqual(balanced[1].priorityScore);
    expect(balanced.map(b => b.taxonomyCode)).toEqual(['Cardiovascular', 'Pulmonary']);
  });

  it('should factor weight deviation when balanceStrength > 0', async () => {
    // Mock current distribution with over‑representation of Cardiovascular
    const gaps = [
      { taxonomyCode: 'Cardiovascular', gap: 0.1 },
      { taxonomyCode: 'Pulmonary', gap: 0.1 },
    ];
    const scheduledReviews = [
      { taxonomyCode: 'Cardiovascular' },
      { taxonomyCode: 'Cardiovascular' },
      { taxonomyCode: 'Pulmonary' },
    ]; // 2:1 ratio → Cardiovascular over‑represented

    const balanced = await balanceBlueprintPriorities(
      gaps,
      scheduledReviews,
      undefined,
      undefined,
      { distributionSource: 'upcoming', balanceStrength: 1.0 }
    );

    // Pulmonary should have higher priority because it's underrepresented
    expect(balanced[0].taxonomyCode).toBe('Pulmonary');
    expect(balanced[0].weightDeviation).toBeGreaterThan(balanced[1].weightDeviation);
  });

  it('should handle missing gaps gracefully', async () => {
    const gaps = [];
    const scheduledReviews = [];
    const balanced = await balanceBlueprintPriorities(gaps, scheduledReviews);
    expect(balanced).toEqual([]);
  });

  it('should compute recent distribution when source=recent (requires Prisma)', async () => {
    // We'll mock Prisma's findMany
    const mockPrisma = {
      reviewLog: {
        findMany: vi.fn().mockResolvedValue([
          { system: 'Cardiovascular', subcategory: null },
          { system: 'Cardiovascular', subcategory: null },
          { system: 'Pulmonary', subcategory: null },
        ]),
      },
    };

    const gaps = [
      { taxonomyCode: 'Cardiovascular', gap: 0.2 },
      { taxonomyCode: 'Pulmonary', gap: 0.2 },
    ];

    const balanced = await balanceBlueprintPriorities(
      gaps,
      [],
      mockPrisma,
      'user123',
      { distributionSource: 'recent', recentReviewWindow: 100 }
    );

    expect(mockPrisma.reviewLog.findMany).toHaveBeenCalled();
    expect(balanced).toHaveLength(2);
  });

  it('should throw when source=recent but Prisma missing', async () => {
    const gaps = [{ taxonomyCode: 'Cardiovascular' }];
    await expect(
      balanceBlueprintPriorities(gaps, [], undefined, undefined, {
        distributionSource: 'recent',
      })
    ).rejects.toThrow('Prisma client and userId required');
  });

  it('should normalize gap to 0‑1 range', async () => {
    const gaps = [
      { taxonomyCode: 'Cardiovascular', gap: 0.9 }, // max gap
      { taxonomyCode: 'Pulmonary', gap: 0.45 },
    ];
    const balanced = await balanceBlueprintPriorities(gaps, []);
    // Normalized gap: 0.9/0.9 = 1, 0.45/0.9 = 0.5
    expect(balanced[0].priorityScore).toBeGreaterThan(balanced[1].priorityScore);
  });

  it('should include subcategory keys when includeSubcategories=true', async () => {
    const gaps = [
      { taxonomyCode: 'Cardiovascular', subcategory: 'Heart Failure', gap: 0.3 },
      { taxonomyCode: 'Cardiovascular', subcategory: 'Arrhythmia', gap: 0.1 },
    ];
    const scheduledReviews = [];
    const balanced = await balanceBlueprintPriorities(
      gaps,
      scheduledReviews,
      undefined,
      undefined,
      { includeSubcategories: true }
    );
    expect(balanced[0].subcategory).toBe('Heart Failure');
    expect(balanced[1].subcategory).toBe('Arrhythmia');
  });
});