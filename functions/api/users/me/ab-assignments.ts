import {
  withMiddleware,
  withCors,
  withErrorHandling,
  withEnvCheck,
  withAuth,
  withRateLimit,
  withLogging,
  type AuthenticatedContext,
} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

/**
 * GET /api/users/me/ab-assignments
 *
 * Returns the authenticated user's active A/B test experiment assignments.
 * Assignments are deterministic per-user (FNV-1a hash) and cached client-side
 * for 5 minutes.
 *
 * Response: { assignments: { [experimentId]: { variantName, config } } }
 */
export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
  withAuth(),
  withRateLimit({ requestsPerMinute: 60, endpointType: 'api', keyPrefix: 'ab-assignments' }),
  withLogging(),
  async (context: AuthenticatedContext) => {
    const clerkId = context.auth.userId;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Look up internal user ID from Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, studyPhase: true },
      });

      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      // Fetch all ACTIVE experiments
      const experiments = await prisma.aBExperiment.findMany({
        where: { status: 'ACTIVE' },
      });

      const assignments: Record<string, { variantName: string; config: Record<string, unknown> }> = {};

      for (const exp of experiments) {
        const variants = Array.isArray(exp.variants)
          ? exp.variants.filter(
              (v: any) => typeof v === 'object' && v !== null && typeof v.name === 'string' && typeof v.weight === 'number'
            )
          : [];

        if (variants.length === 0) continue;

        // Lazy-import to avoid loading the full service in Edge
        const { assignVariant, ensureExposure, hashUserToBucket } = await import('../../../../lib/services/abTestService');

        // Traffic gate
        const bucket = hashUserToBucket(user.id, exp.id);
        if (bucket >= (exp.trafficPercentage ?? 100) / 100) continue;

        const variantName = assignVariant(user.id, exp.id, variants, exp.trafficPercentage ?? 100);
        if (!variantName) continue;

        const matchedVariant = variants.find((v: any) => v.name === variantName);
        const config = (matchedVariant?.config as Record<string, unknown>) ?? {};
        assignments[exp.id] = { variantName, config };

        // Log exposure (idempotent)
        try {
          await ensureExposure(prisma as any, user.id, exp.id, variantName);
        } catch {
          // Non-fatal
        }
      }

      return {
        status: 200,
        data: { assignments },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
