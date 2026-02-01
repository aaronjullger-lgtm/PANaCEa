import { describe, it, expect } from 'vitest';

import { searchConditions } from './conditionSearch.ts';

describe('conditionSearch', () => {
  it('fuzzy search matches minor typos', async () => {
    const results = await searchConditions('fibrilation');
    const top = results[0];
    expect(top).toBeDefined();
    expect(top?.condition).toBe('Atrial Fibrillation');
  });

  it('returns empty array on blank query', async () => {
    const results = await searchConditions('   ');
    expect(results).toEqual([]);
  });
});
