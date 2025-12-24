import type { SystemCode } from "../../types.ts";

export interface ConditionSearchFilters {
  system?: SystemCode;
  subcategory?: string;
  limit?: number;
}

export interface ConditionSearchResult {
  id: string;
  condition: string;
  system: SystemCode;
  subcategory: string;
  aliases: string[];
  score: number;
}

/**
 * Search conditions via API endpoint
 * Uses database-backed search with fuzzy matching
 */
export async function searchConditions(
  rawQuery: string,
  filters: ConditionSearchFilters = {}
): Promise<ConditionSearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  try {
    // Build query params
    const params = new URLSearchParams({
      q: query,
    });

    if (filters.system) {
      params.append('system', filters.system);
    }

    if (filters.subcategory) {
      params.append('subcategory', filters.subcategory);
    }

    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    // Call search API endpoint
    const response = await fetch(`/api/conditions/search?${params.toString()}`);

    if (!response.ok) {
      console.error('Search API error:', response.status, response.statusText);
      return [];
    }

    const results: ConditionSearchResult[] = await response.json();
    return results;

  } catch (error) {
    console.error('Error searching conditions:', error);
    return [];
  }
}

/**
 * Get all available system codes from the database
 */
export async function getSystemOptions(): Promise<SystemCode[]> {
  try {
    const response = await fetch('/api/conditions?includeContent=false');
    if (!response.ok) {
      console.error('Failed to fetch systems');
      return [];
    }

    const conditions = await response.json();
    const systems = new Set<SystemCode>();
    conditions.forEach((c: any) => {
      if (c.system) systems.add(c.system as SystemCode);
    });

    return Array.from(systems).sort();
  } catch (error) {
    console.error('Error fetching system options:', error);
    return [];
  }
}

/**
 * Get all subcategories for a given system
 */
export async function getSubcategoryOptions(system?: SystemCode): Promise<string[]> {
  try {
    const url = system 
      ? `/api/conditions?system=${system}&includeContent=false`
      : '/api/conditions?includeContent=false';
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch subcategories');
      return [];
    }

    const conditions = await response.json();
    const subcategories = new Set<string>();
    conditions.forEach((c: any) => {
      if (c.subcategory) subcategories.add(c.subcategory);
    });

    return Array.from(subcategories).sort();
  } catch (error) {
    console.error('Error fetching subcategory options:', error);
    return [];
  }
}

/**
 * Find a condition by its ID
 */
export async function findConditionMetaById(id: string): Promise<any | undefined> {
  try {
    const response = await fetch(`/api/conditions/${id}`);
    if (!response.ok) {
      return undefined;
    }

    const condition = await response.json();
    return condition;
  } catch (error) {
    console.error('Error finding condition by ID:', error);
    return undefined;
  }
}
