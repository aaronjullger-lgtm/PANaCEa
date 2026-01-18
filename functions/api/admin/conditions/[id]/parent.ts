/**
 * Admin Condition Parent Update API
 * Updates parent relationship for medical content hierarchy
 *
 * @security adminEndpoint - Requires admin role
 * @pattern Middleware Pattern (Sprint 4)
 */

import { z } from 'zod';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import {
  adminEndpoint,
  withCors,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../../_shared/middleware';
import { logger } from '../../../_shared/secureLogger';
import { isAdmin, type UserRole } from '../../../_shared/rbac';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const UpdateParentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Condition ID must be a valid UUID'),
  }),
  body: z.object({
    parentId: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
    relationshipType: z
      .enum(['subtype', 'complication', 'manifestation', 'variant'])
      .optional(),
  }),
});

type UpdateParentInput = z.infer<typeof UpdateParentSchema>;

// ============================================================================
// API HANDLER
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestPatch = adminEndpoint(
  UpdateParentSchema,
  async (
    context: AuthenticatedContext & ValidatedContext<UpdateParentInput>
  ) => {
    const { env, auth, validated, params } = context;

    // Get condition ID from path params (Cloudflare provides this)
    const conditionId = params?.id || validated.params?.id;
    if (!conditionId) {
      return { status: 400, error: 'Condition ID is required' };
    }

    const prisma = createEdgePrismaClient(env);

    try {
      // Verify admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true },
      });

      if (!user || !isAdmin(user.role as UserRole)) {
        logger.warn('Non-admin user attempted condition parent update', {
          userId: auth.userId,
          conditionId,
        });
        return { status: 403, error: 'Admin access required' };
      }

      const { parentId, relationshipType } = validated.body;

      // Verify condition exists
      const condition = await prisma.medicalContent.findUnique({
        where: { id: conditionId },
      });

      if (!condition) {
        return { status: 404, error: 'Condition not found' };
      }

      // If setting a parentId, check if parent exists
      let canonicalName: string | null = (condition as any).canonicalName;

      if (typeof parentId === 'string' && parentId) {
        const parent = await prisma.medicalContent.findUnique({
          where: { id: parentId },
        });

        if (!parent) {
          return { status: 404, error: 'Parent condition not found' };
        }

        canonicalName = (parent as any).canonicalName || parent.condition;
      }

      if (parentId === null) {
        canonicalName = null;
      }

      // Update condition
      const updated = await prisma.medicalContent.update({
        where: { id: conditionId },
        data: {
          parentId: parentId === undefined ? undefined : parentId,
          relationshipType,
          canonicalName,
        },
      });

      logger.info('Condition parent updated', {
        conditionId,
        parentId,
        relationshipType,
        adminUserId: auth.userId,
      });

      return {
        data: {
          success: true,
          condition: {
            id: updated.id,
            condition: updated.condition,
            parentId: updated.parentId,
            relationshipType: updated.relationshipType,
            canonicalName: (updated as any).canonicalName,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);