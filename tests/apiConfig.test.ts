/**
 * API configuration tests
 * - KNOWLEDGE_CACHE_DELETE path builder
 * - buildApiUrl for knowledge endpoints
 */

import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS, getApiBaseUrl, buildApiUrl } from '@/lib/utils/apiConfig';

describe('apiConfig', () => {
  describe('KNOWLEDGE_CACHE_DELETE', () => {
    it('returns path with encoded cache name', () => {
      const name = 'cachedContents/abc123';
      const path = API_ENDPOINTS.KNOWLEDGE_CACHE_DELETE(name);
      expect(path).toBe('/api/knowledge/cache/cachedContents%2Fabc123');
    });

    it('encodes special characters in cache name', () => {
      const path = API_ENDPOINTS.KNOWLEDGE_CACHE_DELETE('cachedContents/foo/bar');
      expect(path).toContain('cachedContents');
      expect(path).toMatch(/\/api\/knowledge\/cache\//);
    });
  });

  describe('buildApiUrl', () => {
    it('builds URL for KNOWLEDGE_CACHES that ends with path', () => {
      const url = buildApiUrl(API_ENDPOINTS.KNOWLEDGE_CACHES);
      expect(url).toMatch(/\/api\/knowledge\/caches$/);
    });
  });

  describe('delete URL construction', () => {
    it('getApiBaseUrl + KNOWLEDGE_CACHE_DELETE(name) produces valid full URL', () => {
      const name = 'cachedContents/xyz';
      const url = getApiBaseUrl() + API_ENDPOINTS.KNOWLEDGE_CACHE_DELETE(name);
      expect(url).toMatch(/\/api\/knowledge\/cache\/cachedContents%2Fxyz$/);
    });
  });
});
