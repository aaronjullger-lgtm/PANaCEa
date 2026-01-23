/**
 * Photo Drill Service
 * 
 * High-intensity rapid-fire image recognition for Dermatology and Radiology.
 * Implements strict statistical isolation - drill attempts do NOT affect FSRS weights.
 * 
 * @module services/drill/photoDrill.service
 */

import { PrismaClient, MediaAsset, Condition, MedicalContent } from '@prisma/client';

// Edge-compatible Prisma client
let prisma: PrismaClient;

if (typeof window === 'undefined') {
  // Server-side: Use standard Prisma
  prisma = new PrismaClient();
} else {
  throw new Error('Photo Drill Service must run server-side only');
}

export interface PhotoDrillQuestion {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  blurHash?: string;
  correctAnswer: string;
  correctConditionId: string;
  distractors: string[];
  modality: 'dermatology' | 'radiology';
  difficulty: string;
  system?: string;
}

export interface PhotoDrillBatchOptions {
  system?: string;
  modality?: 'dermatology' | 'radiology';
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
  excludeUsedIds?: string[];
}

/**
 * Get a batch of photo drill questions
 * 
 * @param options - Filtering options for the drill batch
 * @returns Array of photo drill questions with distractors
 */
export async function getPhotoDrillBatch(
  options: PhotoDrillBatchOptions = {}
): Promise<PhotoDrillQuestion[]> {
  const {
    system,
    modality,
    difficulty = 'medium',
    count = 10,
    excludeUsedIds = [],
  } = options;

  try {
    // Build where clause dynamically
    const whereClause: any = {
      type: 'image',
      usageType: 'quiz',
      isAnnotated: false, // Use clean images without annotations
    };

    // Filter by modality (dermatology or radiology)
    if (modality) {
      whereClause.modality = modality;
    } else {
      // Default to derm and radiology only
      whereClause.modality = {
        in: ['dermatology', 'radiology'],
      };
    }

    // Filter by difficulty
    if (difficulty) {
      whereClause.difficulty = difficulty;
    }

    // Exclude already used
    if (excludeUsedIds.length > 0) {
      whereClause.id = {
        notIn: excludeUsedIds,
      };
    }

    // Fetch media assets with related content
    const mediaAssets = await prisma.mediaAsset.findMany({
      where: whereClause,
      take: count,
      include: {
        Condition: true,
        MedicalContent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (mediaAssets.length === 0) {
      return [];
    }

    // Generate questions with distractors
    const questions = await Promise.all(
      mediaAssets.map(async (asset) => {
        const correctCondition = asset.Condition || asset.MedicalContent;
        
        if (!correctCondition) {
          return null; // Skip assets without condition link
        }

        const correctAnswer = correctCondition.name;
        const conditionSystem = 'system' in correctCondition ? correctCondition.system : undefined;

        // Generate 3 distractors from the same system
        const distractors = await generateDistractors(
          correctCondition.id,
          conditionSystem as string | undefined,
          asset.modality || 'dermatology'
        );

        return {
          id: asset.id,
          imageUrl: asset.originalUrl,
          thumbnailUrl: asset.thumbnailUrl || undefined,
          blurHash: asset.blurHash || undefined,
          correctAnswer,
          correctConditionId: correctCondition.id,
          distractors,
          modality: (asset.modality || 'dermatology') as 'dermatology' | 'radiology',
          difficulty: asset.difficulty || 'medium',
          system: conditionSystem as string | undefined,
        };
      })
    );

    // Filter out nulls
    return questions.filter((q): q is PhotoDrillQuestion => q !== null);
  } catch (error) {
    console.error('Error fetching photo drill batch:', error);
    throw new Error('Failed to fetch photo drill questions');
  }
}

/**
 * Generate distractor conditions for a photo drill question
 * 
 * @param correctConditionId - ID of the correct condition
 * @param system - Organ system to pull distractors from
 * @param modality - Image modality (derm/radiology)
 * @returns Array of 3 distractor condition names
 */
async function generateDistractors(
  correctConditionId: string,
  system?: string,
  modality?: string
): Promise<string[]> {
  try {
    // Build where clause
    const whereClause: any = {
      id: {
        not: correctConditionId,
      },
    };

    // Prefer same system for more realistic distractors
    if (system) {
      whereClause.system = system;
    }

    // Fetch potential distractors
    const potentialDistractors = await prisma.medicalContent.findMany({
      where: whereClause,
      take: 20, // Get more than needed for randomization
      select: {
        name: true,
      },
    });

    if (potentialDistractors.length === 0) {
      // Fallback: get any conditions
      const fallbackDistractors = await prisma.medicalContent.findMany({
        where: {
          id: {
            not: correctConditionId,
          },
        },
        take: 3,
        select: {
          name: true,
        },
      });
      return fallbackDistractors.map((d) => d.name);
    }

    // Shuffle and take 3
    const shuffled = potentialDistractors.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map((d) => d.name);
  } catch (error) {
    console.error('Error generating distractors:', error);
    return ['Unknown Condition A', 'Unknown Condition B', 'Unknown Condition C'];
  }
}

/**
 * Get statistics for photo drill mode (isolated from main stats)
 * 
 * @param userId - User ID
 * @returns Photo drill statistics
 */
export async function getPhotoDrillStats(userId: string) {
  try {
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        isMainSession: false, // Only drill attempts
        questionType: 'photo_drill',
      },
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
    console.error('Error fetching photo drill stats:', error);
    return {
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      avgResponseTime: 0,
      lastAttempt: null,
    };
  }
}

/**
 * Clean up - close Prisma connection
 */
export async function disconnect() {
  await prisma.$disconnect();
}