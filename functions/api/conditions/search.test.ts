import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './search';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

const middlewareCapture = vi.hoisted(() => ({ publicOptions: [] as unknown[] }));

vi.mock('../_shared/middleware', () => ({
  publicEndpoint: vi.fn((_schema: unknown, handler: any, options?: unknown) => {
    middlewareCapture.publicOptions.push(options);
    return handler;
  }),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

const prisma = {
  condition: { findMany: vi.fn() },
  medicalContent: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
};

function context(validated: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'prisma://test' },
    validated,
  };
}

describe('GET /api/conditions/search', () => {
  beforeEach(() => {
    (createEdgePrismaClient as any).mockReturnValue(prisma);
    prisma.condition.findMany.mockReset().mockResolvedValue([]);
    prisma.medicalContent.findMany.mockReset().mockResolvedValue([]);
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
  });

  it('is wired to read query params', () => {
    expect(middlewareCapture.publicOptions).toContainEqual({ source: 'query' });
  });

  it('returns a known condition from the Condition table', async () => {
    prisma.condition.findMany.mockResolvedValue([
      {
        id: 'condition_htn',
        name: 'Hypertension',
        displayName: 'Hypertension',
        aliases: ['high blood pressure'],
        system: 'cardiology',
        subcategory: 'vascular',
        status: 'published',
      },
    ]);
    prisma.medicalContent.findMany.mockResolvedValue([
      { conditionId: 'condition_htn', synonyms: ['HTN'] },
    ]);

    const result = await (onRequestGet as any)(context({ q: 'hypertension', limit: 10 }));

    expect(result.data[0]).toMatchObject({
      id: 'condition_htn',
      condition: 'Hypertension',
      system: 'cardiology',
    });
  });

  it('uses conditionId, not MedicalContent id, for full-text fallback links', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'medical_content_mi',
        conditionId: 'condition_mi',
        condition: 'Myocardial Infarction',
        system: 'cardiology',
        subcategory: 'acute coronary syndrome',
        synonyms: ['heart attack'],
      },
    ]);

    const result = await (onRequestGet as any)(context({ q: 'heart attack', limit: 10 }));

    expect(result.data[0]).toMatchObject({
      id: 'condition_mi',
      condition: 'Myocardial Infarction',
    });
  });

  it('handles special characters as an empty result instead of crashing', async () => {
    const result = await (onRequestGet as any)(context({ q: '\u0000%%%???', limit: 10 }));
    expect(result.data).toEqual([]);
  });
});
