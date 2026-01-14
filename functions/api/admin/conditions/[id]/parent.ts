import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { authenticateRequest, handleCorsOptions } from '../../../_shared/auth';
import type { CloudflareContext } from '../../../_shared/types';
import { isAdmin, type UserRole } from '../../../_shared/rbac';
import { z } from 'zod';

const UpdateParentSchema = z.object({
        parentId: z.string().nullable().optional(),
    relationshipType: z.enum(['subtype', 'complication', 'manifestation', 'variant']).optional(),
});

export const onRequestOptions = handleCorsOptions;

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestPatch = async (context: CloudflareContext) => {
    const id = context.params?.id;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Condition ID is required' }), {
            status: 400,
            headers: CORS_HEADERS,
        });
    }

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
        prisma = createEdgePrismaClient(context.env);

        const auth = await authenticateRequest(context.request as any, context.env as any);
        if (!auth?.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: CORS_HEADERS,
            });
        }

        // Admin-only endpoint
        const user = await prisma.user.findUnique({
            where: { clerkId: auth.userId },
            select: { role: true },
        });

        if (!user || !isAdmin(user.role as UserRole)) {
            return new Response(JSON.stringify({ error: 'Admin access required' }), {
                status: 403,
                headers: CORS_HEADERS,
            });
        }

        const data = await context.request.json();
        const result = UpdateParentSchema.safeParse(data);
        if (!result.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid input', details: result.error.flatten() }),
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const { parentId, relationshipType } = result.data;

        const condition = await prisma.medicalContent.findUnique({ where: { id } });
        if (!condition) {
            return new Response(JSON.stringify({ error: 'Condition not found' }), {
                status: 404,
                headers: CORS_HEADERS,
            });
        }

        // If setting a parentId, check if parent exists
        let canonicalName: string | null = (condition as any).canonicalName;

        if (typeof parentId === 'string' && parentId) {
            const parent = await prisma.medicalContent.findUnique({ where: { id: parentId } });
            if (!parent) {
                return new Response(JSON.stringify({ error: 'Parent condition not found' }), {
                    status: 404,
                    headers: CORS_HEADERS,
                });
            }

            canonicalName = (parent as any).canonicalName || parent.condition;
        }

        if (parentId === null) {
            canonicalName = null;
        }

        const updated = await prisma.medicalContent.update({
            where: { id },
            data: {
                parentId: parentId === undefined ? undefined : parentId,
                relationshipType,
                canonicalName,
            },
        });

        return new Response(JSON.stringify({ success: true, condition: updated }), {
            status: 200,
            headers: CORS_HEADERS,
        });
    } catch (error) {
        console.error('Error updating parent relationship:', error);
        return new Response(JSON.stringify({ error: 'Failed to update relationship' }), {
            status: 500,
            headers: CORS_HEADERS,
        });
    } finally {
        await safePrismaDisconnect(prisma);
    }
};
