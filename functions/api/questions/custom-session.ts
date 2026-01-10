/**
 * Custom Study Session API Endpoint
 * 
 * POST /api/questions/custom-session
 * Fetches questions matching custom filters for ephemeral study sessions.
 * No FSRS tracking - questions are returned without modifying user progress.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';
import { handleCorsOptions } from '../_shared/auth';
import { validateRequest, CustomSessionSchema } from '../_shared/schemas';

/**
 * POST handler - fetch questions for custom session
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }
  
  // Authenticate (optional for custom sessions - allow anonymous)
  const auth = await authenticateRequest(request, env);
  const userId = auth?.userId || 'anonymous';
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), CustomSessionSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { config, count } = (validation as { success: true; data: any }).data;
    
    const requestedCount = Math.min(count || 10, 50); // Cap at 50
    
    // Build query filters
    const whereConditions: any[] = [];
    
    // Filter by systems
    if (config.systems.length > 0) {
      whereConditions.push({
        system: { in: config.systems }
      });
    }
    
    // Filter by subcategories (if specified)
    if (config.subcategories && config.subcategories.length > 0) {
      whereConditions.push({
        subcategory: { in: config.subcategories }
      });
    }
    
    // Filter by specific conditions (if specified)
    if (config.conditions && config.conditions.length > 0) {
      whereConditions.push({
        conditionId: { in: config.conditions }
      });
    }
    
    // Only fetch approved questions
    whereConditions.push({
      status: 'approved'
    });
    
    // Apply difficulty filter through metadata
    // Note: This requires questions to have difficulty metadata
    // For now, we'll apply difficulty through selection strategy
    
    // Fetch questions from pool
    const poolQuestions = await prisma.questionPool.findMany({
      where: {
        AND: whereConditions
      },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswerIndex: true,
        rationale: true,
        topic: true,
        system: true,
        subcategory: true,
        conditionId: true,
        condition: true,
        pearls: true,
        difficulty: true,
        focusArea: true,
        metadata: true,
      },
      // Fetch more than needed for randomization
      take: requestedCount * 3,
    });
    
    // Apply focus area filtering if specified
    let filteredQuestions = poolQuestions;
    if (config.focusAreas && config.focusAreas.length > 0) {
      // Filter by focus area if questions have it tagged
      // Allow questions without focusArea tag to pass through (for backward compatibility)
      filteredQuestions = poolQuestions.filter(q => 
        !q.focusArea || config.focusAreas.includes(q.focusArea)
      );
    }
    
    // Apply difficulty weighting
    let weightedQuestions = filteredQuestions;
    if (config.difficulty && config.difficulty !== 'same') {
      // Sort by difficulty, take appropriate subset
      weightedQuestions = filteredQuestions.sort((a, b) => {
        const aDiff = a.difficulty || 50;
        const bDiff = b.difficulty || 50;
        
        if (config.difficulty === 'easier') {
          return aDiff - bDiff; // Lower difficulty first
        } else {
          return bDiff - aDiff; // Higher difficulty first
        }
      });
    }
    
    // Shuffle and select requested count
    const shuffled = shuffleArray(weightedQuestions);
    const selectedQuestions = shuffled.slice(0, requestedCount);
    
    // Transform to Question format expected by client
    const questions = selectedQuestions.map((q: typeof poolQuestions[number]) => ({
      id: q.id,
      question: q.question,
      options: q.options as string[],
      correctAnswerIndex: q.correctAnswerIndex,
      rationale: q.rationale || '',
      topic: q.topic || q.system,
      system: q.system,
      subcategory: q.subcategory,
      conditionId: q.conditionId,
      condition: q.condition || 'Unknown',
      pearls: (q.pearls as string[]) || [],
      focusArea: q.focusArea,
      difficulty: q.difficulty,
    }));
    
    // Calculate total available
    const totalAvailable = await prisma.questionPool.count({
      where: {
        AND: whereConditions
      }
    });
    
    // Generate warning if not enough questions
    let warning: string | undefined;
    if (questions.length < requestedCount) {
      warning = `Only ${questions.length} questions available matching your filters. Consider broadening your selection.`;
    }
    
    return new Response(
      JSON.stringify({
        questions,
        totalAvailable,
        warning,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
    
  } catch (error) {
    console.error('[CustomSession API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch custom session questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * OPTIONS handler for CORS
 */
export async function onRequestOptions() {
  return handleCorsOptions();
}
