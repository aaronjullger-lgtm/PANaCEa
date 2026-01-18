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

// Empty schema for GET endpoint with no parameters
const RandomCaseSchema = z.object({}).strict();

type RandomCaseInput = z.infer<typeof RandomCaseSchema>;

export const onRequestGet = authenticatedEndpoint(
  RandomCaseSchema,
  async (context: AuthenticatedContext & ValidatedContext<RandomCaseInput>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const count = await prisma.patientEncounterCase.count();
      if (count === 0) {
        logger.info('No OSCE cases found in database', {
          userId: context.auth.userId,
        });
        return { status: 404, error: 'No cases found' };
      }

      const skip = Math.floor(Math.random() * count);
      const randomCase = await prisma.patientEncounterCase.findFirst({
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