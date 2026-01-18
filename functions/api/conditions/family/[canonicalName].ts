/**
 * API Endpoint: /api/conditions/family/:canonicalName
 *
 * PUBLIC endpoint - Returns condition family members by canonical name
 * Educational content accessible without authentication
 */

import { publicEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const FamilySchema = z.object({
  params: z.object({
    canonicalName: z.string().min(1, 'Canonical name is required'),
  }),
});

export const onRequestGet = publicEndpoint(FamilySchema, async ({ env, validated }) => {
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const decodedName = decodeURIComponent(validated.params.canonicalName);

    const members = await prisma.medicalContent.findMany({
      where: { canonicalName: { equals: decodedName, mode: 'insensitive' } },
      select: {
        id: true,
        condition: true,
        canonicalName: true,
        relationshipType: true,
        parentId: true,
      },
    });

    if (members.length === 0) {
      return {
        error: 'Family not found',
        statusCode: 404,
      };
    }

    const parent = members.find(
      (m) =>
        m.condition.toLowerCase() === decodedName.toLowerCase() ||
        m.canonicalName === m.condition ||
        !m.parentId
    );

    return {
      canonicalName: decodedName,
      parent,
      members: members.filter((m) => m.id !== parent?.id),
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});