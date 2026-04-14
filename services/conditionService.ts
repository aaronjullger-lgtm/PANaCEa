import type { ConditionMeta } from "@/types/conditions";

/**
 * API response shape from /api/conditions (inner data object)
 * The API returns conditions wrapped in { data: { conditions: [...] } }
 */
interface ConditionsApiResponseData {
  conditions: ConditionMeta[];
  bySystem: Record<string, ConditionMeta[]>;
  total: number;
  systems: string[];
}

/**
 * Full API response with data wrapper
 */
interface ConditionsApiResponse {
  data: ConditionsApiResponseData;
}

/**
 * Extract the conditions array from an API response
 * Handles multiple response formats:
 * - Direct arrays: [...]
 * - Wrapped with data: { data: { conditions: [...] } }
 * - Wrapped without data: { conditions: [...] }
 */
function extractConditionsArray(
  data: ConditionsApiResponse | ConditionsApiResponseData | ConditionMeta[] | unknown
): ConditionMeta[] {
  // If data is already an array, return it directly
  if (Array.isArray(data)) {
    return data;
  }

  // Handle null/undefined
  if (!data || typeof data !== 'object') {
    console.error('[conditionService] Invalid API response:', typeof data);
    return [];
  }

  const dataObj = data as Record<string, unknown>;

  // Handle nested wrapper: { data: { conditions: [...] } }
  if ('data' in dataObj && dataObj.data && typeof dataObj.data === 'object') {
    const innerData = dataObj.data as Record<string, unknown>;
    if ('conditions' in innerData && Array.isArray(innerData.conditions)) {
      return innerData.conditions as ConditionMeta[];
    }
  }

  // Handle direct wrapper: { conditions: [...] }
  if ('conditions' in dataObj && Array.isArray(dataObj.conditions)) {
    return dataObj.conditions as ConditionMeta[];
  }

  // Fallback: log warning and return empty array
  console.error(
    '[conditionService] Unexpected API response format:',
    typeof data,
    Object.keys(dataObj)
  );
  return [];
}

export async function getAllConditions(): Promise<ConditionMeta[]> {
  const response = await fetch('/api/conditions');
  if (!response.ok) {
    throw new Error(`Failed to fetch all conditions: ${response.statusText}`);
  }
  const data = await response.json();
  return extractConditionsArray(data);
}

export async function getConditionsBySystem(system: string): Promise<ConditionMeta[]> {
  const response = await fetch(`/api/conditions?system=${system}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch conditions for system ${system}: ${response.statusText}`);
  }
  const data = await response.json();
  return extractConditionsArray(data);
}

export async function getRandomConditions(
  count: number,
  exclude: string[] = []
): Promise<ConditionMeta[]> {
  // For now, we'll fetch all and then filter/randomize client-side.
  // A future API enhancement could add query parameters for random selection and exclusion.
  const allConditions = await getAllConditions();

  // Ensure we have an array to work with
  if (!Array.isArray(allConditions)) {
    console.error('[conditionService] getAllConditions did not return an array');
    return [];
  }

  const filteredConditions = allConditions.filter(
    (c) => c && c.condition && !exclude.includes(c.condition)
  );

  // Shuffle and take 'count' random conditions
  const shuffled = filteredConditions.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
