/**
 * Resolve internal User.id from Clerk ID (auth.userId).
 * Use in authenticated endpoints to scope queries by user.
 */

import type { EdgePrismaClient } from './prisma-edge';

export interface ResolvedUser {
  id: string;
}

/**
 * Returns { id } for the user with the given clerkId, or null if not found.
 */
export async function resolveUserByClerkId(
  prisma: EdgePrismaClient,
  clerkId: string
): Promise<ResolvedUser | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return user;
}
