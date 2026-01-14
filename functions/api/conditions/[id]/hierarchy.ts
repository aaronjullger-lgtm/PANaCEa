import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { authenticateRequest, handleCorsOptions } from '../../_shared/auth';
import type { CloudflareContext } from '../../_shared/types';

// Add type safety for hierarchy fields since they might not be in the generated client yet
// or effectively treat them as existing 
interface ConditionHierarchy extends Record<string, any> {
    parentId?: string | null;
    relationshipType?: string | null;
    canonicalName?: string | null;
    parent?: any;
    children?: any[];
}

export const onRequestOptions = handleCorsOptions;

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestGet = async (context: CloudflareContext) => {
    const id = context.params?.id;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Condition ID is required' }), {
            status: 400,
            headers: CORS_HEADERS,
        });
    }

    const authResult = await authenticateRequest(context.request, context.env as any);
    if (!authResult) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: CORS_HEADERS,
        });
    }

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
        prisma = createEdgePrismaClient(context.env);

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
            return new Response(JSON.stringify({ error: 'Condition not found' }), {
                status: 404,
                headers: CORS_HEADERS,
            });
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

        return new Response(
            JSON.stringify({
                condition: {
                    id: condition.id,
                    name: condition.condition,
                    canonicalName: (condition as unknown as ConditionHierarchy).canonicalName,
                    relationshipType: (condition as unknown as ConditionHierarchy).relationshipType,
                },
                parent: (condition as any).parent,
                children: (condition as any).children,
                siblings,
            }),
            {
                status: 200,
                headers: CORS_HEADERS,
            }
        );
    } catch (error) {
        console.error('Error fetching condition hierarchy:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch hierarchy' }), {
            status: 500,
            headers: CORS_HEADERS,
        });
    } finally {
        await safePrismaDisconnect(prisma);
    }
};
