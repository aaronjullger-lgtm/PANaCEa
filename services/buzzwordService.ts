import { BuzzwordEntry } from '../src/types';

let buzzwordCache: BuzzwordEntry[] | null = null;

export const buzzwordService = {
  /**
   * Fetch all buzzwords from the API
   */
  getAllBuzzwords: async (): Promise<BuzzwordEntry[]> => {
    if (buzzwordCache) return buzzwordCache;

    try {
      const response = await fetch('/api/buzzwords');
      
      // Check if response is OK and is JSON before parsing
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        buzzwordCache = data;
        return data;
      }
      
      console.warn('Buzzwords API unavailable');
    } catch (error) {
      console.warn('Error fetching buzzwords:', error);
    }
    return [];
  },

  /**
   * Get a random set of buzzwords
   */
  getRandomBuzzwords: async (count: number = 10): Promise<BuzzwordEntry[]> => {
    try {
      const response = await fetch(`/api/buzzwords/random?count=${count}`);
      
      // Check if response is OK and is JSON before parsing
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      
      console.warn('Random buzzwords API unavailable');
    } catch (error) {
      console.warn('Error fetching random buzzwords:', error);
    }
    return [];
  },

  /**
   * Get a dictionary of buzzwords mapped to conditions
   * Useful for rapid lookup
   */
  getBuzzwordDictionary: async (): Promise<Record<string, string>> => {
    const buzzwords = await buzzwordService.getAllBuzzwords();
    const dict: Record<string, string> = {};
    buzzwords.forEach(b => {
      dict[b.buzzword] = b.condition;
    });
    return dict;
  },

  /**
   * Get all unique conditions present in the buzzword bank
   */
  getAllBuzzwordConditions: async (): Promise<string[]> => {
    const buzzwords = await buzzwordService.getAllBuzzwords();
    return Array.from(new Set(buzzwords.map(b => b.condition))).sort();
  }
};
