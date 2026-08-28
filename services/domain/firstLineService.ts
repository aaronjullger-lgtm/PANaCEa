import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

// Client-safe type definition (matches Prisma FirstLineTreatment model)
interface FirstLineTreatment {
  id: string;
  conditionId?: string | null;
  condition?: string | null;
  category?: string | null;
  treatment?: string | null;
  alternatives?: string[];
  notes?: string | null;
  source?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const firstLineService = {
  getAll: async (category?: string): Promise<FirstLineTreatment[]> => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`/api/first-line${query}`);
    if (!response.ok) throw new Error('Failed to fetch first line treatments');
    const data = unwrapApiEnvelope<FirstLineTreatment[]>(await response.json());
    if (!Array.isArray(data)) {
      throw new Error('First line treatments response was not an array');
    }
    return data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await fetch('/api/first-line/categories');
    if (!response.ok) throw new Error('Failed to fetch categories');
    const data = unwrapApiEnvelope<string[]>(await response.json());
    if (!Array.isArray(data)) {
      throw new Error('First line categories response was not an array');
    }
    return data;
  },
};
