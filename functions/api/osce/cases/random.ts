/**
 * API: Get a random patient encounter case
 * GET /api/osce/cases/random
 *
 * Security: Sprint 3 - Upgraded to use standardized middleware pattern
 */

import { z } from 'zod';
import {
  authenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { logger } from '../../_shared/secureLogger';

// Empty schema for GET endpoint (filters come via query params)
const RandomCaseSchema = z.object({}).strict();

type RandomCaseInput = z.infer<typeof RandomCaseSchema>;

export const onRequestGet = authenticatedEndpoint(
  RandomCaseSchema,
  async (context: AuthenticatedContext & ValidatedContext<RandomCaseInput>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Parse optional filter query params
      const url = new URL(context.request.url);
      const targetSystem = url.searchParams.get('targetSystem');
      const difficulty = url.searchParams.get('difficulty');

      const where: Record<string, any> = {};
      if (targetSystem) {
        // Support comma-separated systems (e.g., "cardiovascular,pulmonary")
        const systems = targetSystem.split(',').map((s) => s.trim().toLowerCase());
        where.targetSystem = { in: systems };
      }
      if (difficulty) {
        where.difficulty = difficulty;
      }

      const count = await prisma.patientEncounterCase.count({ where });
      if (count === 0) {
        // Fallback: if no cases match filters, return any random case
        const totalCount = await prisma.patientEncounterCase.count();
        if (totalCount === 0) {
          logger.info('No OSCE cases found in database', {
            userId: context.auth.userId,
          });
          return { status: 404, error: 'No cases found' };
        }
        const fallbackSkip = Math.floor(Math.random() * totalCount);
        const fallbackCase = await prisma.patientEncounterCase.findFirst({
          skip: fallbackSkip,
        });
        logger.info('No filtered OSCE cases found, returning random fallback', {
          userId: context.auth.userId,
          caseId: fallbackCase?.id,
          requestedSystem: targetSystem,
          requestedDifficulty: difficulty,
        });
        return { data: fallbackCase };
      }

      const skip = Math.floor(Math.random() * count);
      const randomCase = await prisma.patientEncounterCase.findFirst({
        where,
        skip: skip,
      });

      logger.info('Random OSCE case fetched', {
        userId: context.auth.userId,
        caseId: randomCase?.id,
      });

      return { data: randomCase };
    } catch (error: any) {
      logger.error('Error fetching random OSCE case', error, {
        userId: context.auth.userId,
      });
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
