/**
 * API endpoint to save clinical pearls to MedicalContent table
 * POST /api/conditions/pearls
 * Body: { conditionId: string, pearls: string[] }
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';
import { validateRequest, ConditionPearlsSchema } from '../_shared/schemas';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Authenticate the request
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let prisma;
  try {
    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), ConditionPearlsSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { conditionId, pearls } = (validation as { success: true; data: any }).data;

    // Initialize Prisma Edge Client
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Fetch existing content
    const medicalContent = await prisma.medicalContent.findUnique({
      where: { id: conditionId },
      select: { content: true }
    });

    if (!medicalContent) {
      return new Response(
        JSON.stringify({ error: 'Medical content not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Merge new pearls with existing ones (deduplicate)
    const content = medicalContent.content as Record<string, any>;
    const existingPearls = Array.isArray(content?.pearls) ? content.pearls : [];
    const allPearls = [...existingPearls, ...pearls];
    
    // Deduplicate pearls (case-insensitive comparison)
    const uniquePearls = allPearls.filter((pearl, index, self) => 
      index === self.findIndex(p => 
        p.toLowerCase().trim() === pearl.toLowerCase().trim()
      )
    );

    // Limit to 50 pearls per condition to prevent bloat
    const limitedPearls = uniquePearls.slice(0, 50);

    // Update MedicalContent with new pearls
    await prisma.medicalContent.update({
      where: { id: conditionId },
      data: {
        content: {
          ...content,
          pearls: limitedPearls
        }
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalPearls: limitedPearls.length,
        addedPearls: pearls.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[API /conditions/pearls] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};

/**
 * API endpoint to fetch clinical pearls from MedicalContent table
 * GET /api/conditions/pearls?conditionId={id}
 * GET /api/conditions/pearls?system={system}&random=true (for RapidRecallDrill)
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;

  // Authenticate the request
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let prisma;
  try {
    const url = new URL(request.url);
    const conditionId = url.searchParams.get('conditionId');
    const system = url.searchParams.get('system');
    const random = url.searchParams.get('random') === 'true';

    // Initialize Prisma Edge Client
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Case 1: Fetch pearls for a specific condition
    if (conditionId) {
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { id: conditionId },
        select: { content: true, name: true }
      });

      if (!medicalContent) {
        return new Response(
          JSON.stringify({ error: 'Medical content not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const content = medicalContent.content as Record<string, any>;
      const pearls = Array.isArray(content?.pearls) ? content.pearls : [];

      return new Response(
        JSON.stringify({ 
          conditionId,
          conditionName: medicalContent.name,
          pearls
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Case 2: Fetch random pearls for a system (RapidRecallDrill)
    if (system && random) {
      // Fetch all conditions in the system that have pearls
      const conditions = await prisma.medicalContent.findMany({
        where: {
          system,
          publishStatus: 'PUBLISHED'
        },
        select: {
          id: true,
          name: true,
          content: true
        }
      });

      // Filter conditions that have pearls and flatten all pearls
      const allPearls: Array<{ conditionId: string; conditionName: string; pearl: string }> = [];
      
      for (const condition of conditions) {
        const content = condition.content as Record<string, any>;
        const pearls = Array.isArray(content?.pearls) ? content.pearls : [];
        
        for (const pearl of pearls) {
          allPearls.push({
            conditionId: condition.id,
            conditionName: condition.name,
            pearl
          });
        }
      }

      if (allPearls.length === 0) {
        return new Response(
          JSON.stringify({ pearls: [], message: 'No pearls found for this system' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Randomly select 10 pearls
      const shuffled = allPearls.sort(() => Math.random() - 0.5);
      const selectedPearls = shuffled.slice(0, 10);

      return new Response(
        JSON.stringify({ 
          system,
          pearls: selectedPearls,
          totalAvailable: allPearls.length
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request: conditionId or system+random required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[API GET /conditions/pearls] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};
