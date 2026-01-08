import type { ConditionMeta } from '@/src/types/conditions';

export async function getAllConditions(): Promise<ConditionMeta[]> {
  const response = await fetch('/api/conditions');
  if (!response.ok) {
    throw new Error(`Failed to fetch all conditions: ${response.statusText}`);
  }
  return response.json();
}

export async function getConditionsBySystem(system: string): Promise<ConditionMeta[]> {
  const response = await fetch(`/api/conditions?system=${system}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch conditions for system ${system}: ${response.statusText}`);
  }
  return response.json();
}

export async function getRandomConditions(count: number, exclude: string[] = []): Promise<ConditionMeta[]> {
  // For now, we'll fetch all and then filter/randomize client-side.
  // A future API enhancement could add query parameters for random selection and exclusion.
  const allConditions = await getAllConditions();
  const filteredConditions = allConditions.filter(c => !exclude.includes(c.condition));
  
  // Shuffle and take 'count' random conditions
  const shuffled = filteredConditions.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
