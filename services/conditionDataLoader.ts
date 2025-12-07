/**
 * Condition Data Loader Service
 * 
 * Loads condition data from the conditionContent.correct.json file
 * and provides it in a format suitable for question generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONDITION_REGISTRY } from '../conditionRegistry';
import type { ConditionMeta } from '../conditionRegistry';

interface ConditionContentData {
  overview?: string;
  etiologyPathophysiology?: string;
  epidemiology?: string;
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  riskFactors?: string[];
  diagnostics?: {
    notes: string;
  };
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  basicScienceLinks?: Array<{
    title: string;
    conceptId: string;
  }>;
}

export interface LoadedConditionData {
  conditionId: string;
  name: string;
  system: string;
  subcategory: string;
  meta: ConditionMeta;
  content: ConditionContentData;
}

// Cache for loaded condition content
let conditionContentCache: Record<string, ConditionContentData> | null = null;

/**
 * Load the condition content JSON file
 */
function loadConditionContentFile(): Record<string, ConditionContentData> {
  if (conditionContentCache) {
    return conditionContentCache;
  }

  try {
    const contentPath = path.join(process.cwd(), 'conditionContent.correct.json');
    const contentRaw = fs.readFileSync(contentPath, 'utf-8');
    conditionContentCache = JSON.parse(contentRaw);
    return conditionContentCache!;
  } catch (error) {
    console.error('Error loading condition content file:', error);
    
    // Try backup file
    try {
      const backupPath = path.join(process.cwd(), 'conditionContent.backup.json');
      const backupRaw = fs.readFileSync(backupPath, 'utf-8');
      conditionContentCache = JSON.parse(backupRaw);
      return conditionContentCache!;
    } catch (backupError) {
      console.error('Error loading backup condition content file:', backupError);
      throw new Error('Failed to load condition content data');
    }
  }
}

/**
 * Find condition metadata by ID or name
 */
function findConditionMeta(conditionId: string): ConditionMeta | null {
  // Try to find in registry by matching the condition name
  const allConditions = [
    ...CONDITION_REGISTRY,
  ];

  // First try exact match on condition name
  let found = allConditions.find(c => 
    c.condition.toLowerCase() === conditionId.toLowerCase()
  );

  // If not found, try matching against aliases
  if (!found) {
    found = allConditions.find(c => 
      c.aliases?.some(alias => alias.toLowerCase() === conditionId.toLowerCase())
    );
  }

  return found || null;
}

/**
 * Load condition data by condition ID
 * 
 * @param conditionId - The condition identifier (e.g., "CV__ecg__sinus_tachycardia" or "Sinus Tachycardia")
 * @returns The loaded condition data or null if not found
 */
export async function loadConditionData(conditionId: string): Promise<LoadedConditionData | null> {
  try {
    const contentFile = loadConditionContentFile();
    
    // Try to find content by exact key match first
    let content = contentFile[conditionId];
    
    // If not found by exact key, try to construct key from name
    if (!content) {
      // Try to find by condition name in registry
      const meta = findConditionMeta(conditionId);
      if (meta) {
        // Construct key from meta
        const key = `${meta.system}__${meta.subcategory.toLowerCase().replace(/\s+/g, '_')}__${meta.condition.toLowerCase().replace(/\s+/g, '_')}`;
        content = contentFile[key];
        
        if (content) {
          return {
            conditionId: key,
            name: meta.condition,
            system: meta.system,
            subcategory: meta.subcategory,
            meta,
            content,
          };
        }
      }
      
      // If still not found, try case-insensitive search
      const lowerConditionId = conditionId.toLowerCase();
      const foundKey = Object.keys(contentFile).find(key => 
        key.toLowerCase().includes(lowerConditionId) ||
        lowerConditionId.includes(key.toLowerCase())
      );
      
      if (foundKey) {
        content = contentFile[foundKey];
        conditionId = foundKey;
      }
    }
    
    if (!content) {
      console.warn(`Condition data not found for: ${conditionId}`);
      return null;
    }
    
    // Extract system and name from condition ID key format: SYSTEM__subcategory__condition_name
    const parts = conditionId.split('__');
    const system = parts[0] || 'UNKNOWN';
    const subcategory = parts[1] || 'general';
    const namePart = parts.slice(2).join('__').replace(/_/g, ' ');
    
    // Get metadata from registry
    const meta = findConditionMeta(namePart) || {
      system: system as any,
      subcategory,
      condition: namePart,
    };
    
    return {
      conditionId,
      name: meta.condition,
      system: meta.system,
      subcategory: meta.subcategory,
      meta,
      content,
    };
  } catch (error) {
    console.error(`Error loading condition data for ${conditionId}:`, error);
    return null;
  }
}

/**
 * Get a list of all available condition IDs
 */
export function getAllConditionIds(): string[] {
  try {
    const contentFile = loadConditionContentFile();
    return Object.keys(contentFile);
  } catch (error) {
    console.error('Error getting condition IDs:', error);
    return [];
  }
}

/**
 * Get conditions by system
 */
export function getConditionsBySystem(system: string): string[] {
  try {
    const contentFile = loadConditionContentFile();
    return Object.keys(contentFile).filter(key => key.startsWith(system + '__'));
  } catch (error) {
    console.error(`Error getting conditions for system ${system}:`, error);
    return [];
  }
}

/**
 * Clear the condition content cache (useful for testing or hot reloading)
 */
export function clearConditionCache(): void {
  conditionContentCache = null;
}
