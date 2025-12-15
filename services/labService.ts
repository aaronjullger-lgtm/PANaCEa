import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';

export interface LabTest {
  id: string;
  name: string;
  category: string;
  commonAbnormalities: string[];
  typicalUse?: string;
}

export interface LabCase {
  id: string;
  correctDiagnosis: string;
  clinicalVignette: string;
  labs: any; // Using any for the JSON structure for now
  createdAt: string;
  updatedAt: string;
}

class LabService {
  async getAllTests(): Promise<LabTest[]> {
    try {
      const response = await fetch('/api/labs/tests');
      if (!response.ok) throw new Error('Failed to fetch lab tests');
      return await response.json();
    } catch (error) {
      console.error('Error fetching lab tests:', error);
      return [];
    }
  }

  async getAllCases(): Promise<LabCase[]> {
    try {
      const response = await fetch('/api/labs/cases');
      if (!response.ok) throw new Error('Failed to fetch lab cases');
      return await response.json();
    } catch (error) {
      console.error('Error fetching lab cases:', error);
      return [];
    }
  }

  async getRandomCases(count: number = 1): Promise<LabCase[]> {
    try {
      const response = await fetch(`/api/labs/cases/random?count=${count}`);
      if (!response.ok) throw new Error('Failed to fetch random lab cases');
      return await response.json();
    } catch (error) {
      console.error('Error fetching random lab cases:', error);
      return [];
    }
  }
}

export const labService = new LabService();
