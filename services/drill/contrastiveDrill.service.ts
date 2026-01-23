/**
 * Contrastive Drill Service
 * 
 * DDx Compare mode for distinguishing similar conditions.
 * Targets "Confusion Pairs" identified in user's review history.
 * 
 * @module services/drill/contrastiveDrill.service
 */

import { PrismaClient, ContrastiveSet, ContrastiveDrillAttempt } from '@prisma/client';

let prisma: PrismaClient;

if (typeof window === 'undefined') {
  prisma = new PrismaClient();
} else {
  throw new Error('Contrastive Drill Service must run server-side only');
}

export interface ContrastiveQuestion {
  id: string;
  condition1: {
    id: string;
    name: string;
  };
  condition2: {
    id: string;
    name: string;
  };
  symptom: string;
  distinguishers: DistinguisherFeature[];
  difficulty: string;
  system?: string;
}

export interface DistinguisherFeature {
  id: string;
  text: string;
  belongsTo: 1 | 2; // Which condition does this feature belong to?
  category?: 'symptom' | 'lab' | 'physical_exam' | 'history';
}

export interface ContrastiveDrillOptions {
  system?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
  targetConfusionPairs?: boolean; // Use user's actual confusion history
  userId?: string;
}

/**
 * Get a batch of contrastive drill questions
 * 
 * @param options - Filtering options
 * @returns Array of contrastive questions
 */
