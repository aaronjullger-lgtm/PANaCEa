import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './[drugId]';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

const middlewareCapture = vi.hoisted(() => ({ authOptions: [] as unknown[] }));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any, options?: unknown) => {
    middlewareCapture.authOptions.push(options);
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
}));

const prisma = {
  drug: { findUnique: vi.fn() },
};

function context(drugId: string) {
  return {
    env: { DATABASE_URL: 'prisma://test' },
    auth: { userId: 'user_1' },
    validated: { drugId },
  };
}

describe('GET /api/drugs/[drugId]', () => {
  beforeEach(() => {
    (createEdgePrismaClient as any).mockReturnValue(prisma);
    prisma.drug.findUnique.mockReset();
  });

  it('is wired to read route params', () => {
    expect(middlewareCapture.authOptions).toContainEqual({ source: 'params' });
  });

  it('loads a drug page with real pharmacology fields', async () => {
    prisma.drug.findUnique.mockResolvedValue({
      id: 'drug_metformin',
      genericName: 'metformin',
      brandName: 'Glucophage',
      drugClass: ['Biguanide'],
      mechanismOfAction: 'Decreases hepatic gluconeogenesis',
      indications: ['type 2 diabetes mellitus'],
      contraindications: ['severe renal impairment'],
      interactions: ['iodinated contrast'],
      monitoringParams: ['eGFR'],
      pregnancyCategory: 'B',
      lactationSafety: 'compatible',
      DrugConditionLink: [],
    });

    const result = await (onRequestGet as any)(context('drug_metformin'));

    expect(prisma.drug.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drug_metformin' },
      })
    );
    expect(result.data).toMatchObject({
      id: 'drug_metformin',
      genericName: 'metformin',
      monitoringParams: ['eGFR'],
    });
  });
});
