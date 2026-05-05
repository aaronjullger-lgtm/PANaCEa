/**
 * Condition Loader for Cloudflare Pages Functions
 *
 * Loads medical condition data from the database for question generation.
 * Following the database-first principle from .clinerules.
 */

// Edge-safe type definition - does NOT import PrismaClient to avoid bundler initialization
// This prevents Cloudflare Pages from attempting to initialize PrismaClient at module level
// The prisma parameter accepts any object with the required database methods
type PrismaLike = {
  medicalContent: {
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    count: (args?: any) => Promise<number>;
  };
};

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
  conditionId?: string | null;
  name: string;
  system: string;
  subcategory?: string | null;
  content: ConditionContent;
}

type MedicalContentConditionRow = {
  id: string;
  conditionId?: string | null;
  condition: string;
  system: string;
  subcategory?: string | null;
  content?: unknown;
};

const MEDICAL_CONTENT_CONDITION_SELECT = {
  id: true,
  conditionId: true,
  condition: true,
  system: true,
  subcategory: true,
  content: true,
} as const;

const PRODUCTION_MEDICAL_CONTENT_STATUS = ['published', 'approved'];

function productionMedicalContentWhere(extra: Record<string, unknown> = {}) {
  return {
    status: { in: PRODUCTION_MEDICAL_CONTENT_STATUS },
    ...extra,
  };
}

function parseConditionContent(content: unknown): ConditionContent {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content) as ConditionContent;
    } catch {
      return {};
    }
  }

  if (content && typeof content === 'object') {
    return content as ConditionContent;
  }

  return {};
}

function toConditionData(condition: MedicalContentConditionRow): ConditionData {
  return {
    id: condition.id,
    conditionId: condition.conditionId,
    name: condition.condition,
    system: condition.system,
    subcategory: condition.subcategory,
    content: parseConditionContent(condition.content),
  };
}

/**
 * Load condition data from the database by name or partial match
 *
 * @param prisma - Prisma client instance (accepts PrismaLike interface)
 * @param queryText - Condition name or search query
 * @returns ConditionData or null if not found
 */
export async function loadConditionData(
  prisma: PrismaLike,
  queryText: string
): Promise<ConditionData | null> {
  try {
    // First try exact match
    let condition = await prisma.medicalContent.findFirst({
      where: productionMedicalContentWhere({
        condition: {
          equals: queryText,
          mode: 'insensitive',
        },
      }),
      select: MEDICAL_CONTENT_CONDITION_SELECT,
    });

    // If not found, try partial match
    if (!condition) {
      condition = await prisma.medicalContent.findFirst({
        where: productionMedicalContentWhere({
          condition: {
            contains: queryText,
            mode: 'insensitive',
          },
        }),
        select: MEDICAL_CONTENT_CONDITION_SELECT,
      });
    }

    // If still not found, search by buzzwords or clinical pearls
    if (!condition) {
      condition = await prisma.medicalContent.findFirst({
        where: productionMedicalContentWhere({
          OR: [
            { buzzwords: { has: queryText.toLowerCase() } },
            { clinicalPearl: { contains: queryText, mode: 'insensitive' } },
          ],
        }),
        select: MEDICAL_CONTENT_CONDITION_SELECT,
      });
    }

    if (!condition) {
      return null;
    }

    return toConditionData(condition);
  } catch (error) {
    console.error('Failed to load condition data:', error);
    return null;
  }
}

/**
 * Load multiple conditions by system for bulk generation
 *
 * @param prisma - Prisma client instance (accepts PrismaLike interface)
 * @param system - Organ system name
 * @param limit - Maximum number of conditions to return
 * @returns Array of ConditionData
 */
export async function loadConditionsBySystem(
  prisma: PrismaLike,
  system: string,
  limit: number = 10
): Promise<ConditionData[]> {
  try {
    const conditions = await prisma.medicalContent.findMany({
      where: productionMedicalContentWhere({
        system: {
          equals: system,
          mode: 'insensitive',
        },
      }),
      select: {
        ...MEDICAL_CONTENT_CONDITION_SELECT,
      },
      take: limit,
    });

    return conditions.map(toConditionData);
  } catch (error) {
    console.error('Failed to load conditions by system:', error);
    return [];
  }
}

/**
 * Load a random condition for random question generation
 *
 * @param prisma - Prisma client instance (accepts PrismaLike interface)
 * @param excludeIds - IDs to exclude (e.g., recently used)
 * @returns ConditionData or null
 */
export async function loadRandomCondition(
  prisma: PrismaLike,
  excludeIds: string[] = []
): Promise<ConditionData | null> {
  try {
    // Get total count
    const totalCount = await prisma.medicalContent.count({
      where: productionMedicalContentWhere(
        excludeIds.length > 0
          ? { id: { notIn: excludeIds } }
          : {}
      ),
    });

    if (totalCount === 0) {
      return null;
    }

    // Random offset
    const randomOffset = Math.floor(Math.random() * totalCount);

    const condition = await prisma.medicalContent.findFirst({
      where: productionMedicalContentWhere(
        excludeIds.length > 0
          ? { id: { notIn: excludeIds } }
          : {}
      ),
      skip: randomOffset,
      select: {
        ...MEDICAL_CONTENT_CONDITION_SELECT,
      },
    });

    if (!condition) {
      return null;
    }

    return toConditionData(condition);
  } catch (error) {
    console.error('Failed to load random condition:', error);
    return null;
  }
}
