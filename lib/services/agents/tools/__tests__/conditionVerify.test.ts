/**
 * conditionVerify — Integration Tests
 *
 * Tests condition verification with mocked Prisma.
 * Covers: refusal language detection, field completeness,
 * staleness scoring, and scoring edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../toolRegistry';
import { conditionVerifyTool } from '../conditionVerify';

function makeRegistry() {
  return new ToolRegistry([conditionVerifyTool]);
}

describe('conditionVerify — Input Validation', () => {
  const tool = conditionVerifyTool;

  it('accepts conditionId', () => {
    expect(() => tool.inputSchema.parse({ conditionId: 'cond-1' })).not.toThrow();
  });

  it('accepts conditionName', () => {
    expect(() => tool.inputSchema.parse({ conditionName: 'Hypertension' })).not.toThrow();
  });

  it('accepts empty input (scan mode)', () => {
    expect(() => tool.inputSchema.parse({})).not.toThrow();
  });

  it('accepts maxAgeDays and limit', () => {
    expect(() =>
      tool.inputSchema.parse({ maxAgeDays: 180, limit: 5 })
    ).not.toThrow();
  });

  it('rejects maxAgeDays below 30', () => {
    expect(() => tool.inputSchema.parse({ maxAgeDays: 10 })).toThrow();
  });

  it('rejects maxAgeDays above 730', () => {
    expect(() => tool.inputSchema.parse({ maxAgeDays: 800 })).toThrow();
  });
});

describe('conditionVerify — Execution', () => {
  it('detects stale condition (>365 days)', async () => {
    const oldDate = new Date('2024-01-01');
    const mockPrisma = {
      condition: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'stale-1',
          name: 'Old Condition',
          system: 'Cardiovascular',
          updatedAt: oldDate,
          overview: 'A common cardiovascular condition affecting millions of patients worldwide.',
          symptoms: ['chest pain', 'shortness of breath', 'palpitations'],
          riskFactors: ['hypertension', 'smoking'],
          diagnosis: 'Diagnosis is confirmed via 12-lead EKG and cardiac biomarkers including troponin.',
          treatment: 'First-line treatment includes aspirin, beta-blockers, and statin therapy.',
          clinicalPearls: ['Always check posterior leads', 'Troponin can be negative early'],
          complications: ['heart failure'],
          status: 'published',
        }]),
      },
    };

    const result = await conditionVerifyTool.execute(
      { limit: 1 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.results).toHaveLength(1);
    const staleIssue = result.results[0]!.issues.some((i) => /^stale:/.test(i));
    expect(staleIssue).toBe(true);
    expect(result.results[0]!.score).toBeLessThan(100);
  });

  it('detects AI refusal language in overview', async () => {
    const mockPrisma = {
      condition: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'ai-refusal-1',
          name: 'AI Generated',
          system: 'Pulmonary',
          updatedAt: new Date(),
          overview: 'I am an AI language model and cannot provide medical advice about this condition.',
          symptoms: ['cough', 'fever', 'fatigue'],
          riskFactors: ['age', 'immunocompromised'],
          diagnosis: 'Diagnosis requires clinical evaluation and chest imaging.',
          treatment: 'Treatment depends on underlying etiology.',
          clinicalPearls: ['Key pearl 1', 'Key pearl 2'],
          complications: [],
          status: 'published',
        }]),
      },
    };

    const result = await conditionVerifyTool.execute(
      { limit: 1 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.results[0]!.issues).toContain('ai_refusal_detected');
    expect(result.results[0]!.score).toBeLessThanOrEqual(50);
  });

  it('detects missing required fields', async () => {
    const mockPrisma = {
      condition: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'incomplete-1',
          name: 'Incomplete Condition',
          system: 'Endocrine',
          updatedAt: new Date(),
          overview: 'Short.', // < 100 chars
          symptoms: ['fever'], // only 1, need 3
          riskFactors: [],
          diagnosis: 'Short.', // < 50 chars
          treatment: null,
          clinicalPearls: ['one pearl'], // only 1, need 2
          complications: [],
          status: 'published',
        }]),
      },
    };

    const result = await conditionVerifyTool.execute(
      { limit: 1 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    const issues = result.results[0]!.issues;
    expect(issues).toContain('missing_overview: <100 chars');
    expect(issues).toContain('missing_symptoms: only 1 (need 3+)');
    expect(issues).toContain('missing_pearls: only 1 (need 2+)');
    expect(issues).toContain('missing_diagnosis: <50 chars');
  });

  it('returns score 100 for perfect condition', async () => {
    const mockPrisma = {
      condition: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'perfect-1',
          name: 'Perfect Condition',
          system: 'Gastrointestinal',
          updatedAt: new Date(),
          overview: 'A comprehensive overview of this common gastrointestinal condition that affects patients across all age groups and requires thorough diagnostic evaluation.',
          symptoms: ['abdominal pain', 'nausea', 'vomiting', 'diarrhea'],
          riskFactors: ['diet', 'genetics', 'age'],
          diagnosis: 'Diagnosis is made through careful history, physical examination, and targeted laboratory studies.',
          treatment: 'Management includes supportive care, pharmacologic intervention, and lifestyle modification.',
          clinicalPearls: ['Pearl 1: Early recognition is key', 'Pearl 2: Always check labs before imaging'],
          complications: ['dehydration'],
          status: 'published',
        }]),
      },
    };

    const result = await conditionVerifyTool.execute(
      { limit: 1 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.results[0]!.score).toBe(100);
    expect(result.results[0]!.issues).toHaveLength(0);
  });

  it('includes summary in result', async () => {
    const mockPrisma = {
      condition: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'c1',
          name: 'Test',
          system: 'CV',
          updatedAt: new Date(),
          overview: 'A comprehensive clinical overview of this cardiovascular disease that requires careful management.',
          symptoms: ['chest pain', 'dyspnea', 'palpitations'],
          riskFactors: ['HTN', 'smoking'],
          diagnosis: 'Diagnosis confirmed via echocardiography and cardiac catheterization.',
          treatment: 'Treatment includes guideline-directed medical therapy.',
          clinicalPearls: ['Early intervention improves outcomes', 'Monitor renal function'],
          complications: ['arrhythmia'],
          status: 'published',
        }]),
      },
    };

    const result = await conditionVerifyTool.execute(
      { limit: 1 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.summary).toContain('conditions checked');
    expect(result.summary).toContain('issues found');
  });
});
