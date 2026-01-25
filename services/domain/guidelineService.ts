import type { Guideline } from '@/types/guidelines';

let guidelineCache: Guideline[] | null = null;

export const guidelineService = {
  /**
   * Fetch all guidelines from the API
   */
  getAllGuidelines: async (): Promise<Guideline[]> => {
    if (guidelineCache) return guidelineCache;

    try {
      const response = await fetch('/api/reference/guidelines');
      if (!response.ok) throw new Error('Failed to fetch guidelines');

      const data = await response.json();
      guidelineCache = data;
      return data;
    } catch (error) {
      console.error('Error fetching guidelines:', error);
      return [];
    }
  },

  /**
   * Get a specific guideline by ID
   */
  getGuidelineById: async (id: string): Promise<Guideline | null> => {
    // Check cache first
    if (guidelineCache) {
      return guidelineCache.find((g) => g.id === id) || null;
    }

    try {
      const response = await fetch(`/api/reference/guidelines/${id}`);
      if (!response.ok) throw new Error('Failed to fetch guideline');
      return await response.json();
    } catch (error) {
      console.error(`Error fetching guideline ${id}:`, error);
      return null;
    }
  },
};
