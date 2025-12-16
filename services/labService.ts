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
      
      // Check if response is OK and is JSON before parsing
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      
      console.warn('Lab tests API unavailable');
    } catch (error) {
      console.warn('Error fetching lab tests:', error);
    }
    return [];
  }

  async getAllCases(): Promise<LabCase[]> {
    try {
      const response = await fetch('/api/labs/cases');
      
      // Check if response is OK and is JSON before parsing
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      
      console.warn('Lab cases API unavailable');
    } catch (error) {
      console.warn('Error fetching lab cases:', error);
    }
    return [];
  }

  async getRandomCases(count: number = 1): Promise<LabCase[]> {
    try {
      const response = await fetch(`/api/labs/cases/random?count=${count}`);
      
      // Check if response is OK and is JSON before parsing
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      
      console.warn('Random lab cases API unavailable');
    } catch (error) {
      console.warn('Error fetching random lab cases:', error);
    }
    return [];
  }
}

export const labService = new LabService();
