/**
 * Condition Data Loader Service
 * 
 * Database-first architecture: Loads condition data exclusively from Supabase database.
 * No filesystem operations - all content retrieved via Prisma queries on published content.
 */

import type { ConditionMeta } from '../src/types/conditions';
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
 * Find condition metadata by ID or name from the database
 * Note: This is a server-side only function
 */
async function findConditionMeta(conditionId: string): Promise<ConditionMeta | null> {
  // Server-side only - use Prisma to query database
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.error('findConditionMeta should not be called in browser environment');
    return null;
  }

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Search by name in Condition table
    const condition = await prisma.condition.findFirst({
      where: {
        OR: [
          { name: { equals: conditionId, mode: 'insensitive' } },
          { id: conditionId },
        ],
        status: 'published',
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
      },
    });

    await prisma.$disconnect();

    if (!condition) return null;

    // Convert to ConditionMeta format
    return {
      system: condition.system as SystemCode,
      subcategory: condition.subcategory,
      condition: condition.name,
      aliases: [],
    };
  } catch (error) {
    console.error('Error finding condition meta:', error);
    return null;
  }
}

/**
 * Load condition data by condition ID from database (RAG Retrieval).
 * This function is the single source of truth for condition data.
 * 
 * @param conditionId - The condition identifier (e.g., "CV__ecg__sinus_tachycardia" or "Sinus Tachycardia")
 * @returns The loaded condition data or null if not found
 */
export async function loadConditionData(conditionId: string): Promise<LoadedConditionData | null> {
  // This function is intended for server/edge usage.
  // In tests we run in jsdom, so allow calls when NODE_ENV === 'test'.
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.error('loadConditionData should not be called in browser environment');
    return null;
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured. Database connection is required.');
    return null;
  }

  const asNonEmptyString = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  };

  const asStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return items.length > 0 ? items : undefined;
  };

  try {
    // Dynamically import prisma to avoid bundling it in the browser
    const { prisma } = await import('../lib/prisma');
    
    // Try direct conditionId match first, then condition name (case-insensitive)
    let record = await prisma.medicalContent.findFirst({
      where: {
        conditionId,
        status: 'published',
      },
    });

    if (!record) {
      record = await prisma.medicalContent.findFirst({
        where: {
          condition: { equals: conditionId, mode: 'insensitive' },
          status: 'published',
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

    const meta: ConditionMeta = (await findConditionMeta(record.condition)) || {
      system: safeSystem,
      subcategory: record.subcategory,
      condition: record.condition,
      relatedSystems, // Include for multi-system condition support
    };

    const jsonContent = record.content && typeof record.content === 'object' ? (record.content as any) : undefined;

    const etiology = asNonEmptyString(record.etiology) ?? asNonEmptyString(jsonContent?.etiology);
    const pathophysiology = asNonEmptyString(record.pathophysiology) ?? asNonEmptyString(jsonContent?.pathophysiology);

    const content: ConditionContentData = {
      overview: asNonEmptyString(record.overview) ?? asNonEmptyString(jsonContent?.overview),
      etiologyPathophysiology: asNonEmptyString(jsonContent?.etiologyPathophysiology) ??
        ([
          etiology ? `**Etiology**\n\n${etiology}` : null,
          pathophysiology ? `**Pathophysiology**\n\n${pathophysiology}` : null,
        ]
          .filter(Boolean)
          .join('\n\n') || undefined),
      epidemiology: asNonEmptyString(record.epidemiology) ?? asNonEmptyString(jsonContent?.epidemiology),
      clinicalPresentation: asNonEmptyString(jsonContent?.clinicalPresentation),
      symptoms: asStringArray((record as any).symptoms) ?? asStringArray(jsonContent?.symptoms),
      examFindings: asStringArray((record as any).physicalExam) ?? asStringArray(jsonContent?.examFindings) ?? asStringArray(jsonContent?.physicalExam),
      riskFactors: asStringArray((record as any).riskFactors) ?? asStringArray(jsonContent?.riskFactors),
      diagnostics:
        (record.diagnostics && typeof record.diagnostics === 'object' ? (record.diagnostics as any) : undefined) ??
        (jsonContent?.diagnostics && typeof jsonContent.diagnostics === 'object' ? (jsonContent.diagnostics as any) : undefined),
      treatment:
        (Array.isArray(record.treatment) ? (record.treatment as unknown as string[]) : undefined) ??
        asStringArray(jsonContent?.treatment) ??
        asStringArray(jsonContent?.management),
      management: asStringArray(jsonContent?.management),
      prognosis: asNonEmptyString(record.prognosis) ?? asNonEmptyString(jsonContent?.prognosis),
      complications: asStringArray((record as any).complications) ?? asStringArray(jsonContent?.complications),
      basicScienceLinks: Array.isArray(jsonContent?.basicScienceLinks) ? jsonContent.basicScienceLinks : undefined,
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
    const { prisma } = await import('../lib/prisma');
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
    const { prisma } = await import('../lib/prisma');
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
