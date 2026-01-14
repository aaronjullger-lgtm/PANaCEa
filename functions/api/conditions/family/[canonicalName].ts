import type { EventContext } from '@cloudflare/workers-types';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

export async function onRequestGet(context: EventContext<any, any, any>) {
    const canonicalName = context.params.canonicalName as string | undefined;

    if (!canonicalName) {
        return new Response(JSON.stringify({ error: 'Canonical name is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const databaseUrl = context.env.DATABASE_URL;
    if (!databaseUrl) {
        return new Response(JSON.stringify({ error: 'DATABASE_URL is not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
        prisma = createEdgePrismaClient(databaseUrl);
        const decodedName = decodeURIComponent(canonicalName);

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
            return new Response(JSON.stringify({ error: 'Family not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const parent = members.find(
            (m) =>
                m.condition.toLowerCase() === decodedName.toLowerCase() ||
                m.canonicalName === m.condition ||
                !m.parentId,
        );

        return new Response(
            JSON.stringify({
                canonicalName: decodedName,
                parent,
                members: members.filter((m) => m.id !== parent?.id),
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        console.error('Error fetching condition family:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch condition family' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    } finally {
        await safePrismaDisconnect(prisma);
    }
}
