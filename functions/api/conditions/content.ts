/**
 * GET /api/conditions/content?name={conditionName}
 * 
 * PUBLIC endpoint - Returns condition content for question generation.
 * Used by frontend geminiService to get enriched content context.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

// Handle CORS preflight
export function onRequestOptions(): Response {
  return handleCorsOptions();
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const conditionName = url.searchParams.get('name');

  if (!conditionName) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: name' }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!env.DATABASE_URL) {
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Search for condition content by name (case-insensitive)
    let record = await prisma.medicalContent.findFirst({
      where: {
        condition: { equals: conditionName, mode: 'insensitive' },
        status: 'published',
      },
    });

    // Fallback: try searching by conditionId
    if (!record) {
      record = await prisma.medicalContent.findFirst({
        where: {
          conditionId: conditionName,
          status: 'published',
        },
      });
    }

    if (!record) {
      return new Response(
        JSON.stringify({ 
          found: false,
          message: `No published content found for: ${conditionName}` 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Return structured content
    const content = {
      found: true,
      conditionId: record.conditionId,
      condition: record.condition,
      system: record.system,
      subcategory: record.subcategory,
      content: {
        overview: record.overview,
        pathophysiology: record.pathophysiology,
        symptoms: record.symptoms,
        signs: record.signs,
        diagnostics: record.diagnostics,
        treatment: record.treatment,
        differentialDiagnosis: record.differentialDiagnosis,
        complications: record.complications,
        prognosis: record.prognosis,
        classicTriad: record.classicTriad,
        buzzwords: record.buzzwords,
        clinicalPearls: record.clinicalPearls,
        examFindings: record.examFindings,
        riskFactors: record.riskFactors,
        firstLineTests: record.firstLineTests,
        goldStandardTest: record.goldStandardTest,
        firstLineTreatment: record.firstLineTreatment,
        contraindications: record.contraindications,
        monitoring: record.monitoring,
        patientEducation: record.patientEducation,
        aiConfidence: record.aiConfidence,
      },
    };

    return new Response(
      JSON.stringify(content),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[Conditions Content API] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}
