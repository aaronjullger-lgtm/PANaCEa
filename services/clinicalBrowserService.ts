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

export async function fetchClinicalBrowse(): Promise<ClinicalBrowsePayload> {
  const endpoint = getApiEndpoint('/api/clinical/browse');
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to load clinical browser data: ${res.status} ${body}`);
  }

  return res.json();
}