export async function getContrastiveDrillBatch(
  options: ContrastiveDrillOptions = {}
): Promise<ContrastiveQuestion[]> {
  const {
    system,
    difficulty = 'medium',
    count = 5,
    targetConfusionPairs = false,
    userId,
  } = options;

  try {
    let contrastiveSets: any[];

    if (targetConfusionPairs && userId) {
      // Get user's actual confusion pairs from history
      contrastiveSets = await getPersonalizedContrastiveSets(userId, count);
    } else {
      // Get general high-yield contrastive sets
      const whereClause: any = {
        isHighYield: true,
      };

      if (system) {
        whereClause.system = system;
      }

      if (difficulty) {
        whereClause.difficulty = difficulty;
      }

      contrastiveSets = await prisma.contrastiveSet.findMany({
        where: whereClause,
        take: count,
        include: {
          Condition1: {
            select: {
              id: true,
              name: true,
            },
          },
          Condition2: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    // Transform to ContrastiveQuestion format
    const questions: ContrastiveQuestion[] = contrastiveSets.map((set) => {
      const distinguishers = parseDistinguishers(set.distinguishers);

      return {
        id: set.id,
        condition1: {
          id: set.Condition1.id,
          name: set.Condition1.name,
        },
        condition2: {
          id: set.Condition2.id,
          name: set.Condition2.name,
        },
        symptom: set.symptom,
        distinguishers,
        difficulty: set.difficulty || 'medium',
        system: set.system || undefined,
      };
    });

    return questions;
  } catch (error) {
    console.error('Error fetching contrastive drill batch:', error);
    throw new Error('Failed to fetch contrastive drill questions');
  }
}

/**
 * Parse distinguishers from JSON format
 * 
 * @param distinguishersJson - Raw JSON from database
 * @returns Array of parsed distinguisher features
 */
function parseDistinguishers(distinguishersJson: any): DistinguisherFeature[] {
  try {
    if (!distinguishersJson) {
      return [];
    }

    // Expected format:
    // {
    //   "condition1": ["Feature A", "Feature B"],
    //   "condition2": ["Feature C", "Feature D"]
    // }
    const parsed = typeof distinguishersJson === 'string'
      ? JSON.parse(distinguishersJson)
      : distinguishersJson;

    const features: DistinguisherFeature[] = [];

    if (parsed.condition1 && Array.isArray(parsed.condition1)) {
      parsed.condition1.forEach((text: string, index: number) => {
        features.push({
          id: `c1-${index}`,
          text,
          belongsTo: 1,
        });
      });
    }

    if (parsed.condition2 && Array.isArray(parsed.condition2)) {
      parsed.condition2.forEach((text: string, index: number) => {
        features.push({
          id: `c2-${index}`,
          text,
          belongsTo: 2,
        });
      });
    }

    // Shuffle features for the drill
    return features.sort(() => 0.5 - Math.random());
  } catch (error) {
    console.error('Error parsing distinguishers:', error);
    return [];
  }
}

/**
 * Get personalized contrastive sets based on user's confusion history
 * 
 * @param userId - User ID
 * @param count - Number of sets to return
 * @returns Array of contrastive sets targeting user's weak areas
 */
async function getPersonalizedContrastiveSets(
  userId: string,
  count: number
): Promise<any[]> {
  try {
    // Find user's confusion pairs
    const confusionPairs = await prisma.confusionPair.findMany({
      where: {
        userId,
        occurrences: {
          gte: 2, // At least 2 confusions
        },
      },
      orderBy: {
        occurrences: 'desc',
      },
      take: count,
      include: {
        Condition1: {
          select: {
            id: true,
            name: true,
          },
        },
        Condition2: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Find or create contrastive sets for these pairs
    const sets = await Promise.all(
      confusionPairs.map(async (pair) => {
        // Look for existing contrastive set
        let set = await prisma.contrastiveSet.findFirst({
          where: {
            OR: [
              {
                condition1Id: pair.condition1Id,
                condition2Id: pair.condition2Id,
              },
              {
                condition1Id: pair.condition2Id,
                condition2Id: pair.condition1Id,
              },
            ],
          },
          include: {
            Condition1: {
              select: {
                id: true,
                name: true,
              },
            },
            Condition2: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // If no set exists, create a basic one
        if (!set) {
          set = await createBasicContrastiveSet(
            pair.condition1Id,
            pair.condition2Id
          );
        }

        return set;
      })
    );

    return sets.filter((s) => s !== null);
  } catch (error) {
    console.error('Error getting personalized contrastive sets:', error);
    return [];
  }
}

/**
 * Create a basic contrastive set for two conditions
 * (Fallback when no pre-defined set exists)
 * 
 * @param condition1Id - First condition ID
 * @param condition2Id - Second condition ID
 * @returns Created contrastive set
 */
async function createBasicContrastiveSet(
  condition1Id: string,
  condition2Id: string
): Promise<any | null> {
  try {
    // Fetch both conditions
    const [condition1, condition2] = await Promise.all([
      prisma.medicalContent.findUnique({
        where: { id: condition1Id },
        select: {
          id: true,
          name: true,
          system: true,
          symptoms: true,
        },
      }),
      prisma.medicalContent.findUnique({
        where: { id: condition2Id },
        select: {
          id: true,
          name: true,
          system: true,
          symptoms: true,
        },
      }),
    ]);

    if (!condition1 || !condition2) {
      return null;
    }

    // Create a basic distinguisher structure
    const distinguishers = {
      condition1: [
        `Classic presentation for ${condition1.name}`,
        'Key diagnostic feature',
      ],
      condition2: [
        `Classic presentation for ${condition2.name}`,
        'Key diagnostic feature',
      ],
    };

    const set = await prisma.contrastiveSet.create({
      data: {
        condition1Id,
        condition2Id,
        symptom: 'Similar presentation',
        distinguishers: distinguishers as any,
        isHighYield: false,
        difficulty: 'medium',
        system: condition1.system || condition2.system || undefined,
      },
      include: {
        Condition1: {
          select: {
            id: true,
            name: true,
          },
        },
        Condition2: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return set;
  } catch (error) {
    console.error('Error creating basic contrastive set:', error);
    return null;
  }
}

/**
 * Log a contrastive drill attempt
 * 
 * @param userId - User ID
 * @param setId - Contrastive set ID
 * @param userAssignments - User's assignments of features
 * @param isCorrect - Whether all assignments were correct
 * @param timeMs - Time taken in milliseconds
 */
export async function logContrastiveDrillAttempt(
  userId: string,
  setId: string,
  userAssignments: Record<string, 1 | 2>,
  isCorrect: boolean,
  timeMs: number
): Promise<void> {
  try {
    await prisma.contrastiveDrillAttempt.create({
      data: {
        userId,
        contrastiveSetId: setId,
        userAssignments: userAssignments as any,
        wasCorrect: isCorrect,
        responseTimeMs: timeMs,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error logging contrastive drill attempt:', error);
    throw new Error('Failed to log drill attempt');
  }
}

/**
 * Get contrastive drill statistics for a user
 * 
 * @param userId - User ID
 * @returns Drill statistics
 */
export async function getContrastiveDrillStats(userId: string) {
  try {
    const attempts = await prisma.contrastiveDrillAttempt.findMany({
      where: { userId },
      select: {
        wasCorrect: true,
        responseTimeMs: true,
        createdAt: true,
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.wasCorrect).length;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    const avgResponseTime =
      attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) / totalAttempts || 0;

    return {
      totalAttempts,
      correctAttempts,
      accuracy,
      avgResponseTime,
      lastAttempt: attempts[0]?.createdAt,
    };
  } catch (error) {
    console.error('Error fetching contrastive drill stats:', error);
    return {
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      avgResponseTime: 0,
      lastAttempt: null,
    };
  }
}

export async function disconnect() {
  await prisma.$disconnect();
}