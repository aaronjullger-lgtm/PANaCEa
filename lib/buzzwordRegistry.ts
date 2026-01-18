import { getApiEndpoint, API_ENDPOINTS } from './utils/apiConfig';

export interface BuzzwordEntry {
  buzzword: string;
  category: string;
}

let buzzwordCache: Record<string, BuzzwordEntry> | null = null;
let loadPromise: Promise<Record<string, BuzzwordEntry>> | null = null;

export async function loadBuzzwords(): Promise<Record<string, BuzzwordEntry>> {
  if (buzzwordCache) return buzzwordCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const apiUrl = getApiEndpoint(API_ENDPOINTS.BUZZWORDS_ALL);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch buzzwords: ${response.status}`);
        return {};
      }

      const data = await response.json();

      const cache: Record<string, BuzzwordEntry> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          cache[item.condition] = {
            buzzword: item.buzzword,
            category: item.system,
          };
        });
      }

      buzzwordCache = cache;
      return cache;
    } catch (error) {
      console.error('Error loading buzzwords:', error);
      return {};
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

// Synchronous getter - requires loadBuzzwords to have been called and finished
export const getBuzzword = (conditionName: string): BuzzwordEntry | null => {
  if (!buzzwordCache || !conditionName) return null;

  // 1. Exact match
  if (buzzwordCache[conditionName]) return buzzwordCache[conditionName];

  // 2. Partial match (case insensitive)
  const lowerName = conditionName.toLowerCase();
  const key = Object.keys(buzzwordCache).find(
    (k) => lowerName.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerName)
  );

  return key ? buzzwordCache[key] : null;
};

// Deprecated static registry for backward compatibility
export const BUZZWORD_REGISTRY: Record<string, BuzzwordEntry> = {};
