import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

function normalizeTreatment(data: any): any {
  if (!data) return undefined;
  if (Array.isArray(data)) return data; // Simple list fallback
  
  // Detect "Stepped" Object (First Line, Second Line, etc.)
  if (typeof data === 'object') {
    const steps: { title: string; content: string }[] = [];
    
    // Map specific DB keys to titled steps
    if (data.firstLine) steps.push({ title: "First Line", content: data.firstLine });
    if (data.secondLine) steps.push({ title: "Second Line", content: data.secondLine });
    if (data.acute) steps.push({ title: "Acute Management", content: data.acute });
    if (data.chronic) steps.push({ title: "Chronic Management", content: data.chronic });
    
    // Catch-all: Map any other string keys if not empty (dynamic extension)
    Object.keys(data).forEach(key => {
      if (!['firstLine', 'secondLine', 'acute', 'chronic'].includes(key) && typeof data[key] === 'string') {
        // Convert camelCase to Title Case (e.g. "surgicalOption" -> "Surgical Option")
        const title = key.replace(/([A-Z])/g, ' $1').trim();
        // Capitalize first letter
        const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);
        steps.push({ title: formattedTitle, content: data[key] });
      }
    });
    
    if (steps.length > 0) return { type: 'steps', items: steps };
  }
  return undefined;
}

function normalizeDiagnostics(data: any): any {
  if (!data) return undefined;
  
  // Detect Key-Value Grid (e.g. { "CBC": "Leukocytosis", "Chem": "Normal" })
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Ensure values are strings (not nested objects)
    const isGrid = Object.values(data).every(val => typeof val === 'string');
    if (isGrid) {
      return { type: 'grid', items: data };
    }
  }
  
  // Fallback for arrays
  if (Array.isArray(data)) return data;
  return undefined;
}

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { env } = context;
  
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
    // Single optimized query - select only essential fields to reduce payload
    // Cloudflare Workers have 30s timeout, this should complete well under that
    const allContent = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: {
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        overview: true,
        etiology: true,
        pathophysiology: true,
        epidemiology: true,
        symptoms: true,
        physicalExam: true,
        riskFactors: true,
        complications: true,
        differentialDiagnosis: true,
        diagnostics: true,
        treatment: true,
        prognosis: true,
        buzzwords: true,
      },
      orderBy: { conditionId: 'asc' },
      take: 3000, // Safety limit to prevent OOM
    });

    // If no content found, return empty object (not an error)
    if (!allContent || allContent.length === 0) {
      console.warn('No published medical content found in database');
      return new Response(JSON.stringify({}), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Transform to map format expected by frontend
    const contentMap: Record<string, any> = {};
    for (const item of allContent) {
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
        symptoms: item.symptoms && (item.symptoms as any[]).length > 0 ? item.symptoms : undefined,
        physicalExam: item.physicalExam && (item.physicalExam as any[]).length > 0 ? item.physicalExam : undefined,
        
        // Alias for backward compatibility
        examFindings: item.physicalExam && (item.physicalExam as any[]).length > 0 ? item.physicalExam : undefined,
        
        riskFactors: item.riskFactors && (item.riskFactors as any[]).length > 0 ? item.riskFactors : undefined,
        complications: item.complications && (item.complications as any[]).length > 0 ? item.complications : undefined,
        differentialDiagnosis: item.differentialDiagnosis && (item.differentialDiagnosis as any[]).length > 0 ? item.differentialDiagnosis : undefined,
        
        // JSON fields - normalize for smart rendering
        diagnostics: normalizeDiagnostics(item.diagnostics),
        treatment: normalizeTreatment(item.treatment),
        
        prognosis: item.prognosis,
        buzzwords: item.buzzwords && (item.buzzwords as any[]).length > 0 ? item.buzzwords : undefined
      };
    }

    console.log(`Returning ${Object.keys(contentMap).length} conditions`);

    return new Response(JSO