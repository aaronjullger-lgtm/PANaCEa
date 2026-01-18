import type { ConditionMeta } from '@/src/types/conditions';

/**
 * API response shape from /api/conditions
 * The API returns conditions wrapped in an object with additional metadata
 */
interface ConditionsApiResponse {
  conditions: ConditionMeta[];
  bySystem: Record<string, ConditionMeta[]>;
  total: number;
  systems: string[];
}

/**
 * Extract the conditions array from an API response
 * Handles both wrapped responses { conditions: [...] } and direct arrays [...]
 */
function extractConditionsArray(data: ConditionsApiResponse | ConditionMeta[]): ConditionMeta[] {
  // If data is already an array, return it directly
  if (Array.isArray(data)) {
    return data;
  }

  // If data is wrapped in { conditions: [...] }, extract the array
  if (data && typeof data === 'object' && 'conditions' in data && Array.isArray(data.conditions)) {
    return data.conditions;
  }

  // Fallback: log warning and return empty array
  console.error('[conditionService] Unexpected API response format:', typeof data, data);
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
