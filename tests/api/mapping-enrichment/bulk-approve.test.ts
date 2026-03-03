import { describe, it, expect } from 'vitest';
import { onRequestPost } from '@/functions/api/mapping-enrichment/bulk-approve';

describe('POST /api/mapping-enrichment/bulk-approve', () => {
  it('should export onRequestPost function', () => {
    expect(typeof onRequestPost).toBe('function');
  });
});