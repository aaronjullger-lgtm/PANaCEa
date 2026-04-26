import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './search';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

vi.mock('../_shared/middleware', () => ({
  publicEndpoint: vi.fn((_schema: unknown, handler: any, _options?: unknown) => handler),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
}));

const prisma = {
  drug: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
};

function context(validated: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'prisma://test' },
    validated,
  };
}

describe('GET /api/drugs/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createEdgePrismaClient as any).mockReturnValue(prisma);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.drug.findMany.mockResolvedValue([]);
  });

  it('returns a known drug with production reference fields', async () => {
    prisma.drug.findMany.mockResolvedValue([
      {
        id: 'drug_metformin',
        genericName: 'metformin',
        brandName: 'Glucophage',
        displayName: 'Metformin',
        drugClass: ['Biguanide'],
        isHighYield: true,
        isFirstLine: true,
        panceYield: 5,
        mechanismOfAction: 'Decreases hepatic gluconeogenesis',
        indications: ['type 2 diabetes mellitus'],
        contraindications: ['severe renal impairment'],
        sideEffects: ['GI upset'],
        interactions: ['iodinated contrast'],
        monitoringParams: ['eGFR'],
        blackBoxWarnings: ['lactic acidosis'],
        pregnancyCategory: 'B',
        pregnancyNotes: 'Use only when clinically indicated',
        lactationSafety: 'compatible',
        lactationNotes: 'Monitor infant',
        clinicalPearls: ['Hold around contrast exposure when appropriate'],
      },
    ]);

    const result = await (onRequestGet as any)(context({ q: 'metformin', limit: 10 }));

    expect(result.data[0]).toMatchObject({
      id: 'drug_metformin',
      genericName: 'metformin',
      monitoringParams: ['eGFR'],
      pregnancyCategory: 'B',
      lactationSafety: 'compatible',
    });
  });

  it('returns no results for an empty query', async () => {
    const result = await (onRequestGet as any)(context({ q: '   ', limit: 10 }));
    expect(result.data).toEqual([]);
    expect(prisma.drug.findMany).not.toHaveBeenCalled();
  });

  it('handles special characters without throwing', async () => {
    const result = await (onRequestGet as any)(context({ q: '\u0000%%%???', limit: 10 }));
    expect(result.data).toEqual([]);
  });
});
