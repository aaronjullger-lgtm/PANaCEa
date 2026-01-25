/**
 * Drug Service - Database-First Implementation
 *
 * PostgreSQL is the ONLY source of truth for drug data.
 * No static fallbacks - errors propagate to UI for proper handling.
 *
 * Database contains 1000+ drugs with comprehensive clinical data.
 */

// Client-safe type definition (matches Prisma Drug model)
interface Drug {
  id: string;
  name: string;
  genericName?: string | null;
  brandNames?: string[];
  drugClass?: string | null;
  mechanism?: string | null;
  indications?: string[];
  contraindications?: string[];
  sideEffects?: string[];
  interactions?: string[];
  dosing?: string | null;
  monitoring?: string[];
  blackBoxWarning?: string | null;
  pregnancyCategory?: string | null;
  clinicalPearl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const drugService = {
  /**
   * Get all drugs from database
   * @throws Error if database is unavailable
   */
  getAll: async (limit?: number): Promise<Drug[]> => {
    // Ensure valid query params are always sent (fixes 400 validation error)
    const params = new URLSearchParams();
    if (limit) {
      params.set('limit', limit.toString());
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/drugs${query}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch drugs: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Get random drugs from database
   * @throws Error if database is unavailable
   */
  getRandom: async (count: number = 10): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/random?count=${count}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch random drugs: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Search drugs by query string
   * @throws Error if database is unavailable
   */
  search: async (query: string): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to search drugs: ${response.status}`);
    }

    return await response.json();
  },
};
