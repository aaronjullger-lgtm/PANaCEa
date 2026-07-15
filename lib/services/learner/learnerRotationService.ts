/**
 * Rotation context helper — re-exports buildRotationContext from context service.
 */

export { buildRotationContext, getLearnerContext } from './learnerContextService';
export type { RotationContext } from './types';

import type { PrismaClient } from '@prisma/client';
import { getLearnerContext } from './learnerContextService';
import type { RotationContext } from './types';

export async function getRotationContext(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<RotationContext> {
  const ctx = await getLearnerContext(prisma, userId, now);
  return ctx.rotation;
}
