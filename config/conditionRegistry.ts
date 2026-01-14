export interface ConditionRegistryEntry {
  id: string;
  relatedSystems?: string[];
}

// Minimal registry placeholder for test environments. Production content is loaded from the database.
const conditionRegistry: ConditionRegistryEntry[] = [];

export default conditionRegistry;
