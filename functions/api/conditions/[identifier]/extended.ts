import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env, params } = context;
  const { identifier } = params;

  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const userId = await verifyAuthToken(authHeader, env.CLERK_SECRET_KEY);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // 1. Try direct ID match (UUID)
    let condition = await prisma.condition.findUnique({
      where: { id: identifier },
      include: {
        anatomyStructures: true,
        specialTests: true,
        media: true
      }
    });

    // 2. If not found, try name match (exact)
    if (!condition) {
      // Try to convert slug back to name? "atrial-fibrillation" -> "Atrial Fibrillation"
      // Let's try case-insensitive search on name
      const decodedIdentifier = decodeURIComponent(identifier);
      const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: decodedIdentifier.replace(/-/g, ' '), // simple de-slugify attempt
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
      
      if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    // 3. If still not found, try searching with the raw identifier
    if (!condition) {
       const decodedIdentifier = decodeURIComponent(identifier);
       const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: decodedIdentifier,
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
       if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    if (!condition) {
      return new Response(JSON.stringify({ error: 'Condition not found' }), { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Fetch core content (MedicalContent) to speed up initial load
    // This allows the frontend to display content immediately without waiting for the full content sync
    const coreContent = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { condition: { equals: condition.name, mode: 'insensitive' } },
          { conditionId: condition.name } // Sometimes conditionId is the name
        ],
        status: 'published'
      }
    });

    const responseData = {
      ...condition,
      coreContent: coreContent ? {
        ...coreContent,
        // Ensure individual fields are available
        etiology: coreContent.etiology,
        pathophysiology: coreContent.pathophysiology,
        // Format etiologyPathophysiology for backward compatibility
        etiologyPathophysiology: [
          coreContent.etiology ? `**Etiology**\n\n${coreContent.etiology}` : null,
          coreContent.pathophysiology ? `**Pathophysiology**\n\n${coreContent.pathophysiology}` : null
        ].filter(Boolean).join('\n\n') || undefined
      } : null
    };

    return new Response(JSON.stringify(responseData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching extended condition details:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
