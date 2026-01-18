/**
 * Condition Loader for Cloudflare Pages Functions
 *
 * Loads medical condition data from the database for question generation.
 * Following the database-first principle from .clinerules.
 */

import type { PrismaClient } from '@prisma/client';

export interface ConditionContent {
  overview?: string;
  etiologyPathophysiology?: string;
  clinicalPresentation?: string;
  diagnostics?: {
    notes?: string;
    labs?: string[];
    imaging?: string[];
  };
  treatment?: string[];
  management?: string[];
  clinicalPearl?: string;
  buzzwords?: string[];
  differentialDiagnosis?: string[];
}

export interface ConditionData {
  id: string;
  name: string;
  system: string;
  subcategory?: string | null;
  content: ConditionContent;
}

/**
 * Load condition data from the database by name or partial match
 *
 * @param prisma - Prisma client instance
 * @param queryText - Condition name or search query
 * @returns ConditionData or null if not found
 */
export async function loadConditionData(
  prisma: PrismaClient | any,
  queryText: string
): Promise<ConditionData | null> {
  try {
    // First try exact match
    let condition = await prisma.medicalContent.findFirst({
      where: {
        name: {
          equals: queryText,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        content: true,
      },
    });

    // If not found, try partial match
    if (!condition) {
      condition = await prisma.medicalContent.findFirst({
        where: {
          name: {
            contains: queryText,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
          system: true,
          subcategory: true,
          content: true,
        },
      });
    }

    // If still not found, search by buzzwords or clinical pearls
    if (!condition) {
      condition = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { buzzwords: { has: queryText.toLowerCase() } },
            { clinicalPearl: { contains: queryText, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          system: true,
          subcategory: true,
          content: true,
        },
      });
    }

    if (!condition) {
      return null;
    }

    // Parse content if it's a string (JSONB should auto-parse, but just in case)
    const content =
      typeof condition.content === 'string' ? JSON.parse(condition.content) : condition.content;

    return {
      id: condition.id,
      name: condition.name,
      system: condition.system,
      subcategory: condition.subcategory,
      content: content as ConditionContent,
    };
  } catch (error) {
    console.error('Failed to load condition data:', error);
    return null;
  }
}

/**
 * Load multiple conditions by system for bulk generation
 *
 * @param prisma - Prisma client instance
 * @param system - Organ system name
 * @param limit - Maximum number of conditions to return
 * @returns Array of ConditionData
 */
export async function loadConditionsBySystem(
  prisma: PrismaClient | any,
  system: string,
  limit: number = 10
): Promise<ConditionData[]> {
  try {
    const conditions = await prisma.medicalContent.findMany({
      where: {
        system: {
          equals: system,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        content: true,
      },
      take: limit,
    });

    return conditions.map((c: any) => ({
      id: c.id,
      name: c.name,
      system: c.system,
      subcategory: c.subcategory,
      content: typeof c.content === 'string' ? JSON.parse(c.content) : c.content,
    }));
  } catch (error) {
    console.error('Failed to load conditions by system:', error);
    return [];
  }
}

/**
 * Load a random condition for random question generation
 *
 * @param prisma - Prisma client instance
 * @param excludeIds - IDs to exclude (e.g., recently used)
 * @returns ConditionData or null
 */
export async function loadRandomCondition(
  prisma: PrismaClient | any,
  excludeIds: string[] = []
): Promise<ConditionData | null> {
  try {
    // Get total count
    const totalCount = await prisma.medicalContent.count({
      where:
        excludeIds.length > 0
          ? {
              id: { notIn: excludeIds },
            }
          : undefined,
    });

    if (totalCount === 0) {
      return null;
    }

    // Random offset
    const randomOffset = Math.floor(Math.random() * totalCount);

    const condition = await prisma.medicalContent.findFirst({
      where:
        excludeIds.length > 0
          ? {
              id: { notIn: excludeIds },
            }
          : undefined,
      skip: randomOffset,
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        content: true,
      },
    });

    if (!condition) {
      return null;
    }

    return {
      id: condition.id,
      name: condition.name,
      system: condition.system,
      subcategory: condition.subcategory,
      content:
        typeof condition.content === 'string' ? JSON.parse(condition.content) : condition.content,
    };
  } catch (error) {
    console.error('Failed to load random condition:', error);
    return null;
  }
}
