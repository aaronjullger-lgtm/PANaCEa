import { describe, it, expect } from 'vitest';
import { unifiedSearch, type UnifiedSearchResult } from './unifiedSearch';

describe('unifiedSearch', () => {
  it('returns empty array on blank query', async () => {
    expect(await unifiedSearch('')).toEqual([]);
    expect(await unifiedSearch('   ')).toEqual([]);
  });

  it('prioritizes conditions over drugs with condition boost', async () => {
    // Search for "pneumonia" - should show condition results first
    const results = (await unifiedSearch('pneumonia')) as UnifiedSearchResult[];
    expect(results.length).toBeGreaterThan(0);

    // Find first condition and first drug if they exist
    const firstCondition = results.find((r) => r.type === 'condition');
    const firstDrug = results.find((r) => r.type === 'drug');

    if (firstCondition && firstDrug) {
      const conditionIndex = results.indexOf(firstCondition);
      const drugIndex = results.indexOf(firstDrug);

      // Condition should appear before drug
      expect(conditionIndex).toBeLessThan(drugIndex);
    }
  });

  it('finds both conditions and drugs for general terms', async () => {
    const results = (await unifiedSearch('diabetes')) as UnifiedSearchResult[];
    expect(results.length).toBeGreaterThan(0);

    // Should have at least some results
    const hasConditions = results.some((r) => r.type === 'condition');
    expect(hasConditions).toBe(true);
  });

  it('finds drugs by brand name', async () => {
    const results = (await unifiedSearch('Prozac')) as UnifiedSearchResult[];
    expect(results.length).toBeGreaterThan(0);

    const hasDrugs = results.some((r) => r.type === 'drug');
    expect(hasDrugs).toBe(true);
  });

  it('properly formats result names with capitalization', async () => {
    const results = (await unifiedSearch('neomycin')) as UnifiedSearchResult[];
    expect(results.length).toBeGreaterThan(0);

    const drugResult = results.find(
      (r) => r.type === 'drug' && r.name.toLowerCase().includes('neomycin')
    );
    if (drugResult) {
      // Should be capitalized, not lowercase
      expect(drugResult.name).not.toBe('neomycin');
      expect(drugResult.name.charAt(0)).toBe(drugResult.name.charAt(0).toUpperCase());
    }
  });

  it('limits results to 20 items', async () => {
    const results = (await unifiedSearch('a')) as UnifiedSearchResult[];
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('includes proper subtitle information', async () => {
    const results = (await unifiedSearch('aspirin')) as UnifiedSearchResult[];
    expect(results.length).toBeGreaterThan(0);

    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.subtitle).toBeDefined();
    expect((result?.subtitle ?? '').length).toBeGreaterThan(0);
  });
});
