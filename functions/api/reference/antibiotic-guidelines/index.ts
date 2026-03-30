/**
 * Antibiotic Guidelines Reference API
 *
 * GET /api/reference/antibiotic-guidelines
 * Supports: ?gramStain=positive&class=Staphylococcus&query=mrsa&highYield=true
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const QuerySchema = z.object({
  query: z.object({
    gramStain: z.string().optional(),
    class: z.string().optional(),
    query: z.string().max(200).optional(),
    highYield: z.string().optional(),
  }).optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/antibiotic-guidelines', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const gramStain = url.searchParams.get('gramStain');
      const orgClass = url.searchParams.get('class');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const where: Record<string, unknown> = {};
      if (gramStain) where.gramStain = gramStain;
      if (orgClass) where.class = orgClass;
      if (highYield === 'true') where.isHighYield = true;
      if (query) {
        where.OR = [
          { organism: { contains: query, mode: 'insensitive' } },
          { class: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.antibioticGuideline.findMany({
        where,
        orderBy: [{ isHighYield: 'desc' }, { panceYield: 'desc' }, { organism: 'asc' }],
        select: {
          id: true,
          organism: true,
          class: true,
          gramStain: true,
          morphology: true,
          description: true,
          firstLineAntibiotics: true,
          alternativeAntibiotics: true,
          commonInfections: true,
          resistanceMechanisms: true,
          clinicalPearls: true,
          boardYieldFacts: true,
          isHighYield: true,
          panceYield: true,
          classicPresentation: true,
          treatmentDuration: true,
          diagnosticClues: true,
          commonMistakes: true,
          mnemonics: true,
        },
      });

      log.info('Fetched antibiotic guidelines', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching antibiotic guidelines', error);
      return { status: 500, error: 'Failed to fetch antibiotic guidelines' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
