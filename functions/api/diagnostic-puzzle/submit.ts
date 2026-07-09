/**
 * POST /api/diagnostic-puzzle/submit
 * Submit a guess for today's diagnostic puzzle.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { submitDiagnosticGuess } from '@/services/core/diagnosticPuzzleService';

const SubmitGuessSchema = z.object({
  body: z.object({
    guess: z.string().min(1, 'Guess is required'),
    date: z.string().optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(
  SubmitGuessSchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/diagnostic-puzzle/submit', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Resolve internal user ID from Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        log.error('User not found in database', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const { guess, date } = validated.body;
      const payload = await submitDiagnosticGuess(prisma, user.id, guess, date);

      log.info('Submitted diagnostic guess', {
        puzzleId: payload.puzzle.id,
        guess,
        isCorrect: payload.userState.status === 'won',
        attemptsUsed: payload.userState.guesses.length,
      });

      return { data: payload };
    } catch (error: any) {
      log.error('Error submitting diagnostic guess', error);
      return {
        status: error.name === 'DiagnosticPuzzleServiceError' ? 400 : 500,
        error: error.message || 'Internal server error',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);