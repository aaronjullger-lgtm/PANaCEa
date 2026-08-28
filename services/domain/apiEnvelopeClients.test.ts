import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('domain service API envelope clients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('unwraps current double-wrapped guideline list responses', async () => {
    const guideline = {
      id: 'curb-65',
      name: 'CURB-65',
      description: 'Community-acquired pneumonia mortality risk',
      components: [],
      vignettes: [],
      maxScore: 5,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          success: true,
          data: {
            success: true,
            data: [guideline],
          },
        })
      )
    );

    const { guidelineService } = await import('./guidelineService');

    await expect(guidelineService.getAllGuidelines()).resolves.toEqual([guideline]);
  });

  it('unwraps first line treatment arrays from unified envelopes', async () => {
    const treatment = {
      id: 'tx-1',
      condition: 'community-acquired pneumonia',
      category: 'infectious disease',
      treatment: 'amoxicillin',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          success: true,
          data: [treatment],
        })
      )
    );

    const { firstLineService } = await import('./firstLineService');

    await expect(firstLineService.getAll()).resolves.toEqual([treatment]);
  });

  it('unwraps condition content so found records remain visible to question generation', async () => {
    const content = {
      found: true,
      conditionId: 'asthma',
      condition: 'Asthma',
      system: 'PULM',
      content: {
        overview: 'Asthma is a chronic inflammatory airway disease with reversible obstruction.',
        symptoms: ['wheezing', 'dyspnea'],
        treatment: ['inhaled corticosteroid'],
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          success: true,
          data: content,
        })
      )
    );

    const { fetchConditionContent, hasCompleteContent } = await import('../conditionContentService');
    const result = await fetchConditionContent('Asthma');

    expect(result).toEqual(content);
    expect(hasCompleteContent(result)).toBe(true);
  });
});
