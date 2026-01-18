/**
 * Buzzword Service - Database-First Implementation
 *
 * PostgreSQL is the ONLY source of truth for buzzword data.
 * Errors propagate to UI for proper handling.
 */

interface BuzzwordEntry {
  id: string;
  word: string;
  buzzword?: string;  // Alias for word
  definition?: string;
  category?: string;
  conditionId?: string;
  condition?: string;  // Display name for the condition
}

let buzzwordCache: BuzzwordEntry[] | null = null;

export const buzzwordService = {
  /**
   * Fetch all buzzwords from the database API
   * @throws Error if database is unavailable
   */
  getAllBuzzwords: async (): Promise<BuzzwordEntry[]> => {
    if (buzzwordCache) return buzzwordCache;

    const response = await fetch('/api/buzzwords');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch buzzwords: ${response.status}`);
    }

    const data = await response.json();
    buzzwordCache = data;
    return data;
  },

  /**
   * Get a random set of buzzwords from database
   * @throws Error if database is unavailable
   */
  getRandomBuzzwords: async (count: number = 10): Promise<BuzzwordEntry[]> => {
    const response = await fetch(`/api/buzzwords/random?count=${count}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch random buzzwords: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Get a dictionary of buzzwords mapped to conditions
   * Useful for rapid lookup
   */
  getBuzzwordDictionary: async (): Promise<Record<string, string>> => {
    const buzzwords = await buzzwordService.getAllBuzzwords();
    const dict: Record<string, string> = {};
    buzzwords.forEach((b) => {
      dict[b.buzzword] = b.condition;
    });
    return dict;
  },

  /**
   * Get all unique conditions present in the buzzword bank
   */
  getAllBuzzwordConditions: async (): Promise<string[]> => {
    const buzzwords = await buzzwordService.getAllBuzzwords();
    return Array.from(new Set(buzzwords.map((b) => b.condition))).sort();
  },
};
