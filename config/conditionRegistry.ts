export interface ConditionRegistryEntry {
  id: string;
  condition: string;
  system: string;
  subcategory?: string;
  aliases?: string | string[];
  relatedSystems?: string[];
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
}

// Type alias for backwards compatibility
export type ConditionMeta = ConditionRegistryEntry;

// Minimal registry placeholder for test environments. Production content is loaded from the database.
const conditionRegistry: ConditionRegistryEntry[] = [];

export const CONDITION_REGISTRY = conditionRegistry;

// Stub functions for backwards compatibility with legacy scripts
export function buildConditionDefinition(id: string): ConditionRegistryEntry {
  return { id, condition: id, system: 'Unknown' };
}

export function findConditionMeta(id: string): ConditionRegistryEntry | undefined {
  return conditionRegistry.find(c => c.id === id);
}

export default conditionRegistry;
