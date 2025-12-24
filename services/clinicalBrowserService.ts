import { getApiEndpoint } from '@/lib/utils/apiConfig';

export interface ClinicalCondition {
  id: string;
  conditionId: string;
  name: string;
  subcategory: string;
  system: string;
  overview?: string | null;
  buzzwords?: string[];
}

export interface ClinicalCategory {
  name: string;
  conditions: ClinicalCondition[];
}

export interface ClinicalSystem {
  code: string;
  name: string;
  categories: ClinicalCategory[];
  drugs: Array<{
    id: string;
    genericName: string;
    drugClass: string[];
    indications: string[];
    sideEffects: string[];
    tags: string[];
    isHighYield: boolean;
  }>;
  physiology: Array<{
    id: string;
    name: string;
    category: string;
    description?: string | null;
    clinicalSignificance?: string | null;
  }>;
}

export interface ClinicalBrowsePayload {
  systems: ClinicalSystem[];
}

// Error types for better error handling
export class BackendUnavailableError extends Error {
  constructor(message = 'Backend server not available') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Get auth token from Clerk session
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Access the global Clerk instance directly
    const clerk = (window as any).__clerk_frontend_api || (window as any).Clerk;
    if (clerk?.session) {
      const token = await clerk.session.getToken();
      return token;
    }
    return null;
  } catch (e) {
    console.warn('[ClinicalBrowser] Failed to get auth token:', e);
    return null;
  }
}

export async function fetchClinicalBrowse(): Promise<ClinicalBrowsePayload> {
  const endpoint = getApiEndpoint('/api/clinical/browse');
  
  // Get auth token
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const res = await fetch(endpoint, {
      headers,
      credentials: 'include', // Include cookies for session auth
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new AuthenticationError('Please sign in to access clinical content');
      }
      if (res.status === 503 || res.status === 502) {
        throw new BackendUnavailableError('Clinical database is temporarily unavailable');
      }
      const body = await res.text();
      throw new Error(`Failed to load clinical browser data: ${res.status} ${body}`);
    }

    return res.json();
  } catch (error) {
    // Handle network errors (backend down)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new BackendUnavailableError('Unable to connect to server. Please ensure the backend is running.');
    }
    throw error;
  }
}
