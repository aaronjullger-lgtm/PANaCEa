/**
 * Drug Service - Database-First Implementation
 *
 * PostgreSQL is the ONLY source of truth for drug data.
 * No static fallbacks - errors propagate to UI for proper handling.
 *
 * Database contains 1000+ drugs with comprehensive clinical data.
 */

// Client-safe type definition (matches Prisma Drug model)
interface Drug {
  id: string;
  name: string;
  genericName?: string | null;
  brandNames?: string[];
  drugClass?: string | null;
  mechanism?: string | null;
  indications?: string[];
  contraindications?: string[];
  sideEffects?: string[];
  interactions?: string[];
  dosing?: string | null;
  monitoring?: string[];
  blackBoxWarning?: string | null;
  pregnancyCategory?: string | null;
  clinicalPearl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type DrugLibraryPayload = Drug[] | { drugs?: unknown[]; pagination?: unknown };

function unwrapApiData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const record = payload as { data?: unknown; success?: boolean; ok?: boolean };
    if (('success' in record || 'ok' in record) && 'data' in record) {
      return record.data as T;
    }
    if ('data' in record) {
      return record.data as T;
    }
  }
  return payload as T;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeDrug(value: unknown): Drug {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
  const brandNames = [
    ...stringArray(row.brandNames),
    ...(typeof row.brandName === 'string' && row.brandName.trim() ? [row.brandName] : []),
  ];

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? row.displayName ?? row.genericName ?? ''),
    genericName: row.genericName ?? row.name ?? null,
    brandNames,
    drugClass: Array.isArray(row.drugClass) ? row.drugClass[0] ?? null : row.drugClass ?? null,
    mechanism: row.mechanism ?? row.mechanismOfAction ?? null,
    indications: stringArray(row.indications),
    contraindications: stringArray(row.contraindications),
    sideEffects: stringArray(row.sideEffects),
    interactions: stringArray(row.interactions),
    dosing: row.dosing ?? null,
    monitoring: stringArray(row.monitoring ?? row.monitoringParams),
    blackBoxWarning: Array.isArray(row.blackBoxWarnings)
      ? row.blackBoxWarnings.join('; ') || null
      : row.blackBoxWarning ?? null,
    pregnancyCategory: row.pregnancyCategory ?? null,
    clinicalPearl: Array.isArray(row.clinicalPearls)
      ? row.clinicalPearls[0] ?? null
      : row.clinicalPearl ?? row.clinicalNotes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeDrugList(payload: unknown): Drug[] {
  const unwrapped = unwrapApiData<DrugLibraryPayload>(payload);
  const rows = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray((unwrapped as { drugs?: unknown[] })?.drugs)
      ? (unwrapped as { drugs: unknown[] }).drugs
      : [];
  return rows.map(normalizeDrug).filter((drug) => drug.id && drug.name);
}

export const drugService = {
  /**
   * Get all drugs from database
   * @throws Error if database is unavailable
   */
  getAll: async (limit?: number): Promise<Drug[]> => {
    // Ensure valid query params are always sent (fixes 400 validation error)
    const params = new URLSearchParams();
    if (limit) {
      params.set('limit', limit.toString());
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/drugs${query}`);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(errorData.error || `Failed to fetch drugs: ${response.status}`);
    }

    return normalizeDrugList(await response.json());
  },

  /**
   * Get random drugs from database
   * @throws Error if database is unavailable
   */
  getRandom: async (count: number = 10): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/random?count=${count}`);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(errorData.error || `Failed to fetch random drugs: ${response.status}`);
    }

    return normalizeDrugList(await response.json());
  },

  /**
   * Search drugs by query string
   * @throws Error if database is unavailable
   */
  search: async (query: string): Promise<Drug[]> => {
    const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(errorData.error || `Failed to search drugs: ${response.status}`);
    }

    return normalizeDrugList(await response.json());
  },
};
