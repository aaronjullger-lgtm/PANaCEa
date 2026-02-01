/**
 * Clinical Pearl Service
 *
 * Task 112: The "Pearl" Harvester
 * - Extract clinical pearls from question explanations
 * - Store pearls in a separate table
 * - Provide "Daily Pearl" and "Review My Pearls" features
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const API_KEY = process.env.GEMINI_API_KEY;

// Lazy initialization of AI model to improve testability and error handling
let aiModel: GenerativeModel | null = null;

/**
 * Get or initialize the AI model for pearl extraction
 * @returns GenerativeModel instance or null if API key is not configured
 */
function getAIModel(): GenerativeModel | null {
  if (!API_KEY) {
    return null;
  }
  if (!aiModel) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return aiModel;
}

interface ExtractedPearl {
  pearlText: string;
  category?: string;
  tags: string[];
}

/**
 * Extract a clinical pearl from a question explanation using AI
 * @throws Error if explanation is empty or invalid
 */
export async function extractPearlFromExplanation(
  explanation: string,
  context?: {
    conditionId?: string;
    system?: string;
  }
): Promise<ExtractedPearl | null> {
  // Input validation
  if (!explanation || explanation.trim().length === 0) {
    console.warn('[extractPearlFromExplanation] Empty explanation provided');
    return null;
  }

  const model = getAIModel();
  if (!model) {
    console.warn('[extractPearlFromExplanation] AI model not available (missing API key)');
    return null;
  }

  try {
    const prompt = `
You are a medical education expert. Extract the most important clinical pearl (a single, memorable sentence) from this explanation.

Explanation: ${explanation}

Respond with JSON only:
{
  "pearlText": "The one-sentence clinical takeaway",
  "category": "diagnosis|treatment|pathophysiology|clinical_presentation|management",
  "tags": ["keyword1", "keyword2", "keyword3"]
}

The pearl should be:
- A single, clear sentence (max 150 characters)
- Clinically actionable or memorable
- Suitable for quick review/flashcards
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const sanitized = response.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(sanitized);

      // Validate parsed structure
      if (!parsed.pearlText || typeof parsed.pearlText !== 'string') {
        console.error('[extractPearlFromExplanation] Invalid pearlText in response');
        return null;
      }

      return {
        pearlText: parsed.pearlText,
        category: parsed.category,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    } catch (parseError) {
      console.error('[extractPearlFromExplanation] Failed to parse JSON:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[extractPearlFromExplanation] AI generation error:', error);
    return null;
  }
}

/**
 * Create a clinical pearl and save to database
 */
export async function createClinicalPearl(
  questionId: string,
  fullExplanation: string,
  metadata?: {
    conditionId?: string;
    system?: string;
    difficulty?: string;
    extractedBy?: string;
  }
) {
  // Extract pearl using AI
  const extracted = await extractPearlFromExplanation(fullExplanation, {
    conditionId: metadata?.conditionId,
    system: metadata?.system,
  });

  if (!extracted) {
    throw new Error('Failed to extract pearl from explanation');
  }

  // Save to database
  const pearl = await prisma.clinicalPearl.create({
    data: {
      id: uuidv4(),
      questionId,
      // conditionId: metadata?.conditionId || null,
      system: metadata?.system || 'GENERAL',
      pearlText: extracted.pearlText,
      fullExplanation,
      category: extracted.category || null,
      tags: extracted.tags,
      updatedAt: new Date(),
      // difficulty: metadata?.difficulty || null,
      // extractedBy: metadata?.extractedBy || "ai",
    },
  });

  return pearl;
}

/**
 * Extract pearls from all questions in a batch
 */
export async function extractPearlsFromQuestions(questionIds: string[]) {
  const results = [];

  for (const questionId of questionIds) {
    try {
      // In a real implementation, you'd fetch the question data
      // For now, this is a placeholder
      const explanation = 'Sample explanation for demonstration';

      const pearl = await createClinicalPearl(questionId, explanation, {
        extractedBy: 'batch_processor',
      });

      results.push({ questionId, pearlId: pearl.id, success: true });
    } catch (error) {
      console.error(`Error extracting pearl from question ${questionId}:`, error);
      results.push({ questionId, success: false, error: (error as Error).message });
    }
  }

  return results;
}

/**
 * Get daily pearl (random high-quality pearl)
 * Prefers pearls from user's history if userId provided
 */
export async function getDailyPearl(userId?: string) {
  try {
    let pearl;

    if (userId) {
      // Get pearls from questions the user has answered
      const userHistory = await prisma.userQuestionSeen.findMany({
        where: { userId },
        select: { questionId: true },
        take: 100, // Recent questions
        orderBy: { lastSeenAt: 'desc' },
      });

      const questionIds = userHistory.map((h) => h.questionId);

      if (questionIds.length > 0) {
        // Random pearl from user's history
        const count = await prisma.clinicalPearl.count({
          where: { questionId: { in: questionIds } },
        });

        if (count > 0) {
          const skip = Math.floor(Math.random() * count);
          pearl = await prisma.clinicalPearl.findFirst({
            where: { questionId: { in: questionIds } },
            skip,
          });
        }
      }
    }

    // Fallback: any random pearl
    if (!pearl) {
      const count = await prisma.clinicalPearl.count();
      if (count === 0) {
        console.warn('[getDailyPearl] No pearls available in database');
        return null;
      }

      const skip = Math.floor(Math.random() * count);
      pearl = await prisma.clinicalPearl.findFirst({ skip });
    }

    // Update view count and track user interaction
    if (pearl) {
      await prisma.clinicalPearl.update({
        where: { id: pearl.id },
        data: { viewCount: { increment: 1 } },
      });

      // Track user view if userId provided
      if (userId) {
        await recordUserPearlView(userId, pearl.id);
      }
    }

    return pearl;
  } catch (error) {
    console.error('[getDailyPearl] Database error:', error);
    throw new Error('Failed to retrieve daily pearl');
  }
}

/**
 * Get pearls for a user (from questions they've taken)
 */
export async function getUserPearls(userId: string, limit: number = 20) {
  // Get questions the user has seen
  const userHistory = await prisma.userQuestionSeen.findMany({
    where: { userId },
    select: { questionId: true },
    orderBy: { lastSeenAt: 'desc' },
  });

  const questionIds = userHistory.map((h) => h.questionId);

  if (questionIds.length === 0) {
    return [];
  }

  // Get pearls from those questions
  const pearls = await prisma.clinicalPearl.findMany({
    where: {
      questionId: { in: questionIds },
    },
    orderBy: { extractedAt: 'desc' },
    take: limit,
  });

  // Include user's interaction data
  const userPearls = await prisma.userPearl.findMany({
    where: {
      userId,
      pearlId: { in: pearls.map((p) => p.id) },
    },
  });

  const userPearlMap = new Map(userPearls.map((up) => [up.pearlId, up]));

  return pearls.map((pearl) => ({
    ...pearl,
    userInteraction: userPearlMap.get(pearl.id) || null,
  }));
}

/**
 * Record that a user viewed a pearl
 */
export async function recordUserPearlView(userId: string, pearlId: string) {
  await prisma.userPearl.upsert({
    where: {
      userId_pearlId: {
        userId,
        pearlId,
      },
    },
    update: {
      viewedAt: new Date(),
    },
    create: {
      id: uuidv4(),
      userId,
      pearlId,
    },
  });
}

/**
 * Mark a pearl as useful with transaction safety
 * @throws Error if database operation fails
 */
export async function markPearlUseful(userId: string, pearlId: string, notes?: string) {
  // Input validation
  if (!userId || !pearlId) {
    throw new Error('userId and pearlId are required');
  }

  try {
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      await tx.userPearl.upsert({
        where: {
          userId_pearlId: {
            userId,
            pearlId,
          },
        },
        update: {
          markedUseful: true,
          notes,
        },
        create: {
          id: uuidv4(),
          userId,
          pearlId,
          markedUseful: true,
          notes,
        },
      });

      // Increment useful votes on the pearl
      await tx.clinicalPearl.update({
        where: { id: pearlId },
        data: {
          usefulVotes: { increment: 1 },
        },
      });
    });
  } catch (error) {
    console.error('[markPearlUseful] Transaction failed:', error);
    throw new Error('Failed to mark pearl as useful');
  }
}

/**
 * Get user's favorite pearls (marked as useful)
 */
export async function getUserFavoritePearls(userId: string) {
  const userPearls = await prisma.userPearl.findMany({
    where: {
      userId,
      markedUseful: true,
    },
    orderBy: { viewedAt: 'desc' },
  });

  const pearlIds = userPearls.map((up) => up.pearlId);

  if (pearlIds.length === 0) {
    return [];
  }

  const pearls = await prisma.clinicalPearl.findMany({
    where: {
      id: { in: pearlIds },
    },
  });

  const pearlMap = new Map(pearls.map((p) => [p.id, p]));

  return userPearls
    .map((up) => {
      const pearl = pearlMap.get(up.pearlId);
      if (!pearl) return null;
      return {
        ...(pearl as object),
        notes: up.notes,
        viewedAt: up.viewedAt,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

/**
 * Search pearls by keyword or category with proper type safety
 */
export async function searchPearls(query: {
  keywords?: string;
  system?: string;
  category?: string;
  tags?: string[];
  limit?: number;
}) {
  // Build type-safe where clause
  const where: Prisma.ClinicalPearlWhereInput = {};

  if (query.system) {
    where.system = query.system;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.tags && query.tags.length > 0) {
    where.tags = {
      hasSome: query.tags,
    };
  }

  if (query.keywords) {
    where.OR = [
      { pearlText: { contains: query.keywords, mode: 'insensitive' } },
      { fullExplanation: { contains: query.keywords, mode: 'insensitive' } },
    ];
  }

  try {
    const pearls = await prisma.clinicalPearl.findMany({
      where,
      orderBy: [{ usefulVotes: 'desc' }, { viewCount: 'desc' }],
      take: query.limit || 20,
    });

    return pearls;
  } catch (error) {
    console.error('[searchPearls] Database error:', error);
    throw new Error('Failed to search clinical pearls');
  }
}

/**
 * Get pearl statistics
 */
export async function getPearlStats() {
  const [total, byCategory, bySystem, topPearls] = await Promise.all([
    prisma.clinicalPearl.count(),
    prisma.clinicalPearl.groupBy({
      by: ['category'],
      _count: true,
    }),
    prisma.clinicalPearl.groupBy({
      by: ['system'],
      _count: true,
    }),
    prisma.clinicalPearl.findMany({
      orderBy: { usefulVotes: 'desc' },
      take: 10,
      select: {
        id: true,
        pearlText: true,
        system: true,
        category: true,
        usefulVotes: true,
        viewCount: true,
      },
    }),
  ]);

  return {
    total,
    byCategory,
    bySystem,
    topPearls,
  };
}

/**
 * Get pearl of the day based on date (consistent for the same day)
 */
export async function getPearlOfTheDay(date?: Date) {
  const today = date || new Date();
  // Calculate day of year: use January 1st as start (month 0, day 1)
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);

  const count = await prisma.clinicalPearl.count();
  if (count === 0) return null;

  const skip = dayOfYear % count;

  const pearl = await prisma.clinicalPearl.findFirst({
    skip,
    orderBy: { usefulVotes: 'desc' },
  });

  return pearl;
}
