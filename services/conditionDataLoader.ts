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
import type { SystemCode } from '../types';

const VALID_SYSTEMS: SystemCode[] = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'ENDO', 'HEME', 'ID', 'RENAL', 'REPRO', 'DERM', 'GU', 'HEENT', 'PSYCH', 'PRO'];
const CONTENT_FILE = 'conditionContent.final.json';

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
  relatedSystems?: SystemCode[]; // NEW: Support for multi-system conditions
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
    const contentPath = path.join(process.cwd(), CONTENT_FILE);
    const contentRaw = fs.readFileSync(contentPath, 'utf-8');
    conditionContentCache = JSON.parse(contentRaw);
    return conditionContentCache!;
  } catch (error) {
    console.error('Error loading condition content file:', error);
    throw new Error('Failed to load condition content data');
  }
}

async function loadFromDatabase(conditionId: string): Promise<{
  conditionId: string;
  name: string;
  system: SystemCode;
  subcategory: string;
  content: ConditionContentData;
  relatedSystems?: SystemCode[]; // NEW: Include relatedSystems from database
} | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const { prisma } = await import('../lib/prisma');

    // Try direct conditionId match first (unique), then condition name (case-insensitive)
    let record =
      await prisma.medicalContent.findUnique({
        where: { conditionId, status: 'published' }, // Only fetch published content
      }) ??
      (await prisma.medicalContent.findFirst({
        where: { 
          condition: { equals: conditionId, mode: 'insensitive' },
          status: 'published' // Only fetch published content
        },
      }));

    if (!record) return null;

    const safeSystem = VALID_SYSTEMS.includes(record.system as SystemCode)
      ? (record.system as SystemCode)
      : ('PRO' as SystemCode);

    // Extract relatedSystems from database record
    const relatedSystems = Array.isArray(record.relatedSystems)
      ? (record.relatedSystems as string[])
          .filter((sys): sys is SystemCode => VALID_SYSTEMS.includes(sys as SystemCode))
      : [];

    const meta = findConditionMeta(record.condition) || {
      system: safeSystem,
      subcategory: record.subcategory,
      condition: record.condition,
      relatedSystems, // Include in meta
    };

    const content: ConditionContentData =
      record.content && typeof record.content === 'object'
        ? (record.content as ConditionContentData)
        : {};

    return {
      conditionId: record.conditionId,
      name: meta.condition,
      system: meta.system,
      subcategory: meta.subcategory,
      content,
      relatedSystems, // NEW: Return relatedSystems
    };
  } catch (error) {
    console.error('Error loading condition from database:', error);
    return null;
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
    // 1) Prefer database content (RAG-first approach)
    const dbResult = await loadFromDatabase(conditionId);
    if (dbResult) {
      const meta =
        findConditionMeta(dbResult.name) || findConditionMeta(conditionId) || {
          system: dbResult.system,
          subcategory: dbResult.subcategory,
          condition: dbResult.name,
          relatedSystems: dbResult.relatedSystems, // Include relatedSystems in meta
        };

      return {
        conditionId: dbResult.conditionId,
        name: meta.condition,
        system: meta.system,
        subcategory: meta.subcategory,
        meta,
        content: dbResult.content,
        relatedSystems: dbResult.relatedSystems, // NEW: Include relatedSystems
      };
    }

    // 2) Fallback to static file (backward compatibility)
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
    const systemCode = VALID_SYSTEMS.includes(system as SystemCode) ? system as SystemCode : 'PRO' as SystemCode;
    
    const meta = findConditionMeta(namePart) || {
      system: systemCode,
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
 * Prioritizes database, falls back to JSON file
 */
export async function getAllConditionIds(): Promise<string[]> {
  // Try database first if available
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('../lib/prisma');
      const publishedIds = await prisma.medicalContent.findMany({
        where: { status: 'published' },
        select: { conditionId: true },
      });
      return publishedIds.map(c => c.conditionId);
    } catch (error) {
      console.error('Error getting condition IDs from database:', error);
      // Fall through to file-based approach
    }
  }
  
  // Fallback to file-based retrieval
  try {
    const contentFile = loadConditionContentFile();
    return Object.keys(contentFile);
  } catch (error) {
    console.error('Error getting condition IDs:', error);
    return [];
  }
}

/**
 * Get conditions by system (supports both primary and related systems)
 * When database is available, searches both system and relatedSystems fields
 */
export async function getConditionsBySystem(system: string): Promise<string[]> {
  // Try database first if available
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('../lib/prisma');
      
      // Query conditions where system matches OR relatedSystems includes the system
      const conditionRecords = await prisma.medicalContent.findMany({
        where: {
          status: 'published',
          OR: [
            { system: system }, // Primary system match
            { relatedSystems: { has: system } } // Related system match (multi-system conditions)
          ]
        },
        select: { conditionId: true }
      });
      
      return conditionRecords.map(c => c.conditionId);
    } catch (error) {
      console.error(`Error getting conditions for system ${system} from database:`, error);
      // Fall through to file-based approach
    }
  }
  
  // Fallback to file-based filtering
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
