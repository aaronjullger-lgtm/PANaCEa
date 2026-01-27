/**
 * API: GET /api/clinical/browse
 *
 * Clinical browser endpoint - fetches conditions, drugs, and physiology
 * organized by organ system for the clinical reference library.
 *
 * AUTHENTICATED endpoint - requires valid auth token.
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
  CACHE_STRATEGY,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const ClinicalBrowseSchema = z.object({
  query: z.object({}).optional(), // No query params required
});

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
  OTHER: 'Other',
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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ClinicalBrowseSchema, async ({ env, auth }) => {
  const log = createEndpointLogger('/api/clinical/browse', auth.userId);

  if (!env.DATABASE_URL) {
    log.error('Database not configured');
    return { status: 500, error: 'Database not configured' };
  }

  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    log.info('Building clinical browser payload');

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
      ...CACHE_STRATEGY.STATIC, // 1h cache - clinical content rarely changes
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
      ...CACHE_STRATEGY.STATIC, // 1h cache - drug data rarely changes
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

    // Type for content items from the Prisma query
    type ContentItem = (typeof content)[0];

    const systems: ClinicalBrowseResponse['systems'] = systemCodes
      .map((code) => {
        const conditionsByCategory: Record<string, any[]> = {};

        content
          .filter((c: ContentItem) => {
            if (c.system === code) return true;
            // Allow cross-tagged related systems
            return (
              Array.isArray((c as any).relatedSystems) && (c as any).relatedSystems.includes(code)
            );
          })
          .forEach((c: ContentItem) => {
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

        type DrugResult = (typeof drugs)[0];
        const systemDrugs = drugs.filter((d: DrugResult) => {
          if (Array.isArray(d.tags) && d.tags.some((t: string) => t.toUpperCase() === code))
            return true;
          // Heuristic: map by class keywords
          return d.drugClass.some((cls: string) => cls.toUpperCase().includes(code));
        });

        type PhysResult = (typeof physiology)[0];
        const systemPhys = physiology.filter((p: PhysResult) =>
          p.system ? p.system.toUpperCase() === code : false
        );

        return {
          code,
          name: SYSTEM_LABELS[code] || code,
          categories,
          drugs: systemDrugs,
          physiology: systemPhys.map((p: PhysResult) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            clinicalSignificance: p.clinicalSignificance,
          })),
        };
      })
      .filter((s) => s.categories.length > 0 || s.drugs.length > 0 || s.physiology.length > 0);

    log.info('Clinical browser payload built successfully', {
      systemsCount: systems.length,
      totalConditions: content.length,
      totalDrugs: drugs.length,
      totalPhysiology: physiology.length,
    });

    return { systems };
  } catch (error) {
    log.error('Error building clinical browser payload', error);
    return {
      status: 500,
      error: 'Failed to load clinical resources',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
