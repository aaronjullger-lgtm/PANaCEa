import { prisma } from '@/lib/prisma';
import conditionRegistry from '@/config/conditionRegistry';

export interface ConditionData {
  id: string;
  conditionId: string;
  system: string;
  subcategory?: string | null;
  condition: string;
  relatedSystems?: string[];
  content: any;
  status?: string;
  meta?: Record<string, any>;
}

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

  const registryMeta = conditionRegistry?.find((c) => c.id === found.conditionId);
  return {
    ...(found as any),
    meta: {
      relatedSystems: found.relatedSystems || registryMeta?.relatedSystems || [],
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
