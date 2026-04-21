/**
 * API Endpoint: /api/conditions/:id/hierarchy
 *
 * Returns condition hierarchy (parent, children, siblings)
 */

import { authenticatedEndpoint, withCors} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

// Type safety for hierarchy fields
interface ConditionHierarchy extends Record<string, any> {
  parentId?: string | null;
  relationshipType?: string | null;
  canonicalName?: string | null;
  parent?: any;
  children?: any[];
}

const HierarchySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid condition ID format'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(HierarchySchema, async ({ env, validated }) => {
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { id } = validated.params;

    const condition = await prisma.medicalContent.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, condition: true, canonicalName: true },
        },
        children: {
          select: { id: true, condition: true, relationshipType: true },
        },
      },
    });

    if (!condition) {
      return {
        error: 'Condition not found',
        statusCode: 404,
      };
    }

    // Get siblings if there is a parent
    let siblings: any[] = [];
    if ((condition as unknown as ConditionHierarchy).parentId) {
      siblings = await prisma.medicalContent.findMany({
        where: {
          parentId: (condition as unknown as ConditionHierarchy).parentId,
          id: { not: condition.id },
        },
        select: {
          id: true,
          condition: true,
          relationshipType: true,
        },
      });
    }

    return {
      condition: {
        id: condition.id,
        name: condition.condition,
        canonicalName: (condition as unknown as ConditionHierarchy).canonicalName,
        relationshipType: (condition as unknown as ConditionHierarchy).relationshipType,
      },
      parent: (condition as any).parent,
      children: (condition as any).children,
      siblings,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
