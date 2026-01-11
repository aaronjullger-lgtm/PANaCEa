import type { FirstLineTreatment } from '@prisma/client';

export const firstLineService = {
  getAll: async (category?: string): Promise<FirstLineTreatment[]> => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`/api/first-line${query}`);
    if (!response.ok) throw new Error('Failed to fetch first line treatments');
    return response.json();
  },

  getCategories: async (): Promise<string[]> => {
    const response = await fetch('/api/first-line/categories');
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  }
};
