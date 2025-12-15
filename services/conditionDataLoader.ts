/**
 * Condition Data Loader Service
 * 
 * Database-first architecture: Loads condition data exclusively from Supabase database.
 * No filesystem operations - all content retrieved via Prisma queries on published content.
 */

import { prisma } from '../lib/prisma';
import { CONDITION_REGISTRY } from '../conditionRegistry';
import type { ConditionMeta } from '../conditionRegistry';
import type { SystemCode } from '../types';

const VALID_SYSTEMS: SystemCode[] = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'ENDO', 'HEME', 'ID', 'RENAL', 'REPRO', 'DERM', 'GU', 'HEENT', 'PSYCH', 'PRO'];

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
  relatedSystems?: SystemCode[]; // Support for multi-system conditions
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
 * Load condition data by condition ID from database (RAG Retrieval).
 * This function is the single source of truth for condition data.
 * 
 * @param conditionId - The condition identifier (e.g., "CV__ecg__sinus_tachycardia" or "Sinus Tachycardia")
 * @returns The loaded condition data or null if not found
 */
export async function loadConditionData(conditionId: string): Promise<LoadedConditionData | null> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured. Database connection is required.');
    return null;
  }

  try {
    // Try direct conditionId match first (unique), then condition name (case-insensitive)
    let record = await prisma.medicalContent.findUnique({
      where: { 
        conditionId,
        status: 'published' // CRITICAL: Only retrieve approved, published content
      },
    });

    // If not found by conditionId, try by condition name (case-insensitive)
    if (!record) {
      record = await prisma.medicalContent.findFirst({
        where: { 
          condition: { equals: conditionId, mode: 'insensitive' },
          status: 'published'
        },
      });
    }

    if (!record) {
      console.warn(`Published content not found in DB for ID: ${conditionId}`);
      return null;
    }

    const safeSystem = VALID_SYSTEMS.includes(record.system as SystemCode)
      ? (record.system as SystemCode)
      : ('PRO' as SystemCode);

    // Extract relatedSystems from database record
    const relatedSystems = Array.isArray(record.relatedSystems)
      ? (record.relatedSystems as string[])
          .filter((sys): sys is SystemCode => VALID_SYSTEMS.includes(sys as SystemCode))
      : [];

    const meta: ConditionMeta = findConditionMeta(record.condition) || {
      system: safeSystem,
      subcategory: record.subcategory,
      condition: record.condition,
      relatedSystems, // Include for multi-system condition support
    };

    const content: ConditionContentData = {
      overview: record.overview || undefined,
      etiologyPathophysiology: [
        record.etiology ? `**Etiology**\n\n${record.etiology}` : null,
        record.pathophysiology ? `**Pathophysiology**\n\n${record.pathophysiology}` : null
      ].filter(Boolean).join('\n\n') || undefined,
      epidemiology: record.epidemiology || undefined,
      symptoms: record.symptoms.length > 0 ? record.symptoms : undefined,
      examFindings: record.physicalExam.length > 0 ? record.physicalExam : undefined,
      riskFactors: record.riskFactors.length > 0 ? record.riskFactors : undefined,
      diagnostics: record.diagnostics && typeof record.diagnostics === 'object' ? (record.diagnostics as any) : undefined,
      treatment: record.treatment && Array.isArray(record.treatment) ? (record.treatment as string[]) : undefined,
      prognosis: record.prognosis || undefined,
      complications: record.complications.length > 0 ? record.complications : undefined,
      // Map other fields if necessary
    };

    return {
      conditionId: record.conditionId,
      name: meta.condition,
      system: meta.system,
      subcategory: meta.subcategory,
      meta,
      content,
      relatedSystems,
    };
  } catch (error) {
    console.error(`Error loading condition data for ${conditionId} from DB:`, error);
    return null;
  }
}

/**
 * Get all available condition IDs from the published content pool.
 * Database-only implementation.
 * 
 * NOTE: This function is async and requires database connection.
 */
export async function getAllConditionIds(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured. Database connection is required.');
    return [];
  }

  try {
    const publishedIds = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: { conditionId: true },
    });
    return publishedIds.map(c => c.conditionId);
  } catch (error) {
    console.error('Error getting condition IDs from DB:', error);
    return [];
  }
}

/**
 * Get conditions by system (using the Tags + Contextual Prompting logic).
 * Searches both primary system and relatedSystems fields for multi-system conditions.
 * Database-only implementation.
 * 
 * NOTE: This function is async and requires database connection.
 */
export async function getConditionsBySystem(system: string): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured. Database connection is required.');
    return [];
  }

  try {
    // This query finds conditions that are EITHER primarily in the system OR tagged as related
    const conditionRecords = await prisma.medicalContent.findMany({
      where: {
        status: 'published',
        OR: [
          { system: system }, // Primary system match
          { relatedSystems: { has: system } } // Tagged system match (e.g., finding Sarcoidosis in the 'DERM' list)
        ]
      },
      select: { conditionId: true }
    });
    
    return conditionRecords.map(c => c.conditionId);
  } catch (error) {
    console.error(`Error getting conditions for system ${system} from DB:`, error);
    return [];
  }
}

/**
 * Clear the condition content cache (no longer needed in database-only mode, kept for API compatibility)
 * @deprecated This function is a no-op in database-only mode
 */
export function clearConditionCache(): void {
  // No-op: Database queries don't use in-memory caches
  console.warn('clearConditionCache() is deprecated and has no effect in database-only mode');
}
