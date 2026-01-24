/**
 * Contrastive Drill Service
 * 
 * DDx Compare mode for distinguishing similar conditions.
 * Targets "Confusion Pairs" identified in user's review history.
 * 
 * CRITICAL SCHEMA NOTES:
 * - ContrastiveSet uses conditionIds: String[] (NOT FK relations)
 * - ConfusionPair uses count (NOT occurrences), realConditionId/mistakenForId
 * - MedicalContent has 'condition' field (NOT 'name')
 * - ContrastiveDrillAttempt has setId, correctAnswers, timeSpentMs
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
  conditions: Array<{
    id: string;
    name: string;
  }>;
  symptom: string;
  distinguishers: DistinguisherFeature[];
  difficulty: string;
  system?: string;
}

export interface DistinguisherFeature {
  id: string;
  text: string;
  belongsTo: number; // Which condition index does this feature belong to?
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
        highYield: true,
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
      });
    }

    // Transform to ContrastiveQuestion format
    // Manually fetch condition details since schema uses conditionIds array
    const questions: ContrastiveQuestion[] = await Promise.all(
      contrastiveSets.map(async (set) => {
        // Fetch all conditions for this set
        const conditions = await prisma.medicalContent.findMany({
          where: {
            id: {
              in: set.conditionIds,
            },
          },
          select: {
            id: true,
            condition: true, // NOT 'name'
          },
        });

        const distinguishers = parseDistinguishers(set.distinguishers, conditions.length);

        return {
          id: set.id,
          conditions: conditions.map((c) => ({
            id: c.id,
            name: c.condition, // Use 'condition' field from schema
          })),
          symptom: set.symptom,
          distinguishers,
          difficulty: set.difficulty || 'medium',
          system: set.system || undefined,
        };
      })
    );

    return questions;
  } catch (error) {
    console.error('Error fetching contrastive drill batch:', error);
    throw new Error('Failed to fetch contrastive drill questions');
  }
}

/**
 * Parse distinguishers from JSON format
 * Supports flexible N-condition format
 * 
 * @param distinguishersJson - Raw JSON from database
 * @param conditionCount - Number of conditions in the set
 * @returns Array of parsed distinguisher features
 */
function parseDistinguishers(distinguishersJson: any, conditionCount: number): DistinguisherFeature[] {
  try {
    if (!distinguishersJson) {
      return [];
    }

    const parsed = typeof distinguishersJson === 'string'
      ? JSON.parse(distinguishersJson)
      : distinguishersJson;

    const features: DistinguisherFeature[] = [];

    // Support flexible format: {"condition1": [...], "condition2": [...], ...}
    // OR indexed format: {"0": [...], "1": [...], ...}
    Object.keys(parsed).forEach((key) => {
      const conditionIndex = key.startsWith('condition') 
        ? parseInt(key.replace('condition', '')) - 1 // condition1 -> index 0
        : parseInt(key); // Direct index

      if (Array.isArray(parsed[key])) {
        parsed[key].forEach((text: string, featureIndex: number) => {
          features.push({
            id: `c${conditionIndex}-${featureIndex}`,
            text,
            belongsTo: conditionIndex,
          });
        });
      }
    });

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
    // Find user's confusion pairs using correct field names
    const confusionPairs = await prisma.confusionPair.findMany({
      where: {
        userId,
        count: { // NOT 'occurrences'
          gte: 2, // At least 2 confusions
        },
      },
      orderBy: {
        count: 'desc', // NOT 'occurrences'
      },
      take: count,
      select: {
        realConditionId: true, // NOT 'condition1Id'
        mistakenForId: true,   // NOT 'condition2Id'
      },
    });

    // Find or create contrastive sets for these pairs
    const sets = await Promise.all(
      confusionPairs.map(async (pair) => {
        if (!pair.realConditionId || !pair.mistakenForId) {
          return null;
        }

        // Look for existing contrastive set containing both conditions
        const set = await prisma.contrastiveSet.findFirst({
          where: {
            AND: [
              {
                conditionIds: {
                  has: pair.realConditionId,
                },
              },
              {
                conditionIds: {
                  has: pair.mistakenForId,
                },
              },
            ],
          },
        });

        // If set exists, return it
        if (set) {
          return set;
        }

        // Otherwise, create a basic one
        return await createBasicContrastiveSet(
          pair.realConditionId,
          pair.mistakenForId
        );
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
 * @param conditionId1 - First condition ID
 * @param conditionId2 - Second condition ID
 * @returns Created contrastive set
 */
async function createBasicContrastiveSet(
  conditionId1: string,
  conditionId2: string
): Promise<any | null> {
  try {
    // Fetch both conditions
    const conditions = await prisma.medicalContent.findMany({
      where: {
        id: {
          in: [conditionId1, conditionId2],
        },
      },
      select: {
        id: true,
        condition: true, // NOT 'name'
        system: true,
        symptoms: true,
      },
    });

    if (conditions.length !== 2) {
      return null;
    }

    const [condition1, condition2] = conditions;

    // Null check: Ensure both conditions exist
    if (!condition1 || !condition2) {
      return null;
    }

    // Create a basic distinguisher structure using array indices
    const distinguishers = {
      "0": [ // Index-based (0 = first condition)
        `Classic presentation for ${condition1.condition}`,
        'Key diagnostic feature',
      ],
      "1": [ // Index-based (1 = second condition)
        `Classic presentation for ${condition2.condition}`,
        'Key diagnostic feature',
      ],
    };

    const set = await prisma.contrastiveSet.create({
      data: {
        conditionIds: [conditionId1, conditionId2], // Array of IDs
        symptom: 'Similar presentation',
        distinguishers: distinguishers as any,
        highYield: false,
        difficulty: 'medium',
        system: condition1.system || condition2.system || undefined,
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
 * @param correctAnswerCount - Number of correct assignments
 * @param timeMs - Time taken in milliseconds
 */
export async function logContrastiveDrillAttempt(
  userId: string,
  setId: string,
  userAssignments: Record<string, number>,
  correctAnswerCount: number,
  timeMs: number
): Promise<void> {
  try {
    await prisma.contrastiveDrillAttempt.create({
      data: {
        userId,
        setId, // NOT 'contrastiveSetId'
        correctAnswers: correctAnswerCount, // NOT 'wasCorrect'
        timeSpentMs: timeMs, // NOT 'responseTimeMs'
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
        correctAnswers: true, // NOT 'wasCorrect'
        timeSpentMs: true,     // NOT 'responseTimeMs'
        completedAt: true,     // NOT 'createdAt'
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    const totalAttempts = attempts.length;
    
    // Calculate average correct answers per attempt
    const totalCorrect = attempts.reduce((sum, a) => sum + a.correctAnswers, 0);
    const avgCorrectPerAttempt = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
    
    // Calculate average response time
    const avgResponseTime =
      attempts.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0) / totalAttempts || 0;

    return {
      totalAttempts,
      totalCorrect,
      avgCorrectPerAttempt,
      avgResponseTime,
      lastAttempt: attempts[0]?.completedAt,
    };
  } catch (error) {
    console.error('Error fetching contrastive drill stats:', error);
    return {
      totalAttempts: 0,
      totalCorrect: 0,
      avgCorrectPerAttempt: 0,
      avgResponseTime: 0,
      lastAttempt: null,
    };
  }
}

export async function disconnect() {
  await prisma.$disconnect();
}
