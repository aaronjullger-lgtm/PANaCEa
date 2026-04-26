import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchContent } from './content-search';

describe('searchContent', () => {
  const prisma = {
    condition: { findMany: vi.fn() },
    medicalContent: { findMany: vi.fn() },
    drug: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.condition.findMany.mockResolvedValue([]);
    prisma.medicalContent.findMany.mockResolvedValue([]);
    prisma.drug.findMany.mockResolvedValue([]);
  });

  it('returns a known condition from canonical condition content', async () => {
    prisma.condition.findMany.mockResolvedValue([
      {
        id: 'condition_htn',
        name: 'Hypertension',
        displayName: 'Hypertension',
        aliases: ['high blood pressure'],
        system: 'cardiology',
      },
    ]);

    const results = await searchContent(prisma as any, 'hypertension', 10, ['condition']);

    expect(results[0]).toMatchObject({
      id: 'condition_htn',
      title: 'Hypertension',
      type: 'condition',
    });
  });

  it('returns a known drug with real drug metadata', async () => {
    prisma.drug.findMany.mockResolvedValue([
      {
        id: 'drug_metformin',
        genericName: 'metformin',
        brandName: 'Glucophage',
        aliases: [],
        drugClass: ['Biguanide'],
        displayName: 'Metformin',
      },
    ]);

    const results = await searchContent(prisma as any, 'metformin', 10, ['drug']);

    expect(results[0]).toMatchObject({
      id: 'drug_metformin',
      title: 'metformin',
      type: 'drug',
      metadata: { drugClass: 'Biguanide' },
    });
  });

  it('returns an empty state for no results', async () => {
    await expect(searchContent(prisma as any, 'zzzz-not-found', 10)).resolves.toEqual([]);
  });

  it('handles special characters without throwing', async () => {
    await expect(searchContent(prisma as any, '  \u0000 %%% ???  ', 10)).resolves.toEqual([]);
    expect(prisma.condition.findMany).toHaveBeenCalled();
  });
});
