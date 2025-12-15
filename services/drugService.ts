import { Drug } from '@prisma/client';

export const drugService = {
  getAll: async (limit?: number): Promise<Drug[]> => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetch(`/api/drugs${query}`);
    if (!response.ok) throw new Error('Failed to fetch drugs');
    return response.json();
  },

  getRandom: async (count: number = 10): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/random?count=${count}`);
    if (!response.ok) throw new Error('Failed to fetch random drugs');
    return response.json();
  },
  
  search: async (query: string): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search drugs');
    return response.json();
  }
};
