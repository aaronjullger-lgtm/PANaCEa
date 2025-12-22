import { handleCorsOptions, authenticateRequest, createErrorResponse } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

const SYSTEM_LABELS: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  HEME: 'Hematology',
  ENDO: 'Endocrinology',
  HEENT: 'HEENT',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  PSYCH: 'Psychiatry',
  ID: 'Infectious Disease',
  GU: 'Genitourinary',
  PRO: 'Professional Practice',
  OTHER: 'Other'
};

interface ClinicalBrowseResponse {
  systems: Array<{
    code: string;
    name: string;
    categories: Array<{
      name: string;
      conditions: Array<{
        id: string;
        conditionId: string;
        name: string;
        subcategory: string;
        system: string;
        overview?: string | null;
        buzzwords?: string[];
      }>;
    }>;
    drugs: Array<{
      id: string;
      genericName: string;
      drugClass: string[];
      indications: string[];
      sideEffects: string[];
      tags: string[];
      isHighYield: boolean;
    }>;
    physiology: Array<{
      id: string;
      name: string;
      category: string;
      description?: string | null;
      clinicalSignificance?: string | null;
    }>;
  }>;
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  if (!env.DATABASE_URL) {
    return createErrorResponse('Database not configured', 500);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Fetch published medical content for conditions
    const content = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        conditionId: true,
        system: true,
        subcategory: true,
        condition: true,
        overview: true,
        buzzwords: true,
      },
    });

    // Fetch pharmacology data (tagged by system if tags include the system code)
    const drugs = await prisma.drug.findMany({
      select: {
        id: true,
        genericName: true,
        drugClass: true,
        indications: true,
        sideEffects: true,
        tags: true,
        isHighYield: true,
      },
      take: 250,
    });

    // Fetch physiology concepts
    const physiology = await prisma.physiologyConcept.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        clinicalSignificance: true,
        system: true,
      },
      take: 200,
    });

    const systemCodes = Object.keys(SYSTEM_LABELS);

    const systems: ClinicalBrowseResponse['systems'] = systemCodes.map((code) => {
      const conditionsByCategory: Record<string, any[]> = {};

      content
        .filter((c: any) => {
          if (c.system === code) return true;
          // Allow cross-tagged related systems
          return Array.isArray((c as any).relatedSystems) && (c as any).relatedSystems.includes(code);
        })
        .forEach((c: any) => {
          const cat = c.subcategory || 'General';
          if (!conditionsByCategory[cat]) conditionsByCategory[cat] = [];
          conditionsByCategory[cat].push({
            id: c.id,
            conditionId: c.conditionId,
            name: c.condition,
            subcategory: c.subcategory,
            system: c.system,
            overview: c.overview,
            buzzwords: c.buzzwords,
          });
        });

      const categories = Object.entries(conditionsByCategory)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name, conditions]) => ({
          name,
          conditions: conditions.sort((a, b) => a.name.localeCompare(b.name)),
        }));

      const systemDrugs = drugs.filter((d) => {
        if (Array.isArray(d.tags) && d.tags.some((t) => t.toUpperCase() === code)) return true;
        // Heuristic: map by class keywords
        return d.drugClass.some((cls) => cls.toUpperCase().includes(code));
      });

      const systemPhys = physiology.filter((p: any) => p.system ? p.system.toUpperCase() === code : false);

      return {
        code,
        name: SYSTEM_LABELS[code] || code,
        categories,
        drugs: systemDrugs,
        physiology: systemPhys.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          clinicalSignificance: p.clinicalSignificance,
        })),
      };
    }).filter(s => s.categories.length > 0 || s.drugs.length > 0 || s.physiology.length > 0);

    return new Response(JSON.stringify({ systems }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error building clinical browser payload', error);
    return createErrorResponse('Failed to load clinical resources', 500);
  } finally {
    await prisma.$disconnect();
  }
}
