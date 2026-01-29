/**
 * Photo Drill Service
 * 
 * High-intensity rapid-fire image recognition for Dermatology and Radiology.
 * Implements strict statistical isolation - drill attempts do NOT affect FSRS weights.
 * 
 * Edge-compatible: All functions accept a Prisma client parameter.
 * 
 * @module services/drill/photoDrill.service
 */

// Client-safe type definitions - DO NOT import from @prisma/client
// These types are defined inline to avoid bundling Prisma in client code

/**
 * Type for any Prisma-compatible client (standard or edge).
 * Uses structural typing to avoid importing from @prisma/client.
 */
interface PrismaLike {
  mediaAsset: {
    findMany: (args?: any) => Promise<any[]>;
  };
  medicalContent: {
    findMany: (args?: any) => Promise<any[]>;
  };
  questionAttempt: {
    findMany: (args?: any) => Promise<any[]>;
  };
  $disconnect: () => Promise<void>;
}

export interface PhotoDrillQuestion {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  correctAnswer: string;
  correctConditionId: string;
  distractors: string[];
  modality: 'dermatology' | 'radiology';
  difficulty: string;
  system?: string;
}

export interface PhotoDrillBatchOptions {
  prisma: PrismaLike;
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
  options: PhotoDrillBatchOptions
): Promise<PhotoDrillQuestion[]> {
  const {
    prisma,
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

    // Filter by organ system (e.g., 'Cardiovascular', 'Pulmonary')
    if (system) {
      whereClause.system = system;
    }

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
    const questions: PhotoDrillQuestion[] = [];
    
    for (const asset of mediaAssets) {
      const correctCondition = asset.Condition || asset.MedicalContent;
      
      // Skip assets without condition link or null imageUrl
      if (!correctCondition || !asset.originalUrl) {
        continue;
      }

      // Handle union type: Condition has 'name', MedicalContent has 'condition'
      const correctAnswer = 'name' in correctCondition 
        ? correctCondition.name 
        : correctCondition.condition;
      const conditionSystem = 'system' in correctCondition ? correctCondition.system : undefined;

      // Generate 3 distractors from the same system
      const distractors = await generateDistractors(
        prisma,
        correctCondition.id,
        conditionSystem as string | undefined,
        asset.modality || 'dermatology'
      );

      questions.push({
        id: asset.id,
        imageUrl: asset.originalUrl,
        thumbnailUrl: asset.thumbnailUrl ?? undefined,
        correctAnswer,
        correctConditionId: correctCondition.id,
        distractors,
        modality: (asset.modality || 'dermatology') as 'dermatology' | 'radiology',
        difficulty: asset.difficulty || 'medium',
        system: conditionSystem as string | undefined,
      });
    }

    return questions;
  } catch (error) {
    console.error('Error fetching photo drill batch:', error);
    throw new Error('Failed to fetch photo drill questions');
  }
}

/**
 * Generate distractor conditions for a photo drill question
 * 
 * @param prisma - Prisma client instance
 * @param correctConditionId - ID of the correct condition
 * @param system - Organ system to pull distractors from
 * @param modality - Image modality (derm/radiology)
 * @returns Array of 3 distractor condition names
 */
async function generateDistractors(
  prisma: PrismaLike,
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
        condition: true,
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
          condition: true,
        },
      });
      return fallbackDistractors.map((d) => d.condition);
    }

    // Shuffle and take 3 (use toSorted to avoid mutating original array)
    const shuffled = [...potentialDistractors].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map((d) => d.condition);
  } catch (error) {
    console.error('Error generating distractors:', error);
    return ['Unknown Condition A', 'Unknown Condition B', 'Unknown Condition C'];
  }
}

/**
 * Get statistics for photo drill mode (isolated from main stats)
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @returns Photo drill statistics
 */
export async function getPhotoDrillStats(prisma: PrismaLike, userId: string) {
  try {
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        isMainSession: false, // Only drill attempts
        questionType: 'photo_drill',
      },
      select: {
        wasCorrect: true,
        durationMs: true,
        createdAt: true,
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.wasCorrect).length;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    const avgResponseTime =
      attempts.reduce((sum, a) => sum + (a.durationMs || 0), 0) / totalAttempts || 0;

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

