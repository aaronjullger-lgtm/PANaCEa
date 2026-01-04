/**
 * Code Blue Drill API Endpoint
 * 
 * Returns random ACLS/PALS/BLS questions for Code Blue Speed Mode.
 * Uses database-first architecture - queries ACLSQuestion table.
 * 
 * Query Parameters:
 * - category: 'ACLS' | 'PALS' | 'BLS' | 'Critical Care' (optional, defaults to all)
 * - count: number of questions to return (optional, defaults to 10)
 * 
 * Response: CodeBlueQuestion[]
 * 
 * @example
 * GET /api/drills/code-blue?category=ACLS&count=10
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

// ============================================================================
// TYPES
// ============================================================================

interface Env {
  DATABASE_URL: string;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CodeBlueQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'ACLS' | 'PALS' | 'BLS' | 'Critical Care';
}

type CategoryType = 'ACLS' | 'PALS' | 'BLS' | 'Critical Care';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    
    // Parse query parameters
    const categoryParam = url.searchParams.get('category') as CategoryType | null;
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam, 10) : 10;
    
    // Validate parameters
    if (countParam && (isNaN(count) || count < 1 || count > 50)) {
      return new Response(
        JSON.stringify({ error: 'Invalid count parameter. Must be between 1 and 50.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const validCategories: CategoryType[] = ['ACLS', 'PALS', 'BLS', 'Critical Care'];
    if (categoryParam && !validCategories.includes(categoryParam)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid category. Must be: ACLS, PALS, BLS, or Critical Care' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Prisma client
    const prisma = createEdgePrismaClient(env.DATABASE_URL as string);
    
    try {
      // Build query filters
      const whereClause: any = {};
      
      // Add category filter if specified
      if (categoryParam) {
        whereClause.category = categoryParam;
      }
      
      // Fetch all matching questions (we'll shuffle and limit client-side)
      const allQuestions = await prisma.aCLSQuestion.findMany({
        where: whereClause,
        select: {
          id: true,
          question: true,
          options: true,
          correctIndex: true,
          category: true,
          explanation: true,
        },
      });
      
      // Check if we have questions
      if (allQuestions.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'No Code Blue questions found',
            suggestion: 'Run: npx ts-node scripts/seed-code-blue.ts to populate questions'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Shuffle and limit
      const shuffledQuestions = shuffleArray(allQuestions);
      const selectedQuestions = shuffledQuestions.slice(0, Math.min(count, shuffledQuestions.length));
      
      // Transform to response format
      const codeBlueQuestions: CodeBlueQuestion[] = selectedQuestions.map((q: any) => {
        // Parse options if stored as JSON string
        const options = Array.isArray(q.options)
          ? q.options
          : typeof q.options === 'string'
          ? JSON.parse(q.options)
          : [];
        
        return {
          id: q.id,
          question: q.question,
          options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          category: q.category as CodeBlueQuestion['category'],
        };
      });
      
      return new Response(
        JSON.stringify(codeBlueQuestions),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('[Code Blue API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch Code Blue questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
