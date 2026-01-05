/**
 * Condition Registry Service - Database-driven condition management
 * 
 * Replaces static conditionRegistry imports with live database queries.
 * Used by drill modes and question generation services.
 */

import type { SystemCode } from '../types';

export interface ConditionMetadata {
  id: string;
  name: string;
  system: SystemCode;
  subcategory: string;
}

/**
 * Cache for conditions to avoid repeated API calls
 */
let conditionsCache: ConditionMetadata[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all conditions from the database
 */
export async function fetchConditions(forceRefresh = false): Promise<ConditionMetadata[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (!forceRefresh && conditionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return conditionsCache;
  }
  
  try {
    const response = await fetch('/api/conditions');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch conditions: ${response.status}`);
    }
    
    const data = await response.json();
    
    // API returns { conditions, bySystem, total, systems }
    // Extract the conditions array
    const rawConditions = Array.isArray(data) ? data : (data.conditions || []);
    
    // Filter out any conditions with missing required fields (id, name, system)
    // This prevents downstream crashes when code assumes these fields exist
    const conditions = rawConditions.filter((c: ConditionMetadata | null | undefined) => 
      c && 
      typeof c.id === 'string' && c.id &&
      typeof c.name === 'string' && c.name &&
      typeof c.system === 'string' && c.system
    );
    
    if (conditions.length < rawConditions.length) {
      console.warn(`Filtered out ${rawConditions.length - conditions.length} conditions with missing id/name/system fields`);
    }
    
    // Update cache
    conditionsCache = conditions;
    cacheTimestamp = now;
    
    return conditions;
  } catch (error) {
    console.error('Error fetching conditions:', error);
    
    // Return cached data if available, even if expired
    if (conditionsCache) {
      console.warn('Using stale cache due to fetch error');
      return conditionsCache;
    }
    
    throw error;
  }
}

/**
 * Get all unique systems from conditions
 */
export async function getAvailableSystems(): Promise<SystemCode[]> {
  const conditions = await fetchConditions();
  const systemSet = new Set<SystemCode>();
  
  // Only add valid system codes (skip null/undefined)
  conditions.forEach(c => {
    if (c?.system) {
      systemSet.add(c.system);
    }
  });
  
  return Array.from(systemSet).sort();
}

/**
 * Get conditions filtered by system
 */
export async function getConditionsBySystem(system: SystemCode): Promise<ConditionMetadata[]> {
  // Safety check: if system is null/undefined, return empty array
  if (!system) {
    console.warn('getConditionsBySystem called with null/undefined system');
    return [];
  }
  const conditions = await fetchConditions();
  // Use optional chaining for safety in case a condition has null system
  return conditions.filter(c => c?.system === system);
}

/**
 * Get a random condition for a specific system
 * Replaces the static getRandomConditionForSystem from conditionRegistry
 */
export async function getRandomConditionForSystem(system: SystemCode): Promise<ConditionMetadata | null> {
  // Safety check: if system is null/undefined, return null gracefully
  if (!system) {
    console.warn('getRandomConditionForSystem called with null/undefined system');
    return null;
  }
  const conditions = await getConditionsBySystem(system);
  
  if (conditions.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * conditions.length);
  return conditions[randomIndex];
}

/**
 * Get a random condition from all available conditions
 */
export async function getRandomCondition(): Promise<ConditionMetadata | null> {
  const conditions = await fetchConditions();
  
  if (conditions.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * conditions.length);
  return conditions[randomIndex];
}

/**
 * Find a condition by name (case-insensitive partial match)
 */
export async function findConditionByName(name: string): Promise<ConditionMetadata | null> {
  // Safety check: if name is null/undefined/empty, return null gracefully
  if (!name) {
    console.warn('findConditionByName called with null/undefined/empty name');
    return null;
  }
  const conditions = await fetchConditions();
  const searchTerm = name.toLowerCase();
  
  // Exact match first (with null safety for c.name)
  let match = conditions.find(c => c.name?.toLowerCase() === searchTerm);
  if (match) return match;
  
  // Partial match (with null safety for c.name)
  match = conditions.find(c => c.name?.toLowerCase().includes(searchTerm));
  return match || null;
}

/**
 * Find a condition by ID
 */
export async function findConditionById(id: string): Promise<ConditionMetadata | null> {
  const conditions = await fetchConditions();
  return conditions.find(c => c.id === id) || null;
}

/**
 * Get statistics about the condition registry
 */
export async function getRegistryStats(): Promise<{
  totalConditions: number;
  systemCounts: Record<SystemCode, number>;
  subcategoryCounts: Record<string, number>;
}> {
  const conditions = await fetchConditions();
  
  const systemCounts: Record<string, number> = {};
  const subcategoryCounts: Record<string, number> = {};
  
  conditions.forEach(c => {
    systemCounts[c.system] = (systemCounts[c.system] || 0) + 1;
    subcategoryCounts[c.subcategory] = (subcategoryCounts[c.subcategory] || 0) + 1;
  });
  
  return {
    totalConditions: conditions.length,
    systemCounts: systemCounts as Record<SystemCode, number>,
    subcategoryCounts,
  };
}

/**
 * Clear the cache (useful for testing or when data updates)
 */
export function clearConditionsCache(): void {
  conditionsCache = null;
  cacheTimestamp = 0;
}

/**
 * Prefetch conditions (useful for app initialization)
 */
export async function prefetchConditions(): Promise<void> {
  try {
    await fetchConditions();
    console.log('✓ Conditions prefetched and cached');
  } catch (error) {
    console.error('Failed to prefetch conditions:', error);
  }
}
