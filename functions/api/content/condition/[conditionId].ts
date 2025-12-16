import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env, params } = context;
  const { conditionId } = params;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    const content = await prisma.medicalContent.findFirst({
      where: { 
        conditionId,
        status: 'published'
      }
    });
    
    if (!content) {
      return new Response(JSON.stringify({ 
        error: 'Condition not found',
        conditionId 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      conditionId: content.conditionId,
      condition: content.condition,
      system: content.system,
      subcategory: content.subcategory,
      overview: content.overview,
      etiology: content.etiology,
      pathophysiology: content.pathophysiology,
      epidemiology: content.epidemiology,
      symptoms: content.symptoms,
      physicalExam: content.physicalExam,
      diagnostics: content.diagnostics,
      treatment: content.treatment,
      prognosis: content.prognosis,
      differentialDiagnosis: content.differentialDiagnosis,
      riskFactors: content.riskFactors,
      complications: content.complications
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error: any) {
    console.error('Error fetching condition:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
