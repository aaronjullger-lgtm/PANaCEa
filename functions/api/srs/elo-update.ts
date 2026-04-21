/**
 * POST /api/srs/elo-update
 *
 * Updates Elo ratings for student ability and item difficulty after a review.
 * Called alongside (or after) the main FSRS submit pipeline.
 *
 * This endpoint maintains separate Elo estimates that feed into within-session
 * card ordering (Feature 6). It does NOT modify FSRS scheduling parameters.
 *
 * Request body:
 *   { itemId: string, domain: string, isCorrect: boolean }
 *
 * Response:
 *   { newAbility, newDifficulty, expectedP, information }
 *
 * @see lib/services/irtEloService.ts — Pure Elo computation
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  eloUpdate,
  DEFAULT_ABILITY,
  DEFAULT_DIFFICULTY,
  DEFAULT_UNCERTAINTY,
  DEFAULT_DISCRIMINATION,
} from '../../../lib/services/irtEloService';

const EloUpdateSchema = z.object({
  body: z.object({
    itemId: z.string(),
    domain: z.string(),
    isCorrect: z.boolean(),
  }),
});

type EloUpdateBody = z.infer<typeof EloUpdateSchema>;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  EloUpdateSchema,
  async (context: AuthenticatedContext & ValidatedContext<EloUpdateBody>) => {
    const { userId } = context.auth;
    const { itemId, domain, isCorrect } = context.validated.body;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Upsert student ability and item difficulty (race-safe)
      const [studentAbility, itemDifficulty] = await Promise.all([
        prisma.studentAbility.upsert({
          where: { userId_domain: { userId, domain } },
          create: {
            userId,
            domain,
            eloAbility: DEFAULT_ABILITY,
            uncertainty: DEFAULT_UNCERTAINTY,
            responseCount: 0,
          },
          update: {},
        }),
        prisma.itemDifficulty.upsert({
          where: { cardId: itemId },
          create: {
            cardId: itemId,
            eloDifficulty: DEFAULT_DIFFICULTY,
            discrimination: DEFAULT_DISCRIMINATION,
            uncertainty: DEFAULT_UNCERTAINTY,
            responseCount: 0,
          },
          update: {},
        }),
      ]);

      // Compute Elo update
      const result = eloUpdate(
        studentAbility.eloAbility,
        itemDifficulty.eloDifficulty,
        isCorrect,
        studentAbility.uncertainty,
        itemDifficulty.uncertainty,
        itemDifficulty.discrimination
      );

      // Persist updates
      await Promise.all([
        prisma.studentAbility.update({
          where: { userId_domain: { userId, domain } },
          data: {
            eloAbility: result.newAbility,
            uncertainty: result.newStudentUncertainty,
            responseCount: { increment: 1 },
          },
        }),
        prisma.itemDifficulty.update({
          where: { cardId: itemId },
          data: {
            eloDifficulty: result.newDifficulty,
            uncertainty: result.newItemUncertainty,
            responseCount: { increment: 1 },
            lastUpdated: new Date(),
          },
        }),
      ]);

      return {
        data: {
          newAbility: result.newAbility,
          newDifficulty: result.newDifficulty,
          expectedP: result.expectedP,
          information: result.information,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Elo update failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
