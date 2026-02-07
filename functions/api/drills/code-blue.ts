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
 *
 * Security: Public reference data endpoint with validation
 */

import { publicEndpoint, ValidatedContext } from '../_shared/middleware';
import { codeBlueQuerySchema } from '../_shared/zodSchemas';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type CodeBlueQuery = z.infer<typeof codeBlueQuerySchema>;

export interface CodeBlueQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'ACLS' | 'PALS' | 'BLS' | 'Critical Care';
}

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
    const temp = shuffled[i];
    const swapItem = shuffled[j];
    if (temp !== undefined && swapItem !== undefined) {
      shuffled[i] = swapItem;
      shuffled[j] = temp;
    }
  }
  return shuffled;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const onRequestGet = publicEndpoint(
  codeBlueQuerySchema,
  async (context: ValidatedContext<CodeBlueQuery>) => {
    const { category, count } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Build query filters
      const whereClause: any = {};

      // Add category filter if specified
      if (category) {
        whereClause.category = category;
      }

      // Fetch all matching questions (ACLSAlgorithm model: algorithm text, correctIndex, category, explanation)
      const rows = await prisma.aCLSAlgorithm.findMany({
        where: whereClause,
        select: {
          id: true,
          algorithm: true,
          correctIndex: true,
          category: true,
          explanation: true,
        },
      });
      const allQuestions = rows.map((r) => ({
        id: r.id,
        question: r.algorithm,
        options: [] as string[],
        correctIndex: r.correctIndex,
        explanation: r.explanation,
        category: r.category as CodeBlueQuestion['category'],
      }));

      // Check if we have questions
      if (allQuestions.length === 0) {
        return {
          status: 404,
          data: {
            error: 'No Code Blue questions found',
            suggestion: 'Run: npx ts-node scripts/seed-code-blue.ts to populate questions',
          },
        };
      }

      // Shuffle and limit
      const shuffledQuestions = shuffleArray(allQuestions);
      const selectedQuestions = shuffledQuestions.slice(
        0,
        Math.min(count, shuffledQuestions.length)
      );

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

      return { data: codeBlueQuestions };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
