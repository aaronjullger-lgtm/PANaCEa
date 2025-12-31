/**
 * API Endpoint: /api/drills/related-content
 * 
 * Returns related reference content based on question category and tags.
 * Used by the EnhancedFeedbackPanel to show relevant deep-dive material.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

interface RelatedContentRequest {
  category: 'physiology' | 'anatomy' | 'lab' | 'ecg' | 'procedure' | 'finding';
  tags?: string[];
  conceptId?: string;
  limit?: number;
}

export async function onRequestPost(context: any): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: RelatedContentRequest = await context.request.json();
    const { category, tags = [], conceptId, limit = 5 } = body;

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let relatedContent: any = null;
    let relatedItems: any[] = [];

    try {
      switch (category) {
        case 'physiology': {
          // Fetch physiology concepts
          if (conceptId) {
            // Try to find by ID or name match
            relatedContent = await prisma.physiologyConcept.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { category: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          // Also fetch related by tags/category
          if (tags.length > 0) {
            relatedItems = await prisma.physiologyConcept.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { description: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'anatomy': {
          if (conceptId) {
            relatedContent = await prisma.anatomyStructure.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { region: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          if (tags.length > 0) {
            relatedItems = await prisma.anatomyStructure.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { region: { contains: tag, mode: 'insensitive' } },
                    { system: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'lab': {
          if (conceptId) {
            relatedContent = await prisma.labTest.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { abbreviation: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          if (tags.length > 0) {
            relatedItems = await prisma.labTest.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { abbreviation: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'ecg': {
          if (conceptId) {
            relatedContent = await prisma.ecgPattern.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          if (tags.length > 0) {
            relatedItems = await prisma.ecgPattern.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { rhythm: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'procedure': {
          if (conceptId) {
            relatedContent = await prisma.procedure.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          if (tags.length > 0) {
            relatedItems = await prisma.procedure.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { type: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'finding': {
          if (conceptId) {
            relatedContent = await prisma.physicalExamFinding.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }
          
          if (tags.length > 0) {
            relatedItems = await prisma.physicalExamFinding.findMany({
              where: {
                OR: tags.map(tag => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { system: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }
      }

      // Filter out duplicates from relatedItems
      if (relatedContent && relatedItems.length > 0) {
        relatedItems = relatedItems.filter(item => item.id !== relatedContent.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            primary: relatedContent,
            related: relatedItems,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error fetching related content:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch related content',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
