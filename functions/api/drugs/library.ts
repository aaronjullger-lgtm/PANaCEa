/**
 * GET /api/drugs/library
 *
 * Fetch filtered drug library content for Pharmacopeia browser
 * Supports filtering by drug class and search
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DrugLibrarySchema = z.object({
  query: z.object({
    drugClass: z.string().optional(),
    search: z.string().optional(),
    highYield: z.string().optional(),
    firstLine: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(DrugLibrarySchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/drugs/library');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { drugClass, search, highYield, firstLine } = validated.query || {};

    // REQUIRE drug class selection unless searching
    if ((!drugClass || drugClass === 'all') && !search) {
      return { data: { drugs: [], count: 0, message: 'Please select a drug class to browse medications', requiresSelection: true } };
    }

    // Build where clause
    const where: any = {};
    if (drugClass && drugClass !== 'all') where.drugClass = { has: drugClass };
    if (highYield === 'true') where.isHighYield = true;
    if (firstLine === 'true') where.isFirstLine = true;
    if (search && search.trim()) {
      where.OR = [
        { genericName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
        { indications: { hasSome: [search] } },
      ];
    }

    const drugs = await prisma.drug.findMany({
      where,
      select: {
        id: true, genericName: true, brandName: true, displayName: true, drugClass: true,
        isHighYield: true, isFirstLine: true, panceYield: true,
        mechanismOfAction: true, indications: true, contraindications: true,
        dosing: true, routesOfAdmin: true, formulations: true,
        absorption: true, distribution: true, metabolism: true, elimination: true,
        halfLife: true, onsetOfAction: true, peakEffect: true, duration: true,
        bioavailability: true, pharmacokinetics: true, cyp450Effects: true,
        clinicalNotes: true, clinicalPearls: true, boardYieldFacts: true, mnemonics: true,
        commonMistakes: true, testQuestionTips: true, administrationTips: true, monitoringParams: true,
        sideEffects: true, interactions: true, majorInteractions: true, blackBoxWarnings: true,
        foodInteractions: true, antidote: true, reversalAgent: true, toxicity: true, riskStrategies: true,
        pregnancyCategory: true, pregnancyNotes: true, lactationSafety: true, lactationNotes: true,
        pediatricDosing: true, pediatricNotes: true, geriatricDosing: true, geriatricNotes: true,
        renalDosing: true, hepaticDosing: true,
        genericAvailable: true, typicalCost: true, insuranceTier: true, storageRequirements: true,
        aliases: true, tags: true, createdAt: true, updatedAt: true,
      },
      orderBy: [{ isFirstLine: 'desc' }, { panceYield: 'desc' }, { genericName: 'asc' }],
    });

    logger.info('Drug library fetched', { count: drugs.length, drugClass, search });
    return { data: { drugs, count: drugs.length }, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Failed to fetch drugs', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to fetch drugs');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
