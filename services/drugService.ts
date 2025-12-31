/**
 * Drug Service - Database-First Implementation
 * 
 * PostgreSQL is the ONLY source of truth for drug data.
 * No static fallbacks - errors propagate to UI for proper handling.
 * 
 * Database contains 1000+ drugs with comprehensive clinical data.
 */

import { Drug } from '@prisma/client';

export const drugService = {
  /**
   * Get all drugs from database
   * @throws Error if database is unavailable
   */
  getAll: async (limit?: number): Promise<Drug[]> => {
    const query = limit ? `?limit=${limit}` : '';
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
  }
};