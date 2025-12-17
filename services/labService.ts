import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';

const isTestEnv = typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

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
    if (isTestEnv) return [];
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.LABS_TESTS));
      
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
    if (isTestEnv) return [];
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.LABS_CASES));
      
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
    if (isTestEnv) return [];
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.LABS_CASES_RANDOM(count)));
      
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
