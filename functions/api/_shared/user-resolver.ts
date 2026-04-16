/**
 * Centralized resolution of Clerk ID (auth.userId) to internal User.id.
 * Use in any endpoint that reads or writes user-scoped data so FK and queries use the correct id.
 *
 * Usage:
 *   const userId = await resolveUserId(prisma, auth.userId);
 *   if (!userId) return { status: 404, data: { error: 'User not found' } };
 */

import type { EdgePrismaClient } from './prisma-edge';
import type { Prisma } from '@prisma/client/edge';

function buildPlaceholderEmail(clerkId: string): string {
  return `${clerkId}@placeholder.panacea.app`;
}

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

/**
 * Resolve a User row by Clerk id with a caller-provided select projection.
 */
export async function resolveUserRecord<TSelect extends Prisma.UserSelect>(
  prisma: EdgePrismaClient,
  clerkId: string,
  select: TSelect
): Promise<Prisma.UserGetPayload<{ select: TSelect }> | null> {
  return (await prisma.user.findUnique({
    where: { clerkId },
    select,
  })) as Prisma.UserGetPayload<{ select: TSelect }> | null;
}

/**
 * Resolve or create a minimal placeholder User row when Clerk auth succeeds
 * before the webhook-backed user sync has completed.
 */
export async function resolveOrCreateUserRecord<TSelect extends Prisma.UserSelect>(
  prisma: EdgePrismaClient,
  clerkId: string,
  select: TSelect
): Promise<Prisma.UserGetPayload<{ select: TSelect }>> {
  const existing = await resolveUserRecord(prisma, clerkId, select);
  if (existing) {
    return existing;
  }

  const now = new Date();
  const placeholderEmail = buildPlaceholderEmail(clerkId);

  try {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        clerkId,
        email: placeholderEmail,
        updatedAt: now,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Concurrent create or webhook sync may have won the race; re-read below.
    if (!/unique|constraint|duplicate/i.test(message)) {
      throw error;
    }
  }

  const created = await resolveUserRecord(prisma, clerkId, select);
  if (!created) {
    throw new Error(`Failed to resolve or create user for Clerk ID ${clerkId}`);
  }
  return created;
}

/**
 * Resolve or create the internal User id from Clerk id.
 */
export async function resolveOrCreateUserId(
  prisma: EdgePrismaClient,
  clerkId: string
): Promise<string> {
  const user = await resolveOrCreateUserRecord(prisma, clerkId, { id: true });
  return user.id;
}
