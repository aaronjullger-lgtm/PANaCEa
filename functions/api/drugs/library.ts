/**
 * GET /api/drugs/library
 * 
 * Fetch filtered drug library content for Pharmacopeia browser
 * Supports filtering by drug class and search
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';
import { CloudflareContext } from '../_shared/types';

export const onRequestOptions = handleCorsOptions;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestGet = async (context: CloudflareContext) => {

  // Authenticate user
  const env = context.env as any;
  const authResult = await authenticateRequest(context.request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const drugClass = url.searchParams.get('drugClass');
    const search = url.searchParams.get('search');
    const highYield = url.searchParams.get('highYield');
    const firstLine = url.searchParams.get('firstLine');

    // REQUIRE drug class selection unless searching
    if ((!drugClass || drugClass === 'all') && !search) {
      return new Response(
        JSON.stringify({
          drugs: [],
          count: 0,
          message: 'Please select a drug class to browse medications',
          requiresSelection: true,
        }),
        {
          status: 200,
          headers: CORS_HEADERS,
        }
      );
    }

    // Build where clause
    const where: any = {};

    // DRUG CLASS FILTER (array field - need to use array_contains equivalent)
    if (drugClass && drugClass !== 'all') {
      where.drugClass = { has: drugClass };
    }

    // HIGH YIELD FILTER
    if (highYield === 'true') {
      where.isHighYield = true;
    }

    // FIRST LINE FILTER
    if (firstLine === 'true') {
      where.isFirstLine = true;
    }

    // SEARCH FILTER
    if (search && search.trim()) {
      where.OR = [
        { genericName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
        { indications: { hasSome: [search] } },
      ];
    }

    // Fetch drugs with ALL fields needed for detail view
    const drugs = await prisma.drug.findMany({
      where,
      select: {
        id: true,
        genericName: true,
        brandName: true,
        displayName: true,
        drugClass: true,
        isHighYield: true,
        isFirstLine: true,
        panceYield: true,
        // Card preview fields
        mechanismOfAction: true,
        indications: true,
        contraindications: true,
        // Detail panel - Essentials
        dosing: true,
        routesOfAdmin: true,
        formulations: true,
        // Detail panel - Pharmacology
        absorption: true,
        distribution: true,
        metabolism: true,
        elimination: true,
        halfLife: true,
        onsetOfAction: true,
        peakEffect: true,
        duration: true,
        bioavailability: true,
        pharmacokinetics: true,
        cyp450Effects: true,
        // Detail panel - Clinical Use
        clinicalNotes: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        mnemonics: true,
        commonMistakes: true,
        testQuestionTips: true,
        administrationTips: true,
        monitoringParams: true,
        // Detail panel - Safety
        sideEffects: true,
        interactions: true,
        majorInteractions: true,
        blackBoxWarnings: true,
        foodInteractions: true,
        antidote: true,
        reversalAgent: true,
        toxicity: true,
        riskStrategies: true,
        // Detail panel - Special Populations
        pregnancyCategory: true,
        pregnancyNotes: true,
        lactationSafety: true,
        lactationNotes: true,
        pediatricDosing: true,
        pediatricNotes: true,
        geriatricDosing: true,
        geriatricNotes: true,
        renalDosing: true,
        hepaticDosing: true,
        // Additional metadata
        genericAvailable: true,
        typicalCost: true,
        insuranceTier: true,
        storageRequirements: true,
        aliases: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isFirstLine: 'desc' },  // First-line drugs first
        { panceYield: 'desc' },   // Then high-yield
        { genericName: 'asc' },   // Then alphabetical
      ],
    });

    return new Response(
      JSON.stringify({
        drugs,
        count: drugs.length,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    // Enhanced error logging for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      prismaCode: (error as any)?.code,
      prismaClientVersion: (error as any)?.clientVersion,
    };

    console.error('[drugs/library] Failed to fetch drugs:', errorDetails);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch drugs',
        details: errorDetails,
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
