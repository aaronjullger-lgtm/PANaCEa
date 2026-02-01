/**
 * Centralized resolution of Clerk ID (auth.userId) to internal User.id.
 * Use in any endpoint that reads or writes user-scoped data so FK and queries use the correct id.
 *
 * Usage:
 *   const userId = await resolveUserId(prisma, auth.userId);
 *   if (!userId) return { status: 404, data: { error: 'User not found' } };
 */

import type { EdgePrismaClient } from './prisma-edge';

/**
 * Resolve internal User id from Clerk id (auth.userId).
 * Returns null if the user is not yet synced (e.g. before Clerk webhook).
 */
export async function resolveUserId(
  prisma: EdgePrismaClient,
  clerkId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return user?.id ?? null;
}
