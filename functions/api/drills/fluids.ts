/**
 * Fluid & Electrolyte Drill API Endpoint
 * 
 * GET /api/drills/fluids
 * 
 * Query params:
 *   - count: number of cases to return (default: 1)
 *   - category: filter by category (fena|anion_gap|free_water_deficit|maintenance_fluids)
 *   - difficulty: filter by difficulty (easy|medium|hard)
 * 
 * Returns random fluid/electrolyte calculation cases from database.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DATABASE_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const countParam = url.searchParams.get('count');
    const category = url.searchParams.get('category');
    const difficulty = url.searchParams.get('difficulty');

    // Parse count parameter
    const count = countParam ? parseInt(countParam, 10) : 1;
    if (isNaN(count) || count < 1 || count > 20) {
      return new Response(
        JSON.stringify({ error: 'Count must be between 1 and 20' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate category if provided
    const validCategories = ['fena', 'anion_gap', 'free_water_deficit', 'maintenance_fluids'];
    if (category && !validCategories.includes(category)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid category',
          validCategories 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate difficulty if provided
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid difficulty',
          validDifficulties 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build query filter
    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Fetch all matching cases
    const allCases = await prisma.fluidCase.findMany({
      where,
      select: {
        id: true,
        title: true,
        scenario: true,
        labs: true,
        correctAnswer: true,
        unit: true,
        marginOfError: true,
        explanation: true,
        calculationHint: true,
        category: true,
        difficulty: true,
      }
    });

    if (allCases.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No cases found matching criteria',
          filters: { category, difficulty }
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fisher-Yates shuffle algorithm for randomization
    const shuffled = [...allCases];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return requested number of cases (or all if fewer available)
    const selectedCases = shuffled.slice(0, Math.min(count, shuffled.length));

    return new Response(
      JSON.stringify({
        cases: selectedCases,
        total: allCases.length,
        returned: selectedCases.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Fluid drill API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch fluid cases',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
};
