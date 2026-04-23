/**
 * API: Phantom Patient Management
 * GET/POST /api/gamification/phantom-patient
 *
 * Manages the phantom patient whose health reflects study activity.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// GET: Fetch phantom patient
export const onRequestGet = authenticatedEndpoint(z.object({}), async ({ env, auth }) => {
  const log = createEndpointLogger('/api/gamification/phantom-patient [GET]', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      include: { PhantomPatient: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    if (!user.PhantomPatient) {
      // Create default phantom patient
      const phantom = await prisma.phantomPatient.create({
        data: {
          userId: user.id,
          condition: 'Pneumonia',
          healthState: 100,
          lastInteraction: new Date(),
        },
      });

      log.info('Created default phantom patient');
      return { data: { success: true, patient: phantom } };
    }

    // Calculate health decay based on last interaction
    const lastInteractionTime = new Date(user.PhantomPatient.lastInteraction).getTime();
    const validLastInteraction = !isNaN(lastInteractionTime) ? lastInteractionTime : Date.now();
    const daysSince = Math.floor(
      (Date.now() - validLastInteraction) / (1000 * 60 * 60 * 24)
    );

    const decayRate = 5; // -5 points per day
    const currentHealth = Math.max(0, user.PhantomPatient.healthState - daysSince * decayRate);

    // Determine status
    let status: 'healthy' | 'stable' | 'declining' | 'critical' | 'recovered' = 'healthy';
    if (currentHealth >= 80) status = 'healthy';
    else if (currentHealth >= 60) status = 'stable';
    else if (currentHealth >= 40) status = 'declining';
    else status = 'critical';

    const enrichedPatient = {
      ...user.PhantomPatient,
      healthState: currentHealth,
      status,
      daysSinceInteraction: daysSince,
    };

    return { data: { success: true, patient: enrichedPatient } };
  } catch (error: any) {
    log.error('Error fetching phantom patient', error);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// POST: Update phantom patient (heal after session)
const UpdatePhantomSchema = z.object({
  body: z.object({
    heal: z.number().optional(), // Amount to heal (default: 10)
  }),
});

export const onRequestPost = authenticatedEndpoint(
  UpdatePhantomSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/gamification/phantom-patient [POST]', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        include: { PhantomPatient: true },
      });

      if (!user || !user.PhantomPatient) {
        return { status: 404, error: 'Phantom patient not found' };
      }

      const healAmount = validated.body.heal || 10;
      const newHealth = Math.min(100, user.PhantomPatient.healthState + healAmount);

      const updated = await prisma.phantomPatient.update({
        where: { id: user.PhantomPatient.id },
        data: {
          healthState: newHealth,
          lastInteraction: new Date(),
          updatedAt: new Date(),
        },
      });

      log.info('Phantom patient updated', { newHealth });
      return { data: { success: true, patient: updated } };
    } catch (error: any) {
      log.error('Error updating phantom patient', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
