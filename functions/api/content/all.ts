import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { env } = context;
  
  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    // Fetch in chunks to avoid 5MB limit (Prisma Accelerate limitation)
    // Increased batch size to reduce number of round trips (connection overhead)
    const BATCH_SIZE = 50; 
    let allContent: any[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching batch at skip: ${skip}`);
      const batch = await prisma.medicalContent.findMany({
        where: { status: 'published' },
        skip,
        take: BATCH_SIZE,
        orderBy: { conditionId: 'asc' } // Ensure consistent ordering for pagination
      });
      
      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
      
      allContent = [...allContent, ...batch];
      skip += BATCH_SIZE;

      // Small delay to prevent overwhelming the connection
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Transform to map format expected by frontend
    const contentMap: Record<string, any> = {};
    allContent.forEach((item: any) => {
      contentMap[item.conditionId] = {
        // Basic info
        conditionId: item.conditionId,
        condition: item.condition,
        system: item.system,
        subcategory: item.subcategory,
        
        // Content sections - properly format for frontend
        overview: item.overview,
        
        // Combine etiology and pathophysiology for backward compatibility
        etiologyPathophysiology: [
          item.etiology ? `**Etiology**\n\n${item.etiology}` : null,
          item.pathophysiology ? `**Pathophysiology**\n\n${item.pathophysiology}` : null
        ].filter(Boolean).join('\n\n') || undefined,
        
        // Also provide separate fields for services that use them
        etiology: item.etiology,
        pathophysiology: item.pathophysiology,
        epidemiology: item.epidemiology,
        
        // Arrays - ensure they're properly formatted
        symptoms: item.symptoms && item.symptoms.length > 0 ? item.symptoms : undefined,
        physicalExam: item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        
        // Alias for backward compatibility
        examFindings: item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        
        riskFactors: item.riskFactors && item.riskFactors.length > 0 ? item.riskFactors : undefined,
        complications: item.complications && item.complications.length > 0 ? item.complications : undefined,
        differentialDiagnosis: item.differentialDiagnosis && item.differentialDiagnosis.length > 0 ? item.differentialDiagnosis : undefined,
        
        // JSON fields - pass through as-is
        diagnostics: item.diagnostics,
        treatment: item.treatment,
        
        prognosis: item.prognosis,
        buzzwords: item.buzzwords && item.buzzwords.length > 0 ? item.buzzwords : undefined
      };
    });

    return new Response(JSON.stringify(contentMap), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error: any) {
    console.error('Error fetching all content:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'Failed to fetch medical content from database',
      details: error.message 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
