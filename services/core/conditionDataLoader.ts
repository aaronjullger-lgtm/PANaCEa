import { prisma } from '@/lib/prisma';

// Import and re-export type from client-safe types file
// This prevents client code from importing this server-only service just to get the type
import type { ConditionData } from '../../types/medical-content';
export type { ConditionData } from '../../types/medical-content';

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function loadConditionData(conditionId: string): Promise<ConditionData | null> {
  if (!hasDatabase()) return null;

  const exact = await prisma.medicalContent.findFirst({
    where: { conditionId, status: 'published' },
  });

  const found =
    exact ||
    (await prisma.medicalContent.findFirst({
      where: {
        status: 'published',
        OR: [
          { condition: { equals: conditionId, mode: 'insensitive' } },
          { conditionId: { equals: conditionId, mode: 'insensitive' } },
        ],
      },
    }));

  if (!found) return null;

  return {
    ...(found as any),
    meta: {
      relatedSystems: found.relatedSystems ?? [],
    },
  };
}

export async function getAllConditionIds(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await prisma.medicalContent.findMany({
    where: { status: 'published' },
    select: { conditionId: true },
  });
  return rows.map((r) => r.conditionId);
}

export async function getConditionsBySystem(system: string): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await prisma.medicalContent.findMany({
    where: {
      status: 'published',
      OR: [{ system }, { relatedSystems: { has: system } }],
    },
    select: { conditionId: true },
  });
  return rows.map((r) => r.conditionId);
}
