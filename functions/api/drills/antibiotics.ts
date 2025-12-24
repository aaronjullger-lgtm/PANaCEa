/**
 * Antibiotic Guidelines API Endpoint
 * 
 * GET /api/drills/antibiotics
 * 
 * Query params:
 *   - class: filter by organism class (Gram Positive|Gram Negative|Atypical|Fungal|Anaerobic)
 * 
 * Returns antibiotic coverage guidelines from database for Bug-Drug drill mode.
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
    const classFilter = url.searchParams.get('class');

    // Validate class filter if provided
    const validClasses = ['Gram Positive', 'Gram Negative', 'Atypical', 'Fungal', 'Anaerobic'];
    if (classFilter && !validClasses.includes(classFilter)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid class filter',
          validClasses 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build query filter
    const where: any = {};
    if (classFilter) {
      where.class = classFilter;
    }

    // Fetch all matching guidelines
    const allGuidelines = await prisma.antibioticGuideline.findMany({
      where,
      select: {
        id: true,
        organism: true,
        class: true,
        effective: true,
        resistant: true,
        notes: true,
        description: true,
      }
    });

    if (allGuidelines.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No guidelines found',
          filters: { class: classFilter }
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON fields (effective and resistant arrays)
    const parsedGuidelines = allGuidelines.map(guideline => ({
      id: guideline.id,
      organism: guideline.organism,
      class: guideline.class,
      effective: Array.isArray(guideline.effective) 
        ? guideline.effective 
        : typeof guideline.effective === 'string'
        ? JSON.parse(guideline.effective)
        : [],
      resistant: Array.isArray(guideline.resistant)
        ? guideline.resistant
        : typeof guideline.resistant === 'string'
        ? JSON.parse(guideline.resistant)
        : [],
      notes: guideline.notes,
      description: guideline.description,
    }));

    return new Response(
      JSON.stringify({
        guidelines: parsedGuidelines,
        total: parsedGuidelines.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Antibiotic guidelines API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch antibiotic guidelines',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
};
