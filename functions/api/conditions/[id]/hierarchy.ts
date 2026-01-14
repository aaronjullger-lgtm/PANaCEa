import { json } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

// Add type safety for hierarchy fields since they might not be in the generated client yet
// or effectively treat them as existing 
interface ConditionHierarchy extends Record<string, any> {
    parentId?: string | null;
    relationshipType?: string | null;
    canonicalName?: string | null;
    parent?: any;
    children?: any[];
}

export async function loader({ params, context }: LoaderFunctionArgs) {
    const { id } = params;

    if (!id) {
        return json({ error: 'Condition ID is required' }, { status: 400 });
    }

    const databaseUrl = (context as any)?.cloudflare?.env?.DATABASE_URL
        || (context as any)?.env?.DATABASE_URL
        || process.env.DATABASE_URL;

    if (!databaseUrl) {
        return json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
    }

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
        prisma = createEdgePrismaClient(databaseUrl);
        // We are casting types or relying on updated client
        const condition = await prisma.medicalContent.findUnique({
            where: { id },
            include: {
                parent: {
                    select: { id: true, condition: true, canonicalName: true }
                },
                children: {
                    select: { id: true, condition: true, relationshipType: true }
                }
            }
        });

        if (!condition) {
            return json({ error: 'Condition not found' }, { status: 404 });
        }

        // Get siblings if there is a parent
        let siblings: any[] = [];
        if (condition.parentId) {
            siblings = await prisma.medicalContent.findMany({
                where: {
                    parentId: condition.parentId,
                    id: { not: condition.id }
                },
                select: {
                    id: true,
                    condition: true,
                    relationshipType: true
                }
            });
        }

        return json({
            condition: {
                id: condition.id,
                name: condition.condition,
                canonicalName: condition.canonicalName,
                relationshipType: condition.relationshipType
            },
            parent: condition.parent,
            children: condition.children,
            siblings
        });

    } catch (error) {
        console.error('Error fetching condition hierarchy:', error);
        return json({ error: 'Failed to fetch hierarchy' }, { status: 500 });
    } finally {
        await safePrismaDisconnect(prisma);
    }
}
