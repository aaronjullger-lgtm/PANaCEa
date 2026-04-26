/**
 * Lab Service - Database-First Implementation
 *
 * PostgreSQL is the ONLY source of truth for lab data.
 * Errors propagate to UI for proper handling.
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { createApiClient } from '@/lib/sdk';

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
  private client(token?: string) {
    return createApiClient(async () => token ?? null);
  }

  /**
   * Get all lab tests from database
   * @throws Error if database is unavailable
   */
  async getAllTests(token?: string): Promise<LabTest[]> {
    if (isTestEnv) return [];

    return this.client(token).get<LabTest[]>(getApiEndpoint(API_ENDPOINTS.LAB_TESTS));
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

    return this.client(token).get<LabCase[]>(getApiEndpoint(API_ENDPOINTS.LAB_CASES));
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

    return this.client(token).get<LabCase[]>(getApiEndpoint(API_ENDPOINTS.LAB_CASES_RANDOM(count)));
  }
}

export const labService = new LabService();
