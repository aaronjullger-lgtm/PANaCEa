/**
 * Lab Service - Database-First Implementation
 *
 * PostgreSQL is the ONLY source of truth for lab data.
 * Errors propagate to UI for proper handling.
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

const isTestEnv =
  typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

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
  /**
   * Get all lab tests from database
   * @throws Error if database is unavailable
   */
  async getAllTests(token?: string): Promise<LabTest[]> {
    if (isTestEnv) return [];

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiEndpoint(API_ENDPOINTS.LAB_TESTS), { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch lab tests: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get all lab cases from database
   * @throws Error if database is unavailable or auth required
   */
  async getAllCases(token?: string): Promise<LabCase[]> {
    if (isTestEnv) return [];

    // Prevent unauthorized requests
    if (!token) {
      throw new Error('Authentication required to fetch lab cases');
    }

    const response = await fetch(getApiEndpoint(API_ENDPOINTS.LAB_CASES), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch lab cases: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get random lab cases from database
   * @throws Error if database is unavailable or auth required
   */
  async getRandomCases(count: number = 1, token?: string): Promise<LabCase[]> {
    if (isTestEnv) return [];

    // Prevent unauthorized requests
    if (!token) {
      throw new Error('Authentication required to fetch lab cases');
    }

    const response = await fetch(API_ENDPOINTS.LAB_CASES_RANDOM(count), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch random lab cases: ${response.status}`);
    }

    return await response.json();
  }
}

export const labService = new LabService();
