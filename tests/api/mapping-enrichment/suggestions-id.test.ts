import { describe, it, expect } from 'vitest';
import { onRequestPut } from '@/functions/api/mapping-enrichment/suggestions/[id]';

describe('PUT /api/mapping-enrichment/suggestions/:id', () => {
  it('should export onRequestPut function', () => {
    expect(typeof onRequestPut).toBe('function');
  });
});