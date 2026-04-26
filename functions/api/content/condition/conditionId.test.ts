import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './[conditionId]';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

const middlewareCapture = vi.hoisted(() => ({ publicOptions: [] as unknown[] }));

vi.mock('../../_shared/middleware', () => ({
  publicEndpoint: vi.fn((_schema: unknown, handler: any, options?: unknown) => {
    middlewareCapture.publicOptions.push(options);
    return handler;
  }),
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
}));

const prisma = {
  medicalContent: { findFirst: vi.fn() },
};

function context(conditionId: string) {
  return {
    env: { DATABASE_URL: 'prisma://test' },
    validated: { conditionId },
  };
}

describe('GET /api/content/condition/[conditionId]', () => {
  beforeEach(() => {
    (createEdgePrismaClient as any).mockReturnValue(prisma);
    prisma.medicalContent.findFirst.mockReset();
  });

  it('is wired to read route params', () => {
    expect(middlewareCapture.publicOptions).toContainEqual({ source: 'params' });
  });

  it('loads a condition page from published MedicalContent', async () => {
    prisma.medicalContent.findFirst.mockResolvedValue({
      id: 'content_htn',
      conditionId: 'condition_htn',
      condition: 'Hypertension',
      system: 'cardiology',
      subcategory: 'vascular',
      parent_category: null,
      overview: 'Persistent elevated blood pressure.',
      etiology: null,
      pathophysiology: null,
      epidemiology: null,
      symptoms: null,
      physicalExam: null,
      diagnostics: null,
      treatment: null,
      prognosis: null,
      differentialDiagnosis: null,
      riskFactors: null,
      complications: null,
      pance_yield: 5,
      synonyms: ['HTN'],
      buzzwords: [],
      classic_triad: null,
      clinical_pearls: [],
      differentials: [],
      mnemonic: null,
      relatedSystems: [],
      best_initial_test: null,
      gold_standard_dx: null,
      first_line_rx: null,
      age_demographic: null,
      gender_bias: null,
      classic_patient: null,
      disposition: null,
      patient_education: null,
      prevention: null,
      content: null,
      DrugConditionLink: [],
      FindingConditionLink: [],
      LabConditionLink: [],
      ImagingConditionLink: [],
      ECGConditionLink: [],
      TreatmentConditionLink: [],
      other_MedicalContent: [],
    });

    const result = await (onRequestGet as any)(context('condition_htn'));

    expect(prisma.medicalContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conditionId: 'condition_htn', status: 'published' },
      })
    );
    expect(result.data).toMatchObject({
      conditionId: 'condition_htn',
      condition: 'Hypertension',
      overview: 'Persistent elevated blood pressure.',
    });
  });
});
