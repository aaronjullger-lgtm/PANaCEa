/**
 * POST /api/srs/session-order
 *
 * Given a pool of due card IDs, returns them in optimal presentation order
 * using IRT/Elo maximum-information selection with fatigue adaptation.
 *
 * Request body:
 *   { cardIds: string[], domain: string, sessionHistory?: boolean[] }
 *
 * Response:
 *   { orderedCards: OrderedCard[] }
 *
 * @see lib/services/irtEloService.ts — orderSessionCards()
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import {
  orderSessionCards,
  DEFAULT_ABILITY,
  DEFAULT_DIFFICULTY,
  DEFAULT_DISCRIMINATION,
} from '../../../lib/services/irtEloService';

const SessionOrderSchema = z.object({
  body: z.object({
    cardIds: z.array(z.string()).min(1).max(200),
    domain: z.string(),
    sessionHistory: z.array(z.boolean()).optional(),
  }),
});

type SessionOrderBody = z.infer<typeof SessionOrderSchema>;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  SessionOrderSchema,
  async (context: AuthenticatedContext & ValidatedContext<SessionOrderBody>) => {
    const { cardIds, domain, sessionHistory = [] } = context.validated.body;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      const userId = await resolveOrCreateUserId(prisma, context.auth.userId);
      // Get student ability for this domain
      const studentAbility = await prisma.studentAbility.findUnique({
        where: { userId_domain: { userId, domain } },
      });
      const ability = studentAbility?.eloAbility ?? DEFAULT_ABILITY;

      // Get item difficulties for the card pool
      const itemDifficulties = await prisma.itemDifficulty.findMany({
        where: { cardId: { in: cardIds } },
      });

      // Map card IDs → difficulty data (use defaults for unknown cards)
      const difficultyMap = new Map(
        itemDifficulties.map((id) => [id.cardId, id])
      );

      const cards = cardIds.map((id) => {
        const item = difficultyMap.get(id);
        return {
          itemId: id,
          eloDifficulty: item?.eloDifficulty ?? DEFAULT_DIFFICULTY,
          discrimination: item?.discrimination ?? DEFAULT_DISCRIMINATION,
          domain,
        };
      });

      // Order cards using IRT/Elo algorithm
      const orderedCards = orderSessionCards(cards, ability, sessionHistory);

      return { data: { orderedCards } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Session ordering failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
